//! NexusDeFi SVM Bridge Program
//! 
//! This program facilitates cross-chain asset transfers between EVM and SVM:
//! - Lock/mint mechanism for asset transfers
//! - Transaction correlation between chains
//! - Multi-signature validation for security
//! - Support for both native tokens (SOL/ETH) and SPL/ERC-20 tokens

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer, MintTo, Burn, transfer, mint_to, burn};

declare_id!("Hrhe54Vk1mRR2SXvyR33Y5xaNGzVYh3gXPcmGRFFVxQr");

#[program]
pub mod nexus_bridge {
    use super::*;

    /// Initialize the bridge
    pub fn initialize_bridge(
        ctx: Context<InitializeBridge>,
        authority: Pubkey,
        validators: Vec<Pubkey>,
        threshold: u8,
    ) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge;
        
        require!(threshold > 0, BridgeError::InvalidThreshold);
        require!(validators.len() >= threshold as usize, BridgeError::InsufficientValidators);
        require!(validators.len() <= 20, BridgeError::TooManyValidators);
        
        bridge.authority = authority;
        bridge.validators = validators.clone();
        bridge.threshold = threshold;
        bridge.nonce = 0;
        bridge.total_locked = 0;
        bridge.total_minted = 0;
        bridge.is_paused = false;
        bridge.supported_chains = Vec::new();
        
        emit!(BridgeInitialized {
            bridge: bridge.key(),
            authority,
            validators,
            threshold,
        });
        
