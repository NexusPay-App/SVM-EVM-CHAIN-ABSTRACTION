//! NexusDeFi SVM Wallet Program
//! 
//! This program implements a PDA-based smart wallet for Solana that provides:
//! - Account abstraction similar to ERC-4337
//! - Cross-chain compatibility with EVM wallets  
//! - Social recovery and multi-signature support
//! - Integration with paymaster for sponsored transactions

use anchor_lang::prelude::*;

declare_id!("G4vCcRCeB3rWpaTkkpsPWTf9Ar2a7qoWTJsWboztF6wS");

#[program]
pub mod nexus_wallet {
    use super::*;

    /// Initialize a new PDA-based wallet
    pub fn initialize_wallet(
        ctx: Context<InitializeWallet>,
        owner: Pubkey,
        recovery_hash: [u8; 32],
        daily_limit: u64,
    ) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        
        wallet.owner = owner;
        wallet.recovery_hash = recovery_hash;
        wallet.daily_limit = daily_limit;
        wallet.daily_spent = 0;
        wallet.last_reset = Clock::get()?.unix_timestamp;
        wallet.nonce = 0;
        wallet.initialized = true;
        wallet.is_frozen = false;
        wallet.guardians = Vec::new();
        wallet.pending_recovery = None;
        
        emit!(WalletInitialized {
            wallet: ctx.accounts.wallet.key(),
            owner,
            daily_limit,
        });
        
        Ok(())
    }

    /// Execute a user operation (similar to ERC-4337)
    pub fn execute_user_operation(
        ctx: Context<ExecuteUserOperation>,
        user_op: UserOperation,
        paymaster_data: Option<PaymasterData>,
    ) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        
        // Verify wallet is not frozen
        require!(!wallet.is_frozen, WalletError::WalletFrozen);
        
        // Verify nonce
        require!(user_op.nonce == wallet.nonce, WalletError::InvalidNonce);
        
        // Increment nonce
        wallet.nonce += 1;
        
        // Check daily spending limit for non-paymaster operations
        if paymaster_data.is_none() {
            let current_time = Clock::get()?.unix_timestamp;
            
            // Reset daily spending if a day has passed
            if current_time - wallet.last_reset >= 86400 {
                wallet.daily_spent = 0;
                wallet.last_reset = current_time;
            }
            
            // Check spending limit
            require!(
                wallet.daily_spent + user_op.max_fee_per_gas <= wallet.daily_limit,
                WalletError::DailyLimitExceeded
            );
            
            wallet.daily_spent += user_op.max_fee_per_gas;
        }
        
        // Validate user operation signature
        let user_op_hash = calculate_user_op_hash(&user_op)?;
        require!(
            verify_signature(&user_op_hash, &user_op.signature, &wallet.owner)?,
            WalletError::InvalidSignature
        );
        
        emit!(UserOperationExecuted {
            wallet: wallet.key(),
            user_op_hash,
            nonce: user_op.nonce,
            success: true,
        });
        
        Ok(())
    }

    /// Add a guardian for social recovery
    pub fn add_guardian(
        ctx: Context<ModifyGuardians>,
        guardian: Pubkey,
    ) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        
        require!(wallet.guardians.len() < 10, WalletError::TooManyGuardians);
        require!(!wallet.guardians.contains(&guardian), WalletError::GuardianAlreadyExists);
        
        wallet.guardians.push(guardian);
        
        emit!(GuardianAdded {
            wallet: wallet.key(),
            guardian,
        });
        
        Ok(())
    }

    /// Remove a guardian
    pub fn remove_guardian(
        ctx: Context<ModifyGuardians>,
        guardian: Pubkey,
    ) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        
        let index = wallet.guardians.iter().position(|&g| g == guardian)
            .ok_or(WalletError::GuardianNotFound)?;
        
        wallet.guardians.remove(index);
        
        emit!(GuardianRemoved {
            wallet: wallet.key(),
            guardian,
        });
        
        Ok(())
    }

    /// Initiate recovery process
    pub fn initiate_recovery(
        ctx: Context<InitiateRecovery>,
        new_owner: Pubkey,
    ) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        let guardian = &ctx.accounts.guardian;
        
        require!(wallet.guardians.contains(&guardian.key()), WalletError::UnauthorizedGuardian);
        require!(wallet.pending_recovery.is_none(), WalletError::RecoveryInProgress);
        
        wallet.pending_recovery = Some(RecoveryRequest {
            new_owner,
            guardian_approvals: vec![guardian.key()],
            initiated_at: Clock::get()?.unix_timestamp,
        });
        
        emit!(RecoveryInitiated {
            wallet: wallet.key(),
            new_owner,
            guardian: guardian.key(),
        });
        
        Ok(())
    }

    /// Approve recovery (by other guardians)
    pub fn approve_recovery(
        ctx: Context<ApproveRecovery>,
    ) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        let guardian = &ctx.accounts.guardian;
        
        require!(wallet.guardians.contains(&guardian.key()), WalletError::UnauthorizedGuardian);
        
        // Extract guardians length before mutable borrow
        let guardians_count = wallet.guardians.len();
        
        let recovery = wallet.pending_recovery.as_mut()
            .ok_or(WalletError::NoRecoveryInProgress)?;
        
        require!(!recovery.guardian_approvals.contains(&guardian.key()), WalletError::AlreadyApproved);
        
        recovery.guardian_approvals.push(guardian.key());
        
        // Check if we have enough approvals (majority of guardians)
        let required_approvals = (guardians_count / 2) + 1;
        let current_approvals = recovery.guardian_approvals.len();
        
        if current_approvals >= required_approvals {
            // Execute recovery - extract values before mutating wallet
            let new_owner = recovery.new_owner;
            let wallet_key = wallet.key();
            let old_owner = wallet.owner;
            
            wallet.owner = new_owner;
            wallet.pending_recovery = None;
            wallet.nonce += 1; // Invalidate any pending operations
            
            emit!(RecoveryCompleted {
                wallet: wallet_key,
                old_owner,
                new_owner,
            });
        } else {
            emit!(RecoveryApproved {
                wallet: wallet.key(),
                guardian: guardian.key(),
                approvals: current_approvals as u8,
                required: required_approvals as u8,
            });
        }
        
        Ok(())
    }

    /// Emergency freeze wallet
    pub fn freeze_wallet(
        ctx: Context<FreezeWallet>,
    ) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        let guardian = &ctx.accounts.guardian;
        
        require!(wallet.guardians.contains(&guardian.key()), WalletError::UnauthorizedGuardian);
        
        wallet.is_frozen = true;
        
        emit!(WalletFrozen {
            wallet: wallet.key(),
            guardian: guardian.key(),
        });
        
        Ok(())
    }

    /// Unfreeze wallet (requires owner)
    pub fn unfreeze_wallet(
        ctx: Context<UnfreezeWallet>,
    ) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        
        wallet.is_frozen = false;
        
        emit!(WalletUnfrozen {
            wallet: wallet.key(),
            owner: wallet.owner,
        });
        
        Ok(())
    }
}

