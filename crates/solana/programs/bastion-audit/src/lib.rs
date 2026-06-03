use anchor_lang::prelude::*;

declare_id!("A29V5MUVs73y7XBHHxPpPcAW7h4gGHupbDdwYSwA2n9D");

pub const AUDIT_SEED: &str = "bastion_audit";
pub const AGENT_SEED: &str = "bastion_agent";

const MAX_REASONING_LEN: usize = 256;
const MAX_NAME_LEN: usize = 64;
const MAX_ALLOWED_PROGRAMS: usize = 20;

#[program]
pub mod bastion_audit {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let audit_state = &mut ctx.accounts.audit_state;
        audit_state.authority = ctx.accounts.authority.key();
        audit_state.bump = ctx.bumps.audit_state;
        audit_state.total_audits = 0;
        audit_state.allowed_count = 0;
        audit_state.blocked_count = 0;
        audit_state.paused = false;
        audit_state.paused_at = 0;
        audit_state.resumed_at = 0;
        Ok(())
    }

    pub fn log_audit(
        ctx: Context<LogAudit>,
        decision: u8,
        simulation_result: [u8; 32],
        reasoning: String,
        program_id: Option<[u8; 32]>,
    ) -> Result<()> {
        let audit_entry = &mut ctx.accounts.audit_entry;
        audit_entry.authority = ctx.accounts.signer.key();
        audit_entry.timestamp = Clock::get()?.unix_timestamp;
        audit_entry.decision = decision;
        audit_entry.simulation_result = simulation_result;
        audit_entry.reasoning = reasoning;
        audit_entry.program_id = program_id;
        audit_entry.bump = ctx.bumps.audit_entry;

        let audit_state = &mut ctx.accounts.audit_state;
        if decision == 0 {
            audit_state.allowed_count += 1;
        } else {
            audit_state.blocked_count += 1;
        }
        audit_state.total_audits += 1;

        Ok(())
    }

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        capability_bitmask: u64,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        agent.authority = ctx.accounts.signer.key();
        agent.name = name;
        agent.capability_bitmask = capability_bitmask;
        agent.reputation_score = 0;
        agent.delegation_depth = 0;
        agent.registered_at = Clock::get()?.unix_timestamp;
        agent.bump = ctx.bumps.agent;

        emit!(AgentRegistered {
            agent: agent.key(),
            authority: agent.authority,
            name: agent.name.clone(),
        });

        Ok(())
    }

    pub fn update_agent_reputation(ctx: Context<UpdateReputation>, delta: i64) -> Result<()> {
        let agent = &mut ctx.accounts.agent;

        let new_score = i64::try_from(agent.reputation_score)
            .map_err(|_| BastionError::InvalidReputation)?
            .checked_add(delta)
            .ok_or(BastionError::InvalidReputation)?;
        require!(new_score >= 0, BastionError::InvalidReputation);

        agent.reputation_score = new_score as u64;

        emit!(ReputationUpdated {
            agent: agent.key(),
            new_score: agent.reputation_score,
        });

        Ok(())
    }

    pub fn set_policy(
        ctx: Context<SetPolicy>,
        allowed_programs: Vec<[u8; 32]>,
        max_sol_per_tx: u64,
        rate_limit_per_minute: u32,
    ) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        policy.authority = ctx.accounts.signer.key();
        policy.allowed_programs = allowed_programs;
        policy.max_sol_per_tx = max_sol_per_tx;
        policy.rate_limit_per_minute = rate_limit_per_minute;
        policy.bump = ctx.bumps.policy;

        Ok(())
    }

    pub fn emergency_pause(ctx: Context<EmergencyPause>) -> Result<()> {
        let audit_state = &mut ctx.accounts.audit_state;
        require!(!audit_state.paused, BastionError::AlreadyPaused);

        audit_state.paused = true;
        audit_state.paused_at = Clock::get()?.unix_timestamp;

        emit!(ProtocolPaused {
            authority: ctx.accounts.signer.key(),
        });

        Ok(())
    }

    pub fn emergency_resume(ctx: Context<EmergencyResume>) -> Result<()> {
        let audit_state = &mut ctx.accounts.audit_state;
        require!(audit_state.paused, BastionError::NotPaused);

        audit_state.paused = false;
        audit_state.resumed_at = Clock::get()?.unix_timestamp;

        emit!(ProtocolResumed {
            authority: ctx.accounts.signer.key(),
        });

        Ok(())
    }

    pub fn stake_lamports(ctx: Context<StakeLamports>, amount: u64) -> Result<()> {
        let agent_stake = &mut ctx.accounts.agent_stake;

        // Transfer SOL from authority to agent_stake PDA
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.authority.key(),
            &ctx.accounts.agent_stake.to_account_info().key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.agent_stake.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        agent_stake.staked_lamports += amount;
        if agent_stake.stake_started_at == 0 {
            agent_stake.stake_started_at = Clock::get()?.unix_timestamp;
        }

        emit!(StakeChanged {
            authority: ctx.accounts.authority.key(),
            staked_lamports: agent_stake.staked_lamports,
        });

        Ok(())
    }

    pub fn request_unstake(ctx: Context<RequestUnstake>) -> Result<()> {
        let agent_stake = &mut ctx.accounts.agent_stake;
        require!(agent_stake.staked_lamports > 0, BastionError::InsufficientStake);

        let now = Clock::get()?.unix_timestamp;
        require!(
            now - agent_stake.stake_started_at >= 172800, // 48 hours minimum
            BastionError::StakeTooRecent
        );

        agent_stake.unstake_requested_at = now;

        emit!(UnstakeRequested {
            authority: ctx.accounts.authority.key(),
            requested_at: now,
        });

        Ok(())
    }

    pub fn claim_unstake(ctx: Context<ClaimUnstake>) -> Result<()> {
        let agent_stake = &mut ctx.accounts.agent_stake;
        require!(agent_stake.unstake_requested_at > 0, BastionError::NoUnstakeRequested);

        let now = Clock::get()?.unix_timestamp;
        require!(
            now - agent_stake.unstake_requested_at >= 604800, // 7-day cooldown
            BastionError::StakeCooldownNotMet
        );

        let amount = agent_stake.staked_lamports;
        agent_stake.staked_lamports = 0;
        agent_stake.unstake_requested_at = 0;

        // Transfer SOL back to authority
        **ctx.accounts.authority.try_borrow_mut_lamports()? += amount;
        **ctx.accounts.agent_stake.to_account_info().try_borrow_mut_lamports()? -= amount;

        emit!(StakeChanged {
            authority: ctx.accounts.authority.key(),
            staked_lamports: 0,
        });

        Ok(())
    }

    pub fn slash_stake(ctx: Context<SlashStake>, penalty: u64) -> Result<()> {
        let agent_stake = &mut ctx.accounts.agent_stake;
        require!(penalty > 0, BastionError::InvalidReputation);
        require!(agent_stake.staked_lamports >= penalty, BastionError::InsufficientStake);

        agent_stake.staked_lamports -= penalty;
        agent_stake.penalty_accrued += penalty;

        // Transfer slashed SOL to treasury (payer)
        **ctx.accounts.treasury.try_borrow_mut_lamports()? += penalty;
        **ctx.accounts.agent_stake.to_account_info().try_borrow_mut_lamports()? -= penalty;

        emit!(StakeSlashed {
            authority: agent_stake.authority,
            penalty,
            remaining: agent_stake.staked_lamports,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [AUDIT_SEED.as_bytes()],
        bump,
        payer = authority,
        space = 8 + std::mem::size_of::<AuditState>()
    )]
    pub audit_state: Account<'info, AuditState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LogAudit<'info> {
    #[account(
        init,
        seeds = [
            AUDIT_SEED.as_bytes(),
            &audit_state.total_audits.to_le_bytes()
        ],
        bump,
        payer = signer,
        space = 8 + 32 + 8 + 1 + 32 + 4 + MAX_REASONING_LEN + 1 + 32 + 1
    )]
    pub audit_entry: Account<'info, AuditEntry>,
    #[account(
        mut,
        seeds = [AUDIT_SEED.as_bytes()],
        bump = audit_state.bump,
        constraint = signer.key() == audit_state.authority @ BastionError::Unauthorized,
        constraint = !audit_state.paused @ BastionError::IsPaused,
    )]
    pub audit_state: Account<'info, AuditState>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        seeds = [AGENT_SEED.as_bytes(), signer.key().as_ref()],
        bump,
        payer = signer,
        space = 8 + 32 + 4 + MAX_NAME_LEN + 8 + 8 + 1 + 1
    )]
    pub agent: Account<'info, Agent>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateReputation<'info> {
    #[account(
        mut,
        seeds = [AGENT_SEED.as_bytes(), agent.authority.as_ref()],
        bump = agent.bump,
        constraint = signer.key() == agent.authority @ BastionError::Unauthorized,
    )]
    pub agent: Account<'info, Agent>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetPolicy<'info> {
    #[account(
        init_if_needed,
        seeds = [b"bastion_policy".as_ref()],
        bump,
        payer = signer,
        space = 8 + 32 + 4 + (MAX_ALLOWED_PROGRAMS * 32) + 8 + 4 + 1,
        constraint = policy.authority == Pubkey::default() || signer.key() == policy.authority @ BastionError::Unauthorized,
    )]
    pub policy: Account<'info, Policy>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EmergencyPause<'info> {
    #[account(
        mut,
        seeds = [AUDIT_SEED.as_bytes()],
        bump = audit_state.bump,
        constraint = signer.key() == audit_state.authority @ BastionError::Unauthorized
    )]
    pub audit_state: Account<'info, AuditState>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyResume<'info> {
    #[account(
        mut,
        seeds = [AUDIT_SEED.as_bytes()],
        bump = audit_state.bump,
        constraint = signer.key() == audit_state.authority @ BastionError::Unauthorized
    )]
    pub audit_state: Account<'info, AuditState>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct StakeLamports<'info> {
    #[account(
        init,
        seeds = ["agent_stake".as_bytes(), authority.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 8 + 8 + 1
    )]
    pub agent_stake: Account<'info, AgentStake>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestUnstake<'info> {
    #[account(
        mut,
        seeds = ["agent_stake".as_bytes(), authority.key().as_ref()],
        bump = agent_stake.bump,
        constraint = authority.key() == agent_stake.authority @ BastionError::Unauthorized,
    )]
    pub agent_stake: Account<'info, AgentStake>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimUnstake<'info> {
    #[account(
        mut,
        seeds = ["agent_stake".as_bytes(), authority.key().as_ref()],
        bump = agent_stake.bump,
        constraint = authority.key() == agent_stake.authority @ BastionError::Unauthorized,
    )]
    pub agent_stake: Account<'info, AgentStake>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SlashStake<'info> {
    #[account(
        mut,
        seeds = ["agent_stake".as_bytes(), authority.key().as_ref()],
        bump = agent_stake.bump,
        constraint = treasury.key() == audit_state.authority @ BastionError::Unauthorized,
    )]
    pub agent_stake: Account<'info, AgentStake>,
    #[account(
        seeds = [AUDIT_SEED.as_bytes()],
        bump = audit_state.bump,
    )]
    pub audit_state: Account<'info, AuditState>,
    #[account(mut)]
    pub treasury: Signer<'info>,
}

