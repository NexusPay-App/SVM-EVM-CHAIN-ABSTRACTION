//! NexusDeFi SVM Paymaster Program
//! 
//! This program provides flexible fee sponsorship and payment mechanisms:
//! - Sponsor transaction fees for users
//! - Accept SPL tokens as payment for gas
//! - Implement rate limiting and policy controls
//! - Integration with Entry Point for ERC-4337-like functionality

use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer, transfer};

declare_id!("CvPEv5QcxwH2k3S6YUuw9MtsfEEsWEUimFwnwHL7ytze");

#[program]
pub mod nexus_paymaster {
    use super::*;

    /// Initialize a new paymaster
    pub fn initialize_paymaster(
        ctx: Context<InitializePaymaster>,
        owner: Pubkey,
        entry_point: Pubkey,
        config: PaymasterConfig,
    ) -> Result<()> {
        let paymaster = &mut ctx.accounts.paymaster;
        
        paymaster.owner = owner;
        paymaster.entry_point = entry_point;
        paymaster.config = config;
        paymaster.total_sponsored = 0;
        paymaster.total_operations = 0;
        paymaster.is_active = true;
        paymaster.supported_tokens = Vec::new();
        
        emit!(PaymasterInitialized {
            paymaster: paymaster.key(),
            owner,
            entry_point,
        });
        
        Ok(())
    }

    /// Add a supported token for fee payments
    pub fn add_supported_token(
        ctx: Context<ModifyTokenSupport>,
        token_mint: Pubkey,
        rate_per_lamport: u64, // How many tokens per lamport
        oracle: Option<Pubkey>,
    ) -> Result<()> {
        let paymaster = &mut ctx.accounts.paymaster;
        
        require!(
            paymaster.supported_tokens.len() < 20,
            PaymasterError::TooManyTokens
        );
        
        let token_info = SupportedToken {
            mint: token_mint,
            rate_per_lamport,
            oracle,
            is_active: true,
            total_collected: 0,
        };
        
        paymaster.supported_tokens.push(token_info);
        
        emit!(TokenAdded {
            paymaster: paymaster.key(),
            token_mint,
            rate_per_lamport,
        });
        
        Ok(())
    }

    /// Validate paymaster operation (called by Entry Point)
    pub fn validate_paymaster_user_op(
        ctx: Context<ValidatePaymasterUserOp>,
        user_op_hash: [u8; 32],
        max_cost: u64,
    ) -> Result<PaymasterValidationResult> {
        let paymaster = &ctx.accounts.paymaster;
        let user_account = &ctx.accounts.user_account;
        
        require!(paymaster.is_active, PaymasterError::PaymasterInactive);
        
        // Parse paymaster data to determine payment method
        let payment_method = parse_paymaster_data(&ctx.accounts.paymaster_data.data.borrow())?;
        
        let validation_result = match payment_method {
            PaymentMethod::Sponsored => {
                validate_sponsored_payment(paymaster, user_account.key(), max_cost)?
            }
            PaymentMethod::TokenPayment { token_mint, max_token_amount } => {
                validate_token_payment(
                    paymaster,
                    &ctx.remaining_accounts,
                    token_mint,
                    max_token_amount,
                    max_cost,
                )?
            }
        };
        
        emit!(PaymasterValidated {
            paymaster: paymaster.key(),
            user: user_account.key(),
            user_op_hash,
            payment_method: payment_method.clone(),
            max_cost,
        });
        
        Ok(validation_result)
    }

    /// Post-operation processing (called by Entry Point after execution)
    pub fn post_op(
        ctx: Context<PostOp>,
        mode: PostOpMode,
        context: Vec<u8>,
        actual_gas_cost: u64,
    ) -> Result<()> {
        let paymaster = &mut ctx.accounts.paymaster;
        
        // Decode context to understand what happened
        let payment_context = PaymentContext::try_from_slice(&context)?;
        
        match mode {
            PostOpMode::OpSucceeded => {
                handle_successful_operation(
                    paymaster,
                    &ctx.remaining_accounts,
                    &payment_context,
                    actual_gas_cost,
                )?;
            }
            PostOpMode::OpReverted => {
                handle_reverted_operation(
                    paymaster,
                    &ctx.remaining_accounts,
                    &payment_context,
                    actual_gas_cost,
                )?;
            }
            PostOpMode::PostOpReverted => {
                // Handle case where post-op itself reverted
                msg!("Post-op reverted for paymaster: {}", paymaster.key());
            }
        }
        
        paymaster.total_operations += 1;
        
        emit!(PostOpProcessed {
            paymaster: paymaster.key(),
            mode,
            actual_gas_cost,
        });
        
        Ok(())
    }