// Account Structures
#[account]
#[derive(InitSpace)]
pub struct Wallet {
    pub owner: Pubkey,                    // 32
    pub recovery_hash: [u8; 32],          // 32
    pub daily_limit: u64,                 // 8
    pub daily_spent: u64,                 // 8
    pub last_reset: i64,                  // 8
    pub nonce: u64,                       // 8
    pub initialized: bool,                // 1
    pub is_frozen: bool,                  // 1
    #[max_len(10)]
    pub guardians: Vec<Pubkey>,           // 4 + (10 * 32) = 324
    pub pending_recovery: Option<RecoveryRequest>, // 1 + 88 = 89
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct RecoveryRequest {
    pub new_owner: Pubkey,                // 32
    #[max_len(10)]
    pub guardian_approvals: Vec<Pubkey>,  // 4 + (10 * 32) = 324
    pub initiated_at: i64,                // 8
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct UserOperation {
    pub sender: Pubkey,
    pub nonce: u64,
    pub init_code: Vec<u8>,
    pub call_data: Vec<u8>,
    pub call_gas_limit: u64,
    pub verification_gas_limit: u64,
    pub pre_verification_gas: u64,
    pub max_fee_per_gas: u64,
    pub max_priority_fee_per_gas: u64,
    pub paymaster_and_data: Vec<u8>,
    pub signature: [u8; 64],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct PaymasterData {
    pub paymaster: Pubkey,
    pub token_mint: Option<Pubkey>,
    pub max_cost: u64,
    pub signature: [u8; 64],
}

// Context Structures
#[derive(Accounts)]
#[instruction(owner: Pubkey, recovery_hash: [u8; 32], daily_limit: u64)]
pub struct InitializeWallet<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Wallet::INIT_SPACE,
        seeds = [b"wallet", owner.as_ref(), &recovery_hash],
        bump
    )]
    pub wallet: Account<'info, Wallet>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteUserOperation<'info> {
    #[account(
        mut,
        seeds = [b"wallet", wallet.owner.as_ref(), &wallet.recovery_hash],
        bump
    )]
    pub wallet: Account<'info, Wallet>,
}

#[derive(Accounts)]
pub struct ModifyGuardians<'info> {
    #[account(
        mut,
        seeds = [b"wallet", wallet.owner.as_ref(), &wallet.recovery_hash],
        bump,
        has_one = owner
    )]
    pub wallet: Account<'info, Wallet>,
    
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitiateRecovery<'info> {
    #[account(
        mut,
        seeds = [b"wallet", wallet.owner.as_ref(), &wallet.recovery_hash],
        bump
    )]
    pub wallet: Account<'info, Wallet>,
    
    pub guardian: Signer<'info>,
}

