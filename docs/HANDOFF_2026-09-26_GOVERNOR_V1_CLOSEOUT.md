# SIMCLONE — GOVERNOR V1 CLOSEOUT HANDOFF

Date: 26 September 2026

Role for next chat/agent: Project Brain + Lead Developer + Supervisor

Repo:
https://github.com/nustanakritwithai/Simclone

Live:
https://nustanakritwithai.github.io/Simclone/

## Source of truth

Released baseline:

`main@3ab58da6289a28dbdde3656ce5d8285f1656ad8f`

Release:
`Governor v1: office, policy, legitimacy, succession and UI`

Exact-main Pages:
- run #79
- SUCCESS
- exact SHA matches main

Governor v1 is SAT / RELEASED.

## What Governor v1 owns

### GOV1 — Candidate
Candidate requires:
- current active Settlement resident
- living productive adult
- Leadership >= 1
- evidence-backed household support
- own household does not count
- support threshold = ceil(current Settlement households / 2)

Deterministic rank:
1. supporting households
2. Respect
3. Trust
4. Leadership
5. evidence count
6. evidence continuity
7. lower agent ID

### GOV2 / GOV5 — Office and succession
- one office per Settlement
- VACANT is valid
- office history is bounded
- death / leaving Settlement / Settlement dormancy vacates
- support loss uses the released grace rule
- succession reuses GOV1 ranking
- changing Governor never transfers house/Household/Settlement ownership
- productive profession is preserved

### GOV3 — Policy
Released policy mapping:
- food → FORAGE
- wood → WOODCUT
- stone → MINE

Policy:
- requires broad Settlement shortage
- has bounded bonus 6 / 9 / 12
- writes no Agent task
- writes no stock
- uses existing scorer / claim / executor
- is weaker than IC7B household cooperation
- is suppressed by survival emergency

### GOV4 — Legitimacy
Legitimacy is a read-only evidence projection.

Resolved policy may write bounded:
- Trust +1
- Respect +1

No automatic negative sentiment is generated.

### GOV6 — UI
Inspector distinguishes:
- productive profession
- Governor office / candidate
- Leadership
- supporting households
- policy
- resolved-policy count

## CI cleanup completed

Routine PR CI no longer runs the 120-year proof every time.

Routine PR:
- unit/regression
- active UI smoke
- Independent desktop smoke

Pages:
- active regressions
- native desktop smoke
- deploy
- public exact-byte proof

Manual Full Regression:
- 120-year continuity
- full browser matrices
- heavy archived regression proofs

The heavy evidence was moved, not deleted.

## Active work owned by other agents

Do not interfere without re-checking:

- PR #123 — Khet Sila separated adventurer rules
- PR #124 — VAL4 outcome verification shadow

## Stale work warning

Old PRs may remain as historical/reference material. Do not merge stale branches directly.

Especially:
- #102 physical household trade — obsolete stacked base; rebuild on released main when resumed
- #84 old UX line
- #74 housing repair line
- #73 BM1 line

## Recommended next sequence

First allow PR #123 / #124 to settle or explicitly re-audit them.

Then choose one new Success Contract.

Likely paths:
1. Governance v2 — council / collective decisions
2. Physical household trade rebuilt on current main
3. Logistics / physical delivery
4. Property / inheritance v2

Do not begin tax / treasury / election / diplomacy / war until dependencies are authoritative.

## Release method

Use:

`Success Contract → Candidate → Verify → SAT/VIOL/UNKNOWN → Repair → Prove → Merge → exact-main Pages → public proof`

UNKNOWN is never PASS.