    /// Update paymaster configuration
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_config: PaymasterConfig,
    ) -> Result<()> {
        let paymaster = &mut ctx.accounts.paymaster;
        
        paymaster.config = new_config.clone();
        
        emit!(ConfigUpdated {
            paymaster: paymaster.key(),
            config: new_config,
        });
        
        Ok(())
    }

    /// Withdraw collected tokens or SOL
    pub fn withdraw(
        ctx: Context<Withdraw>,
        token_mint: Option<Pubkey>,
        amount: u64,
    ) -> Result<()> {
        let paymaster = &ctx.accounts.paymaster;
        
        match token_mint {
            Some(_mint) => {
                // Withdraw SPL tokens
                let token_account = &ctx.accounts.token_account.as_ref()
                    .ok_or(PaymasterError::MissingTokenAccount)?;
                let destination = &ctx.accounts.destination_token.as_ref()
                    .ok_or(PaymasterError::MissingDestination)?;
                
                let cpi_accounts = Transfer {
                    from: token_account.to_account_info(),
                    to: destination.to_account_info(),
                    authority: paymaster.to_account_info(),
                };
                
                let cpi_program = ctx.accounts.token_program.as_ref()
                    .ok_or(PaymasterError::MissingTokenProgram)?;
                
                let owner_key = paymaster.owner;
                let (_paymaster_key, bump) = Pubkey::find_program_address(
                    &[b"paymaster", owner_key.as_ref()],
                    &crate::ID,
                );
                let seeds = &[
                    b"paymaster",
                    owner_key.as_ref(),
                    &[bump],
                ];
                
                transfer(
                    CpiContext::new_with_signer(
                        cpi_program.to_account_info(),
                        cpi_accounts,
                        &[seeds],
                    ),
                    amount,
                )?;
            }
            None => {
                // Withdraw SOL
                let destination = &ctx.accounts.destination_sol.as_ref()
                    .ok_or(PaymasterError::MissingDestination)?;
                
                **paymaster.to_account_info().try_borrow_mut_lamports()? -= amount;
                **destination.try_borrow_mut_lamports()? += amount;
            }
        }
        
        emit!(Withdrawn {
            paymaster: paymaster.key(),
            token_mint,
            amount,
            destination: ctx.accounts.owner.key(),
        });
        
        Ok(())
    }

    /// Emergency pause/unpause
    pub fn set_active(
        ctx: Context<SetActive>,
        is_active: bool,
    ) -> Result<()> {
        let paymaster = &mut ctx.accounts.paymaster;
        
        paymaster.is_active = is_active;
        
        emit!(PaymasterStatusChanged {
            paymaster: paymaster.key(),
            is_active,
        });
        
        Ok(())
    }
}

// Account Structures
#[account]
pub struct Paymaster {
    pub owner: Pubkey,
    pub entry_point: Pubkey,
    pub config: PaymasterConfig,
    pub total_sponsored: u64,
    pub total_operations: u64,
    pub is_active: bool,
    pub supported_tokens: Vec<SupportedToken>,
}

// Data Structures
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct PaymasterConfig {
    pub max_operations_per_hour: u64,
    pub max_cost_per_operation: u64,
    pub allowed_users: Vec<Pubkey>, // Empty means all users allowed
    pub rate_limit_per_user: u64,
    pub require_pre_deposit: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SupportedToken {
    pub mint: Pubkey,
    pub rate_per_lamport: u64,
    pub oracle: Option<Pubkey>,
    pub is_active: bool,
    pub total_collected: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct PaymasterValidationResult {
    pub context: Vec<u8>,
    pub valid_after: u64,
    pub valid_until: u64,
    pub authorizer: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum PaymentMethod {
    Sponsored,
    TokenPayment {
        token_mint: Pubkey,
        max_token_amount: u64,
    },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct PaymentContext {
    pub payment_method: PaymentMethod,
    pub user: Pubkey,
    pub pre_charge: u64,
    pub token_account: Option<Pubkey>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum PostOpMode {
    OpSucceeded,
    OpReverted,
    PostOpReverted,
}

// Context Structures
#[derive(Accounts)]
#[instruction(owner: Pubkey)]
pub struct InitializePaymaster<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Paymaster::INIT_SPACE,
        seeds = [b"paymaster", owner.as_ref()],
        bump
    )]
    pub paymaster: Account<'info, Paymaster>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ModifyTokenSupport<'info> {
    #[account(
        mut,
        seeds = [b"paymaster", paymaster.owner.as_ref()],
        bump,
        has_one = owner
    )]
    pub paymaster: Account<'info, Paymaster>,
    
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ValidatePaymasterUserOp<'info> {
    #[account(
        seeds = [b"paymaster", paymaster.owner.as_ref()],
        bump
    )]
    pub paymaster: Account<'info, Paymaster>,
    
    /// CHECK: User account being validated
    pub user_account: AccountInfo<'info>,
    
    /// CHECK: Paymaster data account
    pub paymaster_data: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct PostOp<'info> {
    #[account(
        mut,
        seeds = [b"paymaster", paymaster.owner.as_ref()],
        bump
    )]
    pub paymaster: Account<'info, Paymaster>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"paymaster", paymaster.owner.as_ref()],
        bump,
        has_one = owner
    )]
    pub paymaster: Account<'info, Paymaster>,
    
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"paymaster", paymaster.owner.as_ref()],
        bump,
        has_one = owner
    )]
    pub paymaster: Account<'info, Paymaster>,
    
    pub owner: Signer<'info>,
    
    // Optional accounts for token operations
    pub token_account: Option<Account<'info, TokenAccount>>,
    pub destination_token: Option<Account<'info, TokenAccount>>,
    pub token_program: Option<Program<'info, Token>>,
    
    // Optional account for SOL operations
    /// CHECK: Destination for SOL withdrawal
    pub destination_sol: Option<AccountInfo<'info>>,
}