#[account]
#[derive(Debug)]
pub struct AuditState {
    pub authority: Pubkey,
    pub bump: u8,
    pub total_audits: u64,
    pub allowed_count: u64,
    pub blocked_count: u64,
    pub paused: bool,
    pub paused_at: i64,
    pub resumed_at: i64,
}

#[account]
#[derive(Debug)]
pub struct AuditEntry {
    pub authority: Pubkey,
    pub timestamp: i64,
    pub decision: u8,
    pub simulation_result: [u8; 32],
    pub reasoning: String,
    pub program_id: Option<[u8; 32]>,
    pub bump: u8,
}

#[account]
#[derive(Debug)]
pub struct Agent {
    pub authority: Pubkey,
    pub name: String,
    pub capability_bitmask: u64,
    pub reputation_score: u64,
    pub delegation_depth: u8,
    pub registered_at: i64,
    pub bump: u8,
}

#[account]
#[derive(Debug)]
pub struct Policy {
    pub authority: Pubkey,
    pub allowed_programs: Vec<[u8; 32]>,
    pub max_sol_per_tx: u64,
    pub rate_limit_per_minute: u32,
    pub bump: u8,
}

#[account]
#[derive(Debug)]
pub struct AgentStake {
    pub authority: Pubkey,
    pub staked_lamports: u64,
    pub stake_started_at: i64,
    pub unstake_requested_at: i64,
    pub penalty_accrued: u64,
    pub bump: u8,
}

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub authority: Pubkey,
    pub name: String,
}

