//! NexusDeFi SVM Entry Point Program
//! 
//! This program serves as the central coordinator for user operations on Solana,
//! providing functionality similar to ERC-4337 EntryPoint contract:
//! - User operation validation and execution
//! - Paymaster integration for sponsored transactions
//! - Bundler support for batch operations
//! - Stake management for paymasters

use anchor_lang::prelude::*;

declare_id!("9tPUcx4o8kjtCioPepUqhBozAY3SjTGkgJyxfhxVJEHo");

#[program]
pub mod nexus_entry_point {
    use super::*;

    /// Initialize the entry point
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let entry_point = &mut ctx.accounts.entry_point;
        
        entry_point.authority = ctx.accounts.authority.key();
        entry_point.total_operations = 0;
        entry_point.total_paymasters = 0;
        entry_point.min_stake = 1_000_000_000; // 1 SOL minimum stake
        entry_point.unstake_delay = 86400; // 24 hours
        
        emit!(EntryPointInitialized {
            entry_point: entry_point.key(),
            authority: entry_point.authority,
        });
        
        Ok(())
    }

    /// Handle a batch of user operations
    pub fn handle_ops(
        ctx: Context<HandleOps>,
        user_ops: Vec<UserOperation>,
        beneficiary: Pubkey,
    ) -> Result<()> {
        let entry_point = &mut ctx.accounts.entry_point;
        let bundler = &ctx.accounts.bundler;
        
        let mut successful_ops = 0;
        let mut total_gas_used = 0;
        
        for user_op in user_ops.iter() {
            match process_user_operation(user_op, bundler.key()) {
                Ok(gas_used) => {
                    successful_ops += 1;
                    total_gas_used += gas_used;
                    
                    emit!(UserOperationEvent {
                        user_op_hash: calculate_user_op_hash(user_op)?,
                        sender: user_op.sender,
                        paymaster: extract_paymaster(&user_op.paymaster_and_data),
                        nonce: user_op.nonce,
                        success: true,
                        actual_gas_cost: gas_used,
                        actual_gas_used: gas_used,
                    });
                }
                Err(_) => {
                    emit!(UserOperationEvent {
                        user_op_hash: calculate_user_op_hash(user_op)?,
                        sender: user_op.sender,
                        paymaster: extract_paymaster(&user_op.paymaster_and_data),
                        nonce: user_op.nonce,
                        success: false,
                        actual_gas_cost: 0,
                        actual_gas_used: 0,
                    });
                }
            }
        }
        
        entry_point.total_operations += user_ops.len() as u64;
        
        emit!(BatchProcessed {
            beneficiary,
            total_operations: user_ops.len() as u8,
            successful_operations: successful_ops,
            total_gas_used,
        });
        
        Ok(())
    }

    /// Simulate validation of a user operation
    pub fn simulate_validation(
        _ctx: Context<SimulateValidation>,
        user_op: UserOperation,
    ) -> Result<()> {
        let validation_result = validate_user_operation(&user_op)?;
        
        emit!(ValidationSimulated {
            user_op_hash: calculate_user_op_hash(&user_op)?,
            sender: user_op.sender,
            validation_result,
        });
        
        Ok(())
    }

    /// Add stake for a paymaster
    pub fn add_stake(
        ctx: Context<AddStake>,
        unstake_delay: i64,
    ) -> Result<()> {
        let paymaster_stake = &mut ctx.accounts.paymaster_stake;
        let entry_point = &ctx.accounts.entry_point;
        let paymaster = &ctx.accounts.paymaster;
        let deposit = &ctx.accounts.deposit;
        
        require!(unstake_delay >= entry_point.unstake_delay, EntryPointError::InvalidUnstakeDelay);
        
        paymaster_stake.paymaster = paymaster.key();
        paymaster_stake.stake = **deposit.lamports.borrow();
        paymaster_stake.unstake_delay = unstake_delay;
        paymaster_stake.withdraw_time = 0;
        
        emit!(StakeAdded {
            paymaster: paymaster.key(),
            stake: paymaster_stake.stake,
            unstake_delay,
        });
        
        Ok(())
    }

    /// Unlock stake for withdrawal
    pub fn unlock_stake(ctx: Context<UnlockStake>) -> Result<()> {
        let paymaster_stake = &mut ctx.accounts.paymaster_stake;
        
        let current_time = Clock::get()?.unix_timestamp;
        paymaster_stake.withdraw_time = current_time + paymaster_stake.unstake_delay;
        
        emit!(StakeUnlocked {
            paymaster: paymaster_stake.paymaster,
            withdraw_time: paymaster_stake.withdraw_time,
        });
        
        Ok(())
    }

    /// Withdraw unlocked stake
    pub fn withdraw_stake(
        ctx: Context<WithdrawStake>,
        withdraw_address: Pubkey,
    ) -> Result<()> {
        let paymaster_stake = &ctx.accounts.paymaster_stake;
        let current_time = Clock::get()?.unix_timestamp;
        
        require!(
            paymaster_stake.withdraw_time > 0 && current_time >= paymaster_stake.withdraw_time,
            EntryPointError::WithdrawTimeNotReached
        );
        
        let amount = paymaster_stake.stake;
        
        emit!(StakeWithdrawn {
            paymaster: paymaster_stake.paymaster,
            withdraw_address,
            amount,
        });
        
        Ok(())
    }

    /// Get deposit information for an account
    pub fn get_deposit_info(
        ctx: Context<GetDepositInfo>,
    ) -> Result<DepositInfo> {
        let account_info = &ctx.accounts.account_info;
        let stake_account = &ctx.accounts.stake_account;
        
        let deposit_info = match stake_account {
            Some(stake) => DepositInfo {
                deposit: **account_info.lamports.borrow(),
                staked: stake.stake,
                stake_delay: stake.unstake_delay,
                withdraw_time: stake.withdraw_time,
            },
            None => DepositInfo {
                deposit: **account_info.lamports.borrow(),
                staked: 0,
                stake_delay: 0,
                withdraw_time: 0,
            },
        };
        
        Ok(deposit_info)
    }
}