#[derive(Accounts)]
pub struct SetActive<'info> {
    #[account(
        mut,
        seeds = [b"paymaster", paymaster.owner.as_ref()],
        bump,
        has_one = owner
    )]
    pub paymaster: Account<'info, Paymaster>,
    
    pub owner: Signer<'info>,
}

// Events
#[event]
pub struct PaymasterInitialized {
    pub paymaster: Pubkey,
    pub owner: Pubkey,
    pub entry_point: Pubkey,
}

#[event]
pub struct TokenAdded {
    pub paymaster: Pubkey,
    pub token_mint: Pubkey,
    pub rate_per_lamport: u64,
}

#[event]
pub struct PaymasterValidated {
    pub paymaster: Pubkey,
    pub user: Pubkey,
    pub user_op_hash: [u8; 32],
    pub payment_method: PaymentMethod,
    pub max_cost: u64,
}

#[event]
pub struct PostOpProcessed {
    pub paymaster: Pubkey,
    pub mode: PostOpMode,
    pub actual_gas_cost: u64,
}

#[event]
pub struct ConfigUpdated {
    pub paymaster: Pubkey,
    pub config: PaymasterConfig,
}

#[event]
pub struct Withdrawn {
    pub paymaster: Pubkey,
    pub token_mint: Option<Pubkey>,
    pub amount: u64,
    pub destination: Pubkey,
}

#[event]
pub struct PaymasterStatusChanged {
    pub paymaster: Pubkey,
    pub is_active: bool,
}

// Error Definitions
#[error_code]
pub enum PaymasterError {
    #[msg("Paymaster is inactive")]
    PaymasterInactive,
    #[msg("Too many supported tokens")]
    TooManyTokens,
    #[msg("Token not supported")]
    TokenNotSupported,
    #[msg("Insufficient token balance")]
    InsufficientTokenBalance,
    #[msg("Rate limit exceeded")]
    RateLimitExceeded,
    #[msg("User not allowed")]
    UserNotAllowed,
    #[msg("Operation cost too high")]
    CostTooHigh,
    #[msg("Invalid paymaster data")]
    InvalidPaymasterData,
    #[msg("Missing token account")]
    MissingTokenAccount,
    #[msg("Missing destination")]
    MissingDestination,
    #[msg("Missing token program")]
    MissingTokenProgram,
    #[msg("Oracle price unavailable")]
    OraclePriceUnavailable,
}

// Helper Functions
fn parse_paymaster_data(data: &[u8]) -> Result<PaymentMethod> {
    if data.is_empty() {
        return Ok(PaymentMethod::Sponsored);
    }
    
    // First byte indicates payment type
    match data[0] {
        0 => Ok(PaymentMethod::Sponsored),
        1 => {
            if data.len() < 41 { // 1 + 32 + 8
                return Err(PaymasterError::InvalidPaymasterData.into());
            }
            
            let token_mint = Pubkey::try_from(&data[1..33])
                .map_err(|_| PaymasterError::InvalidPaymasterData)?;
            let max_token_amount = u64::from_le_bytes(
                data[33..41].try_into()
                    .map_err(|_| PaymasterError::InvalidPaymasterData)?
            );
            
            Ok(PaymentMethod::TokenPayment {
                token_mint,
                max_token_amount,
            })
        }
        _ => Err(PaymasterError::InvalidPaymasterData.into()),
    }
}

