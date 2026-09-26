# IC7A — Household Recruitment + Cooperation Work State

Status: IMPLEMENTATION CANDIDATE / VERIFY PENDING  
Branch: `feature/ic7a-household-recruitment-authority`  
Base: `main@14c0ef4e61666f5212f7f2fb2c00aa078695651d` after IC6C PR #100 squash merge  
Contract: `docs/IC7A_RECRUITMENT_COOPERATION_SUCCESS_CONTRACT.md`

## Implemented

- K4 labor offers now include `forager → food`.
- `src/household-recruitment-authority.mjs`
  - `recruitmentDecisionsForCandidate()`
  - `recruitmentDecision()`
  - `stepHouseholdRecruitment()`
- deterministic recruitment cadence every 60 ticks;
- frozen decision ranking: urgency → offer priority → relationship score → lower leader id → role → candidate id final tie-break;
- work-preference affects willingness at normal urgency but does not outrank the frozen decision order;
- at most one autonomous adult JOIN per cycle;
- willingness requires:
  - existing relationship-backed candidate;
  - available Leadership slot;
  - no complete owned home / no active residence;
  - matching work preference OR high/critical household need;
- execution reuses `joinHousehold()`;
- residence `joinReason` records `recruitment:<role>`;
- real resident FORAGE/WOODCUT/MINE output writes bounded owner→worker Trust + Respect evidence;
- no social evidence from merely joining.

## Visible gameplay

House dialog shows:
- labor shortage role;
- urgency;
- candidate count;
- available follower slots.

## Authored proof

- food shortage creates forager offer;
- nearby stranger excluded;
- high/critical need accepts a relationship-backed off-preference candidate;
- K4 emits all required roles: forager / woodcutter / miner / builder;
- deterministic one-per-cycle auto JOIN with relationship score ahead of work-preference;
- engine tick 60 activation;
- Leadership-full suppression;
- real productive work creates cooperation evidence once per action/year;
- save/load retains recruited residence deterministically;
- browser fixture exposes food recruitment pressure.

## Deferred

- wages/money;
- explicit work contracts;
- trade execution/cargo;
- faction/settlement membership;
- organization persistence separate from household.

UNKNOWN is not PASS.

## Verification state

- Integration/base alignment: SAT — non-force merge commit aligned the branch with `main@14c0ef4e` without changing the IC7A tree.
- Contract review repair: SAT — implementation ranking now matches the frozen Success Contract.
- Exact candidate CI / browser proof: UNKNOWN until the current head workflow completes.
- Public release: UNKNOWN; IC7A is not merged or released.
