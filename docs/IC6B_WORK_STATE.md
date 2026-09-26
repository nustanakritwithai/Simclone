# IC6B — Adult Cohabitation Work State

Status: PREPARED / STACKED ON IC6A  
Branch: `feature/ic6b-cohabitation-prep`  
Base dependency: `feature/ic6-social-household` / PR #89  
Contract: `docs/IC6B_COHABITATION_SUCCESS_CONTRACT.md`

## Goal

Prepare an evidence-gated share-home planner without activating residency mutation before IC6A relationship authority is SAT.

## Implemented preparation

- Pure planner: `src/cohabitation.mjs`
- Requires:
  - homeless productive subject
  - productive owner with complete owned home
  - persisted IC6A relationship thresholds
  - no direct parent↔adult-child auto-cohabitation
- Proximity alone never qualifies.
- Candidate score is deterministic and evidence-backed.
- Planner returns houseId, ownerId, score and relationship evidence IDs.
- No move/share-home/leave-home command yet.
- No resource sharing or ownership transfer.

## Authored tests

`tests/cohabitation.test.mjs` proves:
- nearby stranger is rejected;
- threshold evidence produces candidate;
- subject with own home is rejected;
- direct adult parent-child is rejected;
- deterministic ranking between multiple eligible owners.

## Activation after IC6A SAT

1. Add explicit authoritative `JOIN_HOUSEHOLD` / `LEAVE_HOUSEHOLD` transition.
2. Persist residence decision separately from physical house ownership.
3. Household projection includes explicit cohabitants + guardian dependents.
4. Personal resources remain personal until cooperation/trade gate.
5. Leaving household does not transfer house ownership.
6. Save/load and death/owner-loss behavior must be explicit.

## Validation state

Preparation candidate only. UNKNOWN is not PASS.