// Account Structures
#[account]
#[derive(InitSpace)]
pub struct EntryPoint {
    pub authority: Pubkey,           // 32
    pub total_operations: u64,       // 8
    pub total_paymasters: u64,       // 8
    pub min_stake: u64,             // 8
    pub unstake_delay: i64,         // 8
}

#[account]
#[derive(InitSpace)]
pub struct PaymasterStake {
    pub paymaster: Pubkey,          // 32
    pub stake: u64,                 // 8
    pub unstake_delay: i64,         // 8
    pub withdraw_time: i64,         // 8
}

// Data Structures
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
pub enum ValidationResult {
    Valid,
    InvalidSignature,
    InvalidNonce,
    InsufficientFunds,
    PaymasterRejected,
    GasLimitExceeded,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct DepositInfo {
    pub deposit: u64,
    pub staked: u64,
    pub stake_delay: i64,
    pub withdraw_time: i64,
}

// Context Structures
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + EntryPoint::INIT_SPACE,
        seeds = [b"entry_point"],
        bump
    )]
    pub entry_point: Account<'info, EntryPoint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct HandleOps<'info> {
    #[account(mut)]
    pub entry_point: Account<'info, EntryPoint>,
    
    pub bundler: Signer<'info>,
}

#[derive(Accounts)]
pub struct SimulateValidation<'info> {
    pub entry_point: Account<'info, EntryPoint>,
}

#[derive(Accounts)]
pub struct AddStake<'info> {
    #[account(
        init,
        payer = paymaster,
        space = 8 + PaymasterStake::INIT_SPACE,
        seeds = [b"paymaster_stake", paymaster.key().as_ref()],
        bump
    )]
    pub paymaster_stake: Account<'info, PaymasterStake>,
    
    pub entry_point: Account<'info, EntryPoint>,
    
    #[account(mut)]
    pub paymaster: Signer<'info>,
    
    #[account(mut)]
    pub deposit: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnlockStake<'info> {
    #[account(
        mut,
        seeds = [b"paymaster_stake", paymaster.key().as_ref()],
        bump,
        has_one = paymaster
    )]
    pub paymaster_stake: Account<'info, PaymasterStake>,
    
    pub paymaster: Signer<'info>,
}