        Ok(())
    }

    /// Add a supported chain
    pub fn add_supported_chain(
        ctx: Context<ModifyChain>,
        chain_id: u64,
        chain_type: ChainType,
        bridge_address: [u8; 32], // EVM address or SVM pubkey
        min_confirmations: u64,
    ) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge;
        
        require!(
            bridge.supported_chains.len() < 50,
            BridgeError::TooManyChains
        );
        
        let chain_info = SupportedChain {
            chain_id,
            chain_type: chain_type.clone(),
            bridge_address,
            min_confirmations,
            is_active: true,
            total_volume: 0,
        };
        
        bridge.supported_chains.push(chain_info);
        
        emit!(ChainAdded {
            bridge: bridge.key(),
            chain_id,
            chain_type,
            bridge_address,
        });
        
        Ok(())
    }

    /// Lock tokens for cross-chain transfer
    pub fn lock_tokens(
        ctx: Context<LockTokens>,
        amount: u64,
        destination_chain: u64,
        destination_address: [u8; 32],
        token_mint: Option<Pubkey>,
    ) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge;
        let user = &ctx.accounts.user;
        
        require!(!bridge.is_paused, BridgeError::BridgePaused);
        
        // Find destination chain and get lock_id before mutable operations
        let chain_exists = bridge.supported_chains
            .iter()
            .any(|c| c.chain_id == destination_chain && c.is_active);
        
        require!(chain_exists, BridgeError::UnsupportedChain);
        
        let lock_id = bridge.nonce;
        bridge.nonce += 1;
        
        match token_mint {
            Some(mint) => {
                // Lock SPL tokens
                let user_token_account = &ctx.accounts.user_token_account.as_ref()
                    .ok_or(BridgeError::MissingTokenAccount)?;
                let bridge_token_account = &ctx.accounts.bridge_token_account.as_ref()
                    .ok_or(BridgeError::MissingBridgeTokenAccount)?;
                let token_program = &ctx.accounts.token_program.as_ref()
                    .ok_or(BridgeError::MissingTokenProgram)?;
                
                // Transfer tokens to bridge
                let cpi_accounts = Transfer {
                    from: user_token_account.to_account_info(),
                    to: bridge_token_account.to_account_info(),
                    authority: user.to_account_info(),
                };
                
                transfer(
                    CpiContext::new(token_program.to_account_info(), cpi_accounts),
                    amount,
                )?;
                
                // Create lock record
                let lock_record = &mut ctx.accounts.lock_record;
                lock_record.id = lock_id;
                lock_record.user = user.key();
                lock_record.token_mint = Some(mint);
                lock_record.amount = amount;
                lock_record.destination_chain = destination_chain;
                lock_record.destination_address = destination_address;
                lock_record.timestamp = Clock::get()?.unix_timestamp;
                lock_record.is_claimed = false;
                lock_record.claim_tx_hash = None;
            }
            None => {
                // Lock SOL
                require!(amount > 0, BridgeError::InvalidAmount);
                
                // Transfer SOL to bridge
                **user.try_borrow_mut_lamports()? -= amount;
                **bridge.to_account_info().try_borrow_mut_lamports()? += amount;
                
                // Create lock record
                let lock_record = &mut ctx.accounts.lock_record;
                lock_record.id = lock_id;
                lock_record.user = user.key();
                lock_record.token_mint = None;
                lock_record.amount = amount;
                lock_record.destination_chain = destination_chain;
                lock_record.destination_address = destination_address;
                lock_record.timestamp = Clock::get()?.unix_timestamp;
                lock_record.is_claimed = false;
                lock_record.claim_tx_hash = None;
            }
        }
        
        // Update totals after operations
        bridge.total_locked += amount;
        
        // Update chain volume separately
        if let Some(chain_info) = bridge.supported_chains
            .iter_mut()
            .find(|c| c.chain_id == destination_chain) {
            chain_info.total_volume += amount;
        }
        
        emit!(TokensLocked {
            lock_id,
            user: user.key(),
            token_mint,
            amount,
            destination_chain,
            destination_address,
        });
        
        Ok(())
    }

    /// Mint tokens from cross-chain transfer
    pub fn mint_tokens(
        ctx: Context<MintTokens>,
        lock_id: u64,
        source_chain: u64,
        source_tx_hash: [u8; 32],
        recipient: Pubkey,
        token_mint: Option<Pubkey>,
        amount: u64,
        validator_signatures: Vec<[u8; 64]>,
    ) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge;
        
        require!(!bridge.is_paused, BridgeError::BridgePaused);
        require!(
            validator_signatures.len() >= bridge.threshold as usize,
            BridgeError::InsufficientSignatures
        );
        
        // Verify source chain is supported
        let chain_exists = bridge.supported_chains
            .iter()
            .any(|c| c.chain_id == source_chain && c.is_active);
        
        require!(chain_exists, BridgeError::UnsupportedChain);
        
        // Create message hash for signature verification
        let message_hash = anchor_lang::solana_program::hash::hashv(&[
            &lock_id.to_le_bytes(),
            &source_chain.to_le_bytes(),
            &source_tx_hash,
            recipient.as_ref(),
            &token_mint.map_or([0u8; 32], |m| m.to_bytes()),
            &amount.to_le_bytes(),
        ]).to_bytes();
        
        // Verify validator signatures
        let mut valid_signatures = 0;
        let validators = bridge.validators.clone(); // Clone to avoid borrow issues
        let threshold = bridge.threshold;
        
        for (i, signature) in validator_signatures.iter().enumerate() {
            if i < validators.len() {
                if verify_signature(&message_hash, signature, &validators[i])? {
                    valid_signatures += 1;
                }
            }
        }
        
        require!(
            valid_signatures >= threshold,
            BridgeError::InsufficientValidSignatures
        );
        
        // Check if already minted
        let mint_record = &mut ctx.accounts.mint_record;
        require!(!mint_record.is_minted, BridgeError::AlreadyMinted);
        
        match token_mint {
            Some(_mint) => {
                // Mint SPL tokens
                let recipient_token_account = &ctx.accounts.recipient_token_account.as_ref()
                    .ok_or(BridgeError::MissingTokenAccount)?;
                let token_program = &ctx.accounts.token_program.as_ref()
                    .ok_or(BridgeError::MissingTokenProgram)?;
                let mint_account = &ctx.accounts.mint_account.as_ref()
                    .ok_or(BridgeError::MissingMintAccount)?;
                
                let cpi_accounts = MintTo {
                    mint: mint_account.to_account_info(),
                    to: recipient_token_account.to_account_info(),
                    authority: bridge.to_account_info(),
                };
                
                let authority_key = bridge.authority;
                let seeds = &[
                    b"bridge",
                    authority_key.as_ref(),
                    &[ctx.bumps.bridge],
                ];
                
                mint_to(
                    CpiContext::new_with_signer(
                        token_program.to_account_info(),
                        cpi_accounts,
                        &[seeds],
                    ),
                    amount,
                )?;
            }
            None => {
                // Mint SOL (transfer from bridge balance)
                let recipient_account = &ctx.accounts.recipient_account.as_ref()
                    .ok_or(BridgeError::MissingRecipientAccount)?;
                
                **bridge.to_account_info().try_borrow_mut_lamports()? -= amount;
                **recipient_account.try_borrow_mut_lamports()? += amount;
            }
        }
        
        // Record the mint
        mint_record.lock_id = lock_id;
        mint_record.source_chain = source_chain;
        mint_record.source_tx_hash = source_tx_hash;
        mint_record.recipient = recipient;
        mint_record.token_mint = token_mint;
        mint_record.amount = amount;
        mint_record.timestamp = Clock::get()?.unix_timestamp;
        mint_record.is_minted = true;
        
        // Update totals
        bridge.total_minted += amount;
        
        // Update chain volume separately
        if let Some(chain_info) = bridge.supported_chains
            .iter_mut()
            .find(|c| c.chain_id == source_chain) {
            chain_info.total_volume += amount;
        }
        
        emit!(TokensMinted {
            lock_id,
            source_chain,
            source_tx_hash,
            recipient,
            token_mint,
            amount,
        });
        
        Ok(())
    }

    /// Burn tokens for cross-chain transfer
    pub fn burn_tokens(
        ctx: Context<BurnTokens>,
        amount: u64,
        destination_chain: u64,
        destination_address: [u8; 32],
        token_mint: Pubkey,
    ) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge;
        let user = &ctx.accounts.user;
        
        require!(!bridge.is_paused, BridgeError::BridgePaused);
        
        // Verify destination chain is supported
        let chain_exists = bridge.supported_chains
            .iter()
            .any(|c| c.chain_id == destination_chain && c.is_active);
        
        require!(chain_exists, BridgeError::UnsupportedChain);
        
        let burn_id = bridge.nonce;
        bridge.nonce += 1;
        
        // Burn SPL tokens
        let user_token_account = &ctx.accounts.user_token_account;
        let mint_account = &ctx.accounts.mint_account;
        let token_program = &ctx.accounts.token_program;
        
        let cpi_accounts = Burn {
            mint: mint_account.to_account_info(),
            from: user_token_account.to_account_info(),
            authority: user.to_account_info(),
        };
        
        burn(
            CpiContext::new(token_program.to_account_info(), cpi_accounts),
            amount,
        )?;
        
        // Create burn record
        let burn_record = &mut ctx.accounts.burn_record;
        burn_record.id = burn_id;
        burn_record.user = user.key();
        burn_record.token_mint = token_mint;
        burn_record.amount = amount;
        burn_record.destination_chain = destination_chain;
        burn_record.destination_address = destination_address;
        burn_record.timestamp = Clock::get()?.unix_timestamp;
        burn_record.is_claimed = false;
        burn_record.claim_tx_hash = None;
        
        // Update chain volume separately
        if let Some(chain_info) = bridge.supported_chains
            .iter_mut()
            .find(|c| c.chain_id == destination_chain) {
            chain_info.total_volume += amount;
        }
        
        emit!(TokensBurned {
            burn_id,
            user: user.key(),
            token_mint,
            amount,
            destination_chain,
            destination_address,
        });
        
        Ok(())
    }

    /// Emergency pause/unpause
    pub fn set_paused(
        ctx: Context<SetPaused>,
        is_paused: bool,
    ) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge;
        
        bridge.is_paused = is_paused;
        
        emit!(BridgeStatusChanged {
            bridge: bridge.key(),
            is_paused,
        });
        
        Ok(())
    }

    /// Update validator set
    pub fn update_validators(
        ctx: Context<UpdateValidators>,
        new_validators: Vec<Pubkey>,
        new_threshold: u8,
    ) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge;
        
        require!(new_threshold > 0, BridgeError::InvalidThreshold);
        require!(new_validators.len() >= new_threshold as usize, BridgeError::InsufficientValidators);
        require!(new_validators.len() <= 20, BridgeError::TooManyValidators);
        
        bridge.validators = new_validators.clone();
        bridge.threshold = new_threshold;
        
        emit!(ValidatorsUpdated {
            bridge: bridge.key(),
            validators: new_validators,
            threshold: new_threshold,
        });
        
        Ok(())
    }
}

