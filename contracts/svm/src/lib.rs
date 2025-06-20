//! Placeholder for SVM PDA-based program
// TODO: Implement PDA-based wallet and program-initiated transaction logic 

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
    program_error::ProgramError,
    instruction::{AccountMeta, Instruction},
    signature::Signature,
    hash::hashv,
};
use borsh::{BorshDeserialize, BorshSerialize};

// Define the program's instruction enum
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum WalletInstruction {
    /// Initializes a new PDA-based wallet.
    /// Accounts:
    /// 0. `[signer]` Payer for the new wallet account.
    /// 1. `[writable]` New wallet account (PDA).
    /// 2. `[]` System program.
    InitializeWallet { owner: Pubkey, seed: u64 },
    /// Executes a transaction from the wallet.
    /// Accounts:
    /// 0. `[signer]` Wallet account (PDA).
    /// 1. `[]` Target program to call.
    /// Remaining accounts are for the target instruction.
    ExecuteTransaction { instruction_data: Vec<u8>, account_metas: Vec<AccountMeta> },
    /// Validates a user operation.
    /// Accounts:
    /// 0. `[signer]` Wallet account (PDA).
    ValidateUserOp { user_op_hash: [u8; 32], signature: [u8; 64] },
}

// Define the wallet account state
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct WalletAccount {
    pub owner: Pubkey,
    pub initialized: bool,
    pub nonce: u64,
    // TODO: Add more fields like guardians, etc.
}

// Declare the program entrypoint
entrypoint!(process_instruction);

// Program entrypoint logic
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("SVM Program Entrypoint");

    let instruction = WalletInstruction::try_from_slice(instruction_data)?;

    match instruction {
        WalletInstruction::InitializeWallet { owner, seed } => {
            msg!("Instruction: InitializeWallet");
            let accounts_iter = &mut accounts.iter();

            let payer = next_account_info(accounts_iter)?;
            let wallet_account = next_account_info(accounts_iter)?;
            let system_program = next_account_info(accounts_iter)?;

            // Derive the PDA for the wallet account
            let (pda, bump_seed) = Pubkey::find_program_address(
                &[owner.as_ref(), &seed.to_le_bytes()],
                program_id,
            );

            // Verify that the provided wallet_account is indeed the PDA
            if pda != *wallet_account.key {
                return Err(ProgramError::InvalidSeeds);
            }

            // Calculate rent exemption
            let account_len = WalletAccount::LEN;
            let rent_exemption_lamports = Rent::get()?.minimum_balance(account_len);

            // Create the account via invoke_signed as PDA cannot sign directly
            invoke_signed(
                &system_instruction::create_account(
                    payer.pubkey(),
                    wallet_account.pubkey(),
                    rent_exemption_lamports,
                    account_len as u64,
                    program_id,
                ),
                &[
                    payer.clone(),
                    wallet_account.clone(),
                    system_program.clone(),
                ],
                &[&[owner.as_ref(), &seed.to_le_bytes(), &[bump_seed]]],
            )?;

            let mut wallet_data = WalletAccount {
                owner,
                initialized: true,
                nonce: 0,
            };
            wallet_data.serialize(&mut &mut wallet_account.data.borrow_mut()[..])?;

            msg!("Wallet initialized for owner: {:?}, PDA: {:?}", owner, pda);
        }
        WalletInstruction::ExecuteTransaction { instruction_data, account_metas } => {
            msg!("Instruction: ExecuteTransaction");
            let accounts_iter = &mut accounts.iter();

            let wallet_account = next_account_info(accounts_iter)?;
            let target_program = next_account_info(accounts_iter)?;

            // Ensure the wallet account is initialized and is the PDA for the owner
            let mut wallet_data = WalletAccount::try_from_slice(&wallet_account.data.borrow())?;
            if !wallet_data.initialized || wallet_data.owner != wallet_account.owner {
                return Err(ProgramError::InvalidAccountData);
            }

            // Reconstruct the instruction to be invoked
            let instruction = Instruction {
                program_id: *target_program.key,
                accounts: account_metas,
                data: instruction_data,
            };

            // Invoke the instruction signed by the PDA
            // The wallet_account must be the first signer in the `accounts` slice passed to invoke_signed.
            // The PDA seeds are derived using the owner and nonce to ensure unique signing authority for each transaction.
            let (_, bump_seed) = Pubkey::find_program_address(
                &[wallet_data.owner.as_ref(), &wallet_data.nonce.to_le_bytes()],
                program_id,
            );
            let signer_seeds = &[wallet_data.owner.as_ref(), &wallet_data.nonce.to_le_bytes(), &[bump_seed]];

            invoke_signed(
                &instruction,
                accounts,
                &[signer_seeds],
            )?;

            // Increment nonce after successful execution
            wallet_data.nonce += 1;
            wallet_data.serialize(&mut &mut wallet_account.data.borrow_mut()[..])?;
        }
        WalletInstruction::ValidateUserOp { user_op_hash, signature } => {
            msg!("Instruction: ValidateUserOp");
            let accounts_iter = &mut accounts.iter();
            let wallet_account = next_account_info(accounts_iter)?;

            let mut wallet_data = WalletAccount::try_from_slice(&wallet_account.data.borrow())?;

            // Nonce validation
            // For now, we assume user_op_hash includes the nonce and it's handled implicitly
            // A more robust implementation might involve a separate nonce check or mapping.

            // Signature validation
            // Verify the signature against the wallet's owner (public key)
            wallet_data.owner.verify(&user_op_hash, &Signature::new(&signature))
                .map_err(|_| ProgramError::InvalidSignature)?;

            msg!("Signature verified for owner: {:?}", wallet_data.owner);

            // Increment nonce after successful validation
            wallet_data.nonce += 1;
            wallet_data.serialize(&mut &mut wallet_account.data.borrow_mut()[..])?;
        }
    }

    Ok(())
}

impl WalletAccount {
    pub const LEN: usize = 32 + 1 + 8; // Pubkey + bool + u64
} 