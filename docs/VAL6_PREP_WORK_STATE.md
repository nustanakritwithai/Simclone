# VAL6 — Preparation Work State

Status: PREPARED / IMPLEMENTATION BLOCKED

## Baseline

Prepared from:

`main@388ddaf32f81429edcb24ba6b6f62ef6135734c7`

VAL5 is merged on this SHA.

VAL5 exact-main release at preparation time:

- Pages run #82
- status: IN PROGRESS
- VAL5 public release: UNKNOWN

Do not implement or merge VAL6 until that exact-main public gate is SAT.

## Audit question

Where can bounded outcome learning affect behavior without creating a second decision or execution authority?

## Runtime evidence

Current candidate pipeline:

```
candidates()
→ add()
→ factors
→ score = sum(factors)
→ decide()
→ claim()
→ rememberPlanSelection()
→ execute()
```

Observed active candidate factors include:

- base
- need
- goal
- skill
- distance
- laborMarket
- householdCooperation
- governorPolicy

The existing score writer is centralized in `src/engine.mjs`.

The existing Inspector reads arbitrary non-zero `trace.factors` and separately verifies `score === factorSum`.

## Classification

- Existing centralized candidate scorer: Matches design.
- VAL5 outcome evidence: Matches read-only design.
- Historical prediction receipts: Validation gap / not retained by VAL3.
- Negative learning from VIOL evidence: Design ambiguity; causal failure class is unavailable.
- Safe initial learning authority: positive-only bounded reinforcement from repeated SAT productive evidence.

## Prepared decision

VAL6 initial authority will use:

```
outcomeLearning = min(4, satCount)
```

only when at least two matching productive retained samples are all SAT, with no VIOL/UNKNOWN and no survival emergency.

No negative penalty is allowed in this gate.

## Collision check

Active separate work remains outside this prep scope:

- Khet Sila PR #123
- stale/reference Household Trade #102
- stale UX #84
- stale Housing #74
- stale BM1 #73

VAL6 prep changes docs only.

Future implementation is expected to touch the candidate scoring path, so current main and open PR changed files must be re-read immediately before coding.

## Next action

After VAL5 Pages #82 is confirmed SAT:

1. Re-read exact current `main`.
2. Re-check open PRs and branch ownership.
3. Sync this prep branch non-force if main advanced.
4. Implement pure learning signal.
5. Add one `outcomeLearning` factor to existing candidate scoring.
6. Run exact candidate CI.
7. Merge only after SAT.
8. Run exact-main Pages/public gate.