// Account Structures
#[account]
pub struct Bridge {
    pub authority: Pubkey,
    pub validators: Vec<Pubkey>,
    pub threshold: u8,
    pub nonce: u64,
    pub total_locked: u64,
    pub total_minted: u64,
    pub is_paused: bool,
    pub supported_chains: Vec<SupportedChain>,
}

#[account]
pub struct LockRecord {
    pub id: u64,
    pub user: Pubkey,
    pub token_mint: Option<Pubkey>,
    pub amount: u64,
    pub destination_chain: u64,
    pub destination_address: [u8; 32],
    pub timestamp: i64,
    pub is_claimed: bool,
    pub claim_tx_hash: Option<[u8; 32]>,
}

#[account]
pub struct MintRecord {
    pub lock_id: u64,
    pub source_chain: u64,
    pub source_tx_hash: [u8; 32],
    pub recipient: Pubkey,
    pub token_mint: Option<Pubkey>,
    pub amount: u64,
    pub timestamp: i64,
    pub is_minted: bool,
}

#[account]
pub struct BurnRecord {
    pub id: u64,
    pub user: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub destination_chain: u64,
    pub destination_address: [u8; 32],
    pub timestamp: i64,
    pub is_claimed: bool,
    pub claim_tx_hash: Option<[u8; 32]>,
}

