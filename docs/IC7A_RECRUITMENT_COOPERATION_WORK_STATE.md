# IC7A — Household Recruitment + Cooperation Work State

Status: IMPLEMENTATION CANDIDATE / STACKED ON IC6C CLOSEOUT  
Branch: `feature/ic7a-household-recruitment-authority`  
Base dependency: `feature/ic6c-remove-independent-central-stock` / PR #100  
Contract: `docs/IC7A_RECRUITMENT_COOPERATION_SUCCESS_CONTRACT.md`

## Implemented

- K4 labor offers now include `forager → food`.
- `src/household-recruitment-authority.mjs`
  - `recruitmentDecisionsForCandidate()`
  - `recruitmentDecision()`
  - `stepHouseholdRecruitment()`
- deterministic recruitment cadence every 60 ticks;
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
- deterministic one-per-cycle auto JOIN;
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