#[derive(Accounts)]
pub struct WithdrawStake<'info> {
    #[account(
        mut,
        seeds = [b"paymaster_stake", paymaster.key().as_ref()],
        bump,
        has_one = paymaster,
        close = paymaster
    )]
    pub paymaster_stake: Account<'info, PaymasterStake>,
    
    pub paymaster: Signer<'info>,
    
    #[account(mut)]
    /// CHECK: This account will receive the withdrawn stake
    pub withdraw_to: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct GetDepositInfo<'info> {
    /// CHECK: Account to get deposit info for
    pub account_info: AccountInfo<'info>,
    
    pub stake_account: Option<Account<'info, PaymasterStake>>,
}

// Events
#[event]
pub struct EntryPointInitialized {
    pub entry_point: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct UserOperationEvent {
    pub user_op_hash: [u8; 32],
    pub sender: Pubkey,
    pub paymaster: Option<Pubkey>,
    pub nonce: u64,
    pub success: bool,
    pub actual_gas_cost: u64,
    pub actual_gas_used: u64,
}

#[event]
pub struct BatchProcessed {
    pub beneficiary: Pubkey,
    pub total_operations: u8,
    pub successful_operations: u8,
    pub total_gas_used: u64,
}

#[event]
pub struct ValidationSimulated {
    pub user_op_hash: [u8; 32],
    pub sender: Pubkey,
    pub validation_result: ValidationResult,
}

#[event]
pub struct StakeAdded {
    pub paymaster: Pubkey,
    pub stake: u64,
    pub unstake_delay: i64,
}

#[event]
pub struct StakeUnlocked {
    pub paymaster: Pubkey,
    pub withdraw_time: i64,
}

#[event]
pub struct StakeWithdrawn {
    pub paymaster: Pubkey,
    pub withdraw_address: Pubkey,
    pub amount: u64,
}

// Error Definitions
#[error_code]
pub enum EntryPointError {
    #[msg("Invalid unstake delay")]
    InvalidUnstakeDelay,
    #[msg("Withdraw time not reached")]
    WithdrawTimeNotReached,
    #[msg("Invalid user operation")]
    InvalidUserOperation,
    #[msg("Insufficient gas")]
    InsufficientGas,
    #[msg("Paymaster validation failed")]
    PaymasterValidationFailed,
    #[msg("Invalid signature")]
    InvalidSignature,
    #[msg("Invalid nonce")]
    InvalidNonce,
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

fn process_user_operation(user_op: &UserOperation, _bundler: Pubkey) -> Result<u64> {
    // Validate user operation
    validate_user_operation(user_op)?;
    
    // Execute the operation
    // This would involve calling the target program with the user operation data
    
    // Return gas used (simplified)
    Ok(user_op.call_gas_limit)
}

fn validate_user_operation(user_op: &UserOperation) -> Result<ValidationResult> {
    // Basic validation
    if user_op.call_gas_limit == 0 {
        return Ok(ValidationResult::GasLimitExceeded);
    }
    
    if user_op.max_fee_per_gas == 0 {
        return Ok(ValidationResult::InsufficientFunds);
    }
    
    // Additional validation logic would go here
    Ok(ValidationResult::Valid)
}

fn extract_paymaster(paymaster_and_data: &[u8]) -> Option<Pubkey> {
    if paymaster_and_data.len() >= 32 {
        let mut pubkey_bytes = [0u8; 32];
        pubkey_bytes.copy_from_slice(&paymaster_and_data[..32]);
        Some(Pubkey::from(pubkey_bytes))
    } else {
        None
    }
}

impl EntryPoint {
    pub const INIT_SPACE: usize = 32 + 8 + 8 + 8 + 8;
}

impl PaymasterStake {
    pub const INIT_SPACE: usize = 32 + 8 + 8 + 8 + 1;
} 