// Data Structures
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SupportedChain {
    pub chain_id: u64,
    pub chain_type: ChainType,
    pub bridge_address: [u8; 32],
    pub min_confirmations: u64,
    pub is_active: bool,
    pub total_volume: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum ChainType {
    Evm,
    Svm,
}

// Context Structures
#[derive(Accounts)]
#[instruction(authority: Pubkey)]
pub struct InitializeBridge<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Bridge::INIT_SPACE,
        seeds = [b"bridge", authority.as_ref()],
        bump
    )]
    pub bridge: Account<'info, Bridge>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ModifyChain<'info> {
    #[account(
        mut,
        seeds = [b"bridge", bridge.authority.as_ref()],
        bump,
        has_one = authority
    )]
    pub bridge: Account<'info, Bridge>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(amount: u64, destination_chain: u64, destination_address: [u8; 32])]
pub struct LockTokens<'info> {
    #[account(
        mut,
        seeds = [b"bridge", bridge.authority.as_ref()],
        bump
    )]
    pub bridge: Account<'info, Bridge>,
    
    #[account(
        init,
        payer = user,
        space = 8 + LockRecord::INIT_SPACE,
        seeds = [b"lock", bridge.key().as_ref(), &bridge.nonce.to_le_bytes()],
        bump
    )]
    pub lock_record: Account<'info, LockRecord>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    // Optional accounts for token operations
    pub user_token_account: Option<Account<'info, TokenAccount>>,
    pub bridge_token_account: Option<Account<'info, TokenAccount>>,
    pub token_program: Option<Program<'info, Token>>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(lock_id: u64, source_chain: u64)]
pub struct MintTokens<'info> {
    #[account(
        mut,
        seeds = [b"bridge", bridge.authority.as_ref()],
        bump
    )]
    pub bridge: Account<'info, Bridge>,
    
    #[account(
        init,
        payer = payer,
        space = 8 + MintRecord::INIT_SPACE,
        seeds = [b"mint", &lock_id.to_le_bytes()[..4], &source_chain.to_le_bytes()[..4]],
        bump
    )]
    pub mint_record: Account<'info, MintRecord>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    // Optional accounts for token operations
    pub recipient_token_account: Option<Account<'info, TokenAccount>>,
    pub mint_account: Option<Account<'info, Mint>>,
    pub token_program: Option<Program<'info, Token>>,
    
    // Optional account for SOL operations
    /// CHECK: Recipient account for SOL
    pub recipient_account: Option<AccountInfo<'info>>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, destination_chain: u64, destination_address: [u8; 32], token_mint: Pubkey)]