#[event]
pub struct ReputationUpdated {
    pub agent: Pubkey,
    pub new_score: u64,
}

#[event]
pub struct ProtocolPaused {
    pub authority: Pubkey,
}

#[event]
pub struct ProtocolResumed {
    pub authority: Pubkey,
}

#[event]
pub struct StakeChanged {
    pub authority: Pubkey,
    pub staked_lamports: u64,
}

#[event]
pub struct UnstakeRequested {
    pub authority: Pubkey,
    pub requested_at: i64,
}

#[event]
pub struct StakeSlashed {
    pub authority: Pubkey,
    pub penalty: u64,
    pub remaining: u64,
}

#[error_code]
pub enum BastionError {
    #[msg("Invalid reputation score")]
    InvalidReputation,
    #[msg("Protocol is not paused")]
    NotPaused,
    #[msg("Protocol is paused")]
    IsPaused,
    #[msg("Protocol is already paused")]
    AlreadyPaused,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Insufficient stake for delegation")]
    InsufficientStake,
    #[msg("Stake is too recent to unstake")]
    StakeTooRecent,
    #[msg("Unstake cooldown period not yet met")]
    StakeCooldownNotMet,
    #[msg("No unstake request found")]
    NoUnstakeRequested,
    #[msg("Maximum delegation depth exceeded")]
    MaxDelegationDepth,
}
