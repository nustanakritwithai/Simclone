# IC6B — Adult Cohabitation Work State

Status: IMPLEMENTATION CANDIDATE  
Branch: `feature/ic6b-cohabitation`  
Base: `main@2c186feadf2093ed3e89a4739c6dc171d37d4f73` with IC6A merged  
Contract: `docs/IC6B_COHABITATION_SUCCESS_CONTRACT.md`

## Goal

Allow a homeless productive adult to explicitly join another adult's complete home only when IC6A relationship evidence passes deterministic thresholds.

## Implemented candidate

- Pure planner:
  - `cohabitationCandidates()`
  - `cohabitationCandidate()`
- Explicit commands:
  - `JOIN_HOUSEHOLD`
  - `LEAVE_HOUSEHOLD`
- Social extension upgraded:
  - `IC6-social-2`
  - bounded `social.residences`
  - IC6-social-1 migrates with empty residence history
- Household projection:
  - owner
  - guardian dependents
  - explicit adult cohabitants
- Survival behavior:
  - cohabitant may REST/EAT at shared home
  - food/material balances remain personal
- Home behavior:
  - cohabitation pauses personal-home construction
  - leaving resumes personal-home goal
- Lifecycle:
  - owner/resident death closes active residence links
- Ownership:
  - physical house ownership remains founding Foundation `placedBy`
  - JOIN never transfers house ownership

## Authored proof

- `tests/cohabitation.test.mjs`
  - relationship threshold planner
  - proximity-only rejection
  - own-home exclusion
  - adult parent-child exclusion
  - deterministic ranking
- `tests/household-residence.test.mjs`
  - JOIN/LEAVE authority
  - idempotency and explicit switch requirement
  - shared-home REST
  - personal-food EAT
  - ownership/material isolation
  - personal-home pause/resume
  - owner-death cleanup
  - save/load
  - IC6-social-1 → v2 migration

## Game Studio browser proof

- `scripts/ic6b-browser-fixture.mjs` earns a two-person cohabitation world through real engine commands.
- `tests/independent-ui-smoke.py` verifies:
  - Inspector shows household owner and relationship evidence;
  - cohabiting status is visible;
  - LEAVE routes through engine command;
  - relationship evidence survives leaving;
  - screenshot evidence is captured.
- UI is projection only. JOIN/LEAVE still revalidate in engine authority.

## Explicitly deferred

- automatic adult cohabitation execution;
- romance/partner semantics;
- shared material wallet;
- inheritance/property transfer;
- cooperation/trade;
- neighborhood derivation.

## Validation state

Implementation candidate. Exact CI evidence pending. UNKNOWN is not PASS.