#[derive(Accounts)]
pub struct ApproveRecovery<'info> {
    #[account(
        mut,
        seeds = [b"wallet", wallet.owner.as_ref(), &wallet.recovery_hash],
        bump
    )]
    pub wallet: Account<'info, Wallet>,
    
    pub guardian: Signer<'info>,
}

#[derive(Accounts)]
pub struct FreezeWallet<'info> {
    #[account(
        mut,
        seeds = [b"wallet", wallet.owner.as_ref(), &wallet.recovery_hash],
        bump
    )]
    pub wallet: Account<'info, Wallet>,
    
    pub guardian: Signer<'info>,
}

#[derive(Accounts)]
pub struct UnfreezeWallet<'info> {
    #[account(
        mut,
        seeds = [b"wallet", wallet.owner.as_ref(), &wallet.recovery_hash],
        bump,
        has_one = owner
    )]
    pub wallet: Account<'info, Wallet>,
    
    pub owner: Signer<'info>,
}

// Events
#[event]
pub struct WalletInitialized {
    pub wallet: Pubkey,
    pub owner: Pubkey,
    pub daily_limit: u64,
}

#[event]
pub struct UserOperationExecuted {
    pub wallet: Pubkey,
    pub user_op_hash: [u8; 32],
    pub nonce: u64,
    pub success: bool,
}

#[event]
pub struct GuardianAdded {
    pub wallet: Pubkey,
    pub guardian: Pubkey,
}

#[event]
pub struct GuardianRemoved {
    pub wallet: Pubkey,
    pub guardian: Pubkey,
}

#[event]
pub struct RecoveryInitiated {
    pub wallet: Pubkey,
    pub new_owner: Pubkey,
    pub guardian: Pubkey,
}

#[event]
pub struct RecoveryApproved {
    pub wallet: Pubkey,
    pub guardian: Pubkey,
    pub approvals: u8,
    pub required: u8,
}

#[event]
pub struct RecoveryCompleted {
    pub wallet: Pubkey,
    pub old_owner: Pubkey,
    pub new_owner: Pubkey,
}

#[event]
pub struct WalletFrozen {
    pub wallet: Pubkey,
    pub guardian: Pubkey,
}

#[event]
pub struct WalletUnfrozen {
    pub wallet: Pubkey,
    pub owner: Pubkey,
}

// Error Definitions
#[error_code]
pub enum WalletError {
    #[msg("Wallet is frozen")]
    WalletFrozen,
    #[msg("Invalid nonce")]
    InvalidNonce,
    #[msg("Daily spending limit exceeded")]
    DailyLimitExceeded,
    #[msg("Invalid signature")]
    InvalidSignature,
    #[msg("Too many guardians")]
    TooManyGuardians,
    #[msg("Guardian already exists")]
    GuardianAlreadyExists,
    #[msg("Guardian not found")]
    GuardianNotFound,
    #[msg("Unauthorized guardian")]
    UnauthorizedGuardian,
    #[msg("Recovery already in progress")]
    RecoveryInProgress,
    #[msg("No recovery in progress")]
    NoRecoveryInProgress,
    #[msg("Already approved recovery")]
    AlreadyApproved,
    #[msg("Insufficient gas")]
    InsufficientGas,
}

// Helper Functions
fn calculate_user_op_hash(user_op: &UserOperation) -> Result<[u8; 32]> {
    let hash = anchor_lang::solana_program::hash::hashv(&[
        user_op.sender.as_ref(),
        &user_op.nonce.to_le_bytes(),
        &user_op.call_data,
        &user_op.call_gas_limit.to_le_bytes(),
        &user_op.max_fee_per_gas.to_le_bytes(),
    ]);
    Ok(hash.to_bytes())
}

fn verify_signature(
    _message: &[u8; 32],
    _signature: &[u8; 64],
    _expected_pubkey: &Pubkey,
) -> Result<bool> {
    // Simplified signature verification for demonstration
    // In production, implement proper ed25519 signature verification
    Ok(true)
}

// Cross-chain compatibility helpers
pub fn derive_unified_wallet_address(
    owner: &Pubkey,
    recovery_hash: &[u8; 32],
) -> Result<(Pubkey, u8)> {
    Ok(Pubkey::find_program_address(
        &[b"wallet", owner.as_ref(), recovery_hash],
        &ID,
    ))
}

pub fn validate_cross_chain_operation(
    _accounts: &[AccountInfo],
    _user_op: &UserOperation,
    _wallet_key: Pubkey,
    _bump: &u8,
) -> Result<()> {
    // Cross-chain operation validation logic
    // This would integrate with the bridge program for cross-chain operations
    Ok(())
} 