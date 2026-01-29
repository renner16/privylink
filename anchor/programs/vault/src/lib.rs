use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use sha2::{Sha256, Digest};
use std::convert::TryInto;

#[cfg(test)]
mod tests;

declare_id!("98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W");

#[program]
pub mod vault {
    use super::*;

    /// Creates a private deposit that can only be claimed with the correct secret code.
    /// 
    /// # Arguments
    /// * `ctx` - Context containing depositor, deposit account, and system program
    /// * `deposit_id` - Unique identifier for this deposit (typically timestamp from frontend)
    /// * `amount` - Amount of SOL to deposit (in lamports)
    /// * `claim_hash` - SHA256 hash of the secret code (32 bytes)
    /// 
    /// # Returns
    /// * `u64` - The deposit_id used to identify this deposit
    /// 
    /// # Note
    /// The deposit_id should be generated on the frontend (e.g., using Date.now() or timestamp)
    /// and passed to this function, as it's needed for PDA derivation before the function executes.
    pub fn create_private_deposit(
        ctx: Context<CreatePrivateDeposit>,
        deposit_id: u64,
        amount: u64,
        claim_hash: [u8; 32],
    ) -> Result<u64> {

        // Validate amount is sufficient to cover rent + deposit
        let rent = Rent::get()?;
        let rent_required = rent.minimum_balance(82); // 82 bytes for PrivateDeposit account
        require!(
            amount > rent_required,
            PrivyLinkError::InvalidAmount
        );

        // Transfer SOL from depositor to deposit account
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.depositor.to_account_info(),
                    to: ctx.accounts.deposit.to_account_info(),
                },
            ),
            amount,
        )?;

        // Initialize deposit account with data
        let deposit = &mut ctx.accounts.deposit;
        deposit.depositor = ctx.accounts.depositor.key();
        deposit.claim_hash = claim_hash;
        deposit.amount = amount;
        deposit.claimed = false;
        deposit.bump = ctx.bumps.deposit;

        Ok(deposit_id)
    }

    /// Claims a private deposit by providing the correct secret code.
    /// 
    /// # Arguments
    /// * `ctx` - Context containing claimer, deposit account, and system program
    /// * `deposit_id` - The ID of the deposit to claim
    /// * `secret` - The secret code (will be hashed and compared to claim_hash)
    /// 
    /// # Returns
    /// * `Result<()>` - Success if secret is correct and deposit not already claimed
    pub fn claim_deposit(
        ctx: Context<ClaimDeposit>,
        deposit_id: u64,
        secret: String,
    ) -> Result<()> {
        let deposit = &ctx.accounts.deposit;

        // Validate deposit hasn't been claimed yet
        require!(!deposit.claimed, PrivyLinkError::AlreadyClaimed);

        // Calculate SHA256 hash of the provided secret
        let secret_bytes = secret.as_bytes();
        let mut hasher = Sha256::new();
        hasher.update(secret_bytes);
        let hash_result = hasher.finalize();
        let calculated_hash_bytes: [u8; 32] = hash_result.as_slice().try_into()
            .map_err(|_| PrivyLinkError::InvalidSecret)?;

        // Validate the hash matches the stored claim_hash
        require!(
            calculated_hash_bytes == deposit.claim_hash,
            PrivyLinkError::InvalidSecret
        );

        // Get the amount to transfer (store before mutating)
        let amount_to_transfer = deposit.amount;

        // Transfer SOL by directly manipulating lamports
        // This works because the program owns the PDA - no need for System Program CPI
        // System Program transfer doesn't work on accounts with data!
        let deposit_account_info = ctx.accounts.deposit.to_account_info();
        let claimer_account_info = ctx.accounts.claimer.to_account_info();

        **deposit_account_info.try_borrow_mut_lamports()? = deposit_account_info
            .lamports()
            .checked_sub(amount_to_transfer)
            .ok_or(PrivyLinkError::InvalidAmount)?;

        **claimer_account_info.try_borrow_mut_lamports()? = claimer_account_info
            .lamports()
            .checked_add(amount_to_transfer)
            .ok_or(PrivyLinkError::InvalidAmount)?;

        // Mark deposit as claimed to prevent double-spending
        let deposit = &mut ctx.accounts.deposit;
        deposit.claimed = true;

        Ok(())
    }
}

/// Account structure that stores private deposit information.
/// 
/// Each deposit has a unique PDA derived from:
/// - "deposit" seed
/// - depositor's public key
/// - deposit_id (timestamp)
#[account]
pub struct PrivateDeposit {
    /// Public key of the user who created this deposit
    pub depositor: Pubkey,      // 32 bytes
    /// SHA256 hash of the secret code required to claim
    pub claim_hash: [u8; 32],   // 32 bytes
    /// Amount of SOL deposited (in lamports)
    pub amount: u64,            // 8 bytes
    /// Whether this deposit has been claimed
    pub claimed: bool,          // 1 byte
    /// Bump seed for the PDA
    pub bump: u8,               // 1 byte
}
// Total: 8 (discriminator) + 74 = 82 bytes

/// Context for creating a private deposit.
#[derive(Accounts)]
#[instruction(deposit_id: u64, amount: u64, claim_hash: [u8; 32])]
pub struct CreatePrivateDeposit<'info> {
    /// The user creating the deposit (must sign and pay for account creation)
    #[account(mut)]
    pub depositor: Signer<'info>,

    /// The deposit account (PDA) that will store the deposit data and SOL
    /// PDA is derived from: ["deposit", depositor.key(), deposit_id]
    #[account(
        init,
        payer = depositor,
        space = 8 + 32 + 32 + 8 + 1 + 1, // 82 bytes total
        seeds = [
            b"deposit",
            depositor.key().as_ref(),
            &deposit_id.to_le_bytes()
        ],
        bump
    )]
    pub deposit: Account<'info, PrivateDeposit>,

    /// System program for account creation and SOL transfers
    pub system_program: Program<'info, System>,
}

/// Context for claiming a private deposit.
#[derive(Accounts)]
#[instruction(deposit_id: u64, secret: String)]
pub struct ClaimDeposit<'info> {
    /// The user claiming the deposit (must sign)
    #[account(mut)]
    pub claimer: Signer<'info>,

    /// The deposit account being claimed
    #[account(
        mut,
        seeds = [
            b"deposit",
            deposit.depositor.as_ref(),
            &deposit_id.to_le_bytes()
        ],
        bump = deposit.bump,
        constraint = !deposit.claimed @ PrivyLinkError::AlreadyClaimed
    )]
    pub deposit: Account<'info, PrivateDeposit>,

    /// System program for SOL transfers
    pub system_program: Program<'info, System>,
}

/// Custom error codes for PrivyLink operations.
#[error_code]
pub enum PrivyLinkError {
    /// Attempted to claim a deposit that has already been claimed
    #[msg("Deposit already claimed")]
    AlreadyClaimed,
    /// The provided secret code does not match the deposit's claim_hash
    #[msg("Invalid secret code")]
    InvalidSecret,
    /// The deposit amount is insufficient (must cover rent + deposit)
    #[msg("Invalid amount")]
    InvalidAmount,
}
