# Simclone — active agent guide

Always read `GAME_PLAN.md`, `docs/STATUS.md`, `docs/NEXT_STEPS.md`, current `main`, open PRs and the exact Success Contract before changing code.

A handoff or old PR is never source of truth over the current repository.

## Current released baseline

Released main:

`3ab58da6289a28dbdde3656ce5d8285f1656ad8f`

Governor v1 GOV0–GOV6 is released and Pages #79 passed on that exact SHA.

Current separate in-flight work:
- PR #123 — Khet Sila rules
- PR #124 — VAL4 outcome verification shadow

Do not overwrite, force-push, rebase away or silently duplicate those branches.

## Authority and safety

- Engine simulation is deterministic: no DOM, wall-clock Date/time, Math.random as a simulation rule, per-tick LLM calls or external APIs.
- UI reads state and dispatches validated commands. UI is never simulation truth.
- Existing scheduler / task reservations / executors remain authoritative.
- Do not create duplicate resource, item, household, relationship, settlement, governance or task writers.
- Skills and knowledge keep provenance.
- Personal cognition uses owned/observed evidence, not hidden World Truth.
- Home ownership derives from authoritative construction provenance.
- Governor is an office, not a productive profession and not a property owner.
- Settlement and Governance are separate authorities.
- VACANT Governor office is a valid state.
- Preserve old-save compatibility and corrupt-save recovery.

## Verification method

Use VIP / VRR:

`Success Contract → Candidate(s) → Evidence / Verification → SAT / VIOL / UNKNOWN → Repair / Reselect → Prove → Execute → Post-verify`

UNKNOWN is never PASS.

## CI and release handoff

Routine PR verification:
- `npm test`
- active Chromium UI smoke
- Independent desktop smoke

Exact-main Pages:
- active regressions
- Independent native desktop smoke
- deployment
- exact public-byte check

Manual `Full Regression Proofs` owns:
- 120-year continuity
- full browser matrices
- archived heavy regression suites

Do not move a failing proof out of a gate merely to make CI green. A proof may be moved only when the evidence scope remains explicitly available elsewhere and the release contract still protects publication.

After pushing a candidate, provide its Actions URL once and stop polling. Re-check only when the user asks.

## Branch discipline

- Re-read branch heads before writes.
- Never force push.
- Never overwrite another agent branch.
- Rebuild stale work on current main instead of merging obsolete stacked branches.
- Runtime changes require refreshed browser import-map pins.