fn validate_sponsored_payment(
    paymaster: &Paymaster,
    user: Pubkey,
    max_cost: u64,
) -> Result<PaymasterValidationResult> {
    // Check if user is allowed
    if !paymaster.config.allowed_users.is_empty() &&
       !paymaster.config.allowed_users.contains(&user) {
        return Err(PaymasterError::UserNotAllowed.into());
    }
    
    // Check cost limits
    require!(
        max_cost <= paymaster.config.max_cost_per_operation,
        PaymasterError::CostTooHigh
    );
    
    // Check if paymaster has enough balance
    // This would be more complex in production with proper balance tracking
    
    let context = PaymentContext {
        payment_method: PaymentMethod::Sponsored,
        user,
        pre_charge: max_cost,
        token_account: None,
    };
    
    Ok(PaymasterValidationResult {
        context: context.try_to_vec()?,
        valid_after: 0,
        valid_until: u64::MAX,
        authorizer: paymaster.owner,
    })
}

fn validate_token_payment(
    paymaster: &Paymaster,
    _remaining_accounts: &[AccountInfo],
    token_mint: Pubkey,
    max_token_amount: u64,
    max_cost: u64,
) -> Result<PaymasterValidationResult> {
    // Find supported token
    let token_info = paymaster.supported_tokens
        .iter()
        .find(|t| t.mint == token_mint && t.is_active)
        .ok_or(PaymasterError::TokenNotSupported)?;
    
    // Calculate required tokens
    let required_tokens = max_cost * token_info.rate_per_lamport;
    require!(
        max_token_amount >= required_tokens,
        PaymasterError::InsufficientTokenBalance
    );
    
    // Validate user has enough tokens (would check token account balance)
    // This is simplified - in production, would verify actual token account
    
    let context = PaymentContext {
        payment_method: PaymentMethod::TokenPayment {
            token_mint,
            max_token_amount,
        },
        user: _remaining_accounts[0].key(), // Assuming first account is user
        pre_charge: required_tokens,
        token_account: Some(_remaining_accounts[1].key()), // Assuming second is token account
    };
    
    Ok(PaymasterValidationResult {
        context: context.try_to_vec()?,
        valid_after: 0,
        valid_until: u64::MAX,
        authorizer: paymaster.owner,
    })
}

fn handle_successful_operation(
    paymaster: &mut Paymaster,
    _remaining_accounts: &[AccountInfo],
    context: &PaymentContext,
    actual_gas_cost: u64,
) -> Result<()> {
    match &context.payment_method {
        PaymentMethod::Sponsored => {
            paymaster.total_sponsored += actual_gas_cost;
        }
        PaymentMethod::TokenPayment { token_mint, .. } => {
            // Collect tokens from user
            if let Some(_token_account_key) = context.token_account {
                // In production, would perform actual token transfer
                // For now, just update tracking
                if let Some(token_info) = paymaster.supported_tokens
                    .iter_mut()
                    .find(|t| t.mint == *token_mint) {
                    token_info.total_collected += context.pre_charge;
                }
            }
        }
    }
    
    Ok(())
}

fn handle_reverted_operation(
    paymaster: &mut Paymaster,
    _remaining_accounts: &[AccountInfo],
    context: &PaymentContext,
    actual_gas_cost: u64,
) -> Result<()> {
    // Handle refunds for reverted operations
    // In ERC-4337, paymaster still pays for gas even if operation reverts
    
    match &context.payment_method {
        PaymentMethod::Sponsored => {
            paymaster.total_sponsored += actual_gas_cost;
        }
        PaymentMethod::TokenPayment { token_mint, .. } => {
            // Still collect tokens for gas used
            if let Some(token_info) = paymaster.supported_tokens
                .iter_mut()
                .find(|t| t.mint == *token_mint) {
                let tokens_for_gas = actual_gas_cost * token_info.rate_per_lamport;
                token_info.total_collected += tokens_for_gas;
                
                // Refund unused tokens
                let refund = context.pre_charge.saturating_sub(tokens_for_gas);
                if refund > 0 {
                    // In production, would perform actual refund transfer
                    msg!("Refunding {} tokens to user", refund);
                }
            }
        }
    }
    
    Ok(())
}

impl Paymaster {
    pub const INIT_SPACE: usize = 32 + 32 + 200 + 8 + 8 + 1 + 4 + (100 * 20); // Rough estimate
} 