pub struct BurnTokens<'info> {
    #[account(
        mut,
        seeds = [b"bridge", bridge.authority.as_ref()],
        bump
    )]
    pub bridge: Account<'info, Bridge>,
    
    #[account(
        init,
        payer = user,
        space = 8 + BurnRecord::INIT_SPACE,
        seeds = [b"burn", bridge.key().as_ref(), &bridge.nonce.to_le_bytes()],
        bump
    )]
    pub burn_record: Account<'info, BurnRecord>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub mint_account: Account<'info, Mint>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(
        mut,
        seeds = [b"bridge", bridge.authority.as_ref()],
        bump,
        has_one = authority
    )]
    pub bridge: Account<'info, Bridge>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateValidators<'info> {
    #[account(
        mut,
        seeds = [b"bridge", bridge.authority.as_ref()],
        bump,
        has_one = authority
    )]
    pub bridge: Account<'info, Bridge>,
    
    pub authority: Signer<'info>,
}

// Events
#[event]
pub struct BridgeInitialized {
    pub bridge: Pubkey,
    pub authority: Pubkey,
    pub validators: Vec<Pubkey>,
    pub threshold: u8,
}

#[event]
pub struct ChainAdded {
    pub bridge: Pubkey,
    pub chain_id: u64,
    pub chain_type: ChainType,
    pub bridge_address: [u8; 32],
}

#[event]
pub struct TokensLocked {
    pub lock_id: u64,
    pub user: Pubkey,
    pub token_mint: Option<Pubkey>,
    pub amount: u64,
    pub destination_chain: u64,
    pub destination_address: [u8; 32],
}

#[event]
pub struct TokensMinted {
    pub lock_id: u64,
    pub source_chain: u64,
    pub source_tx_hash: [u8; 32],
    pub recipient: Pubkey,
    pub token_mint: Option<Pubkey>,
    pub amount: u64,
}

#[event]
pub struct TokensBurned {
    pub burn_id: u64,
    pub user: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub destination_chain: u64,
    pub destination_address: [u8; 32],
}

#[event]
pub struct BridgeStatusChanged {
    pub bridge: Pubkey,
    pub is_paused: bool,
}

#[event]
pub struct ValidatorsUpdated {
    pub bridge: Pubkey,
    pub validators: Vec<Pubkey>,
    pub threshold: u8,
}

// Error Definitions
#[error_code]
pub enum BridgeError {
    #[msg("Invalid threshold")]
    InvalidThreshold,
    #[msg("Insufficient validators")]
    InsufficientValidators,
    #[msg("Too many validators")]
    TooManyValidators,
    #[msg("Too many chains")]
    TooManyChains,
    #[msg("Bridge is paused")]
    BridgePaused,
    #[msg("Unsupported chain")]
    UnsupportedChain,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Missing token account")]
    MissingTokenAccount,
    #[msg("Missing bridge token account")]
    MissingBridgeTokenAccount,
    #[msg("Missing token program")]
    MissingTokenProgram,
    #[msg("Missing mint account")]
    MissingMintAccount,
    #[msg("Missing recipient account")]
    MissingRecipientAccount,
    #[msg("Insufficient signatures")]
    InsufficientSignatures,
    #[msg("Insufficient valid signatures")]
    InsufficientValidSignatures,
    #[msg("Already minted")]
    AlreadyMinted,
    #[msg("Invalid signature")]
    InvalidSignature,
}

// Helper Functions
fn verify_signature(
    _message: &[u8; 32],
    _signature: &[u8; 64],
    _validator: &Pubkey,
) -> Result<bool> {
    // This is a simplified signature verification
    // In production, this would use proper cryptographic verification
    // based on the signature scheme (ed25519 for Solana, secp256k1 for EVM compatibility)
    
    // For now, return true as placeholder
    // Real implementation would verify the signature against the validator's public key
    Ok(true)
}

impl Bridge {
    pub const INIT_SPACE: usize = 32 + 4 + (32 * 20) + 1 + 8 + 8 + 8 + 1 + 4 + (100 * 50);
}

impl LockRecord {
    pub const INIT_SPACE: usize = 8 + 32 + 33 + 8 + 8 + 32 + 8 + 1 + 33;
}

impl MintRecord {
    pub const INIT_SPACE: usize = 8 + 8 + 32 + 32 + 33 + 8 + 8 + 1;
}

impl BurnRecord {
    pub const INIT_SPACE: usize = 8 + 32 + 32 + 8 + 8 + 32 + 8 + 1 + 33;
} 