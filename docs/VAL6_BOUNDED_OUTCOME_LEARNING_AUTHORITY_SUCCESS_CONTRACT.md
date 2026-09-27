# VAL6 — Bounded Outcome Learning Authority Success Contract

Status: PREP ONLY — DO NOT IMPLEMENT OR MERGE  
Prepared from: `main@388ddaf32f81429edcb24ba6b6f62ef6135734c7`  
Dependency: VAL5 exact-main Pages/public release must be SAT first.

## Goal

Turn a very small subset of VAL5's verified retained outcome evidence into a bounded deterministic candidate-score factor without creating a new planner, scheduler, executor, memory ledger, or knowledge authority.

Target flow:

```
retained productive outcome evidence
→ bounded personal experience signal
→ existing candidate factors
→ existing score sum
→ existing decide()
→ existing claim()
→ existing execute()
```

VAL6 is the first behavioral learning authority. It must remain weaker than survival, hard validation, reservations, pathing, and the existing task executor.

## Runtime insertion point

Current runtime builds candidate factors in `src/engine.mjs` inside `candidates() → add()`, then computes:

```
score = sum(factors)
```

VAL6 may add one optional numeric factor:

```
outcomeLearning
```

No alternate score path is allowed.

The existing Inspector already projects arbitrary non-zero `trace.factors`; no new UI authority is required for this gate.

## Evidence source

VAL6 may consume only retained personal-planning productive lessons already owned by the current planning authority.

Supported action families:

- FORAGE
- WOODCUT
- MINE
- BUILD

VAL6 must not consume:

- hidden World Truth
- current remote resource amount
- fabricated prediction history
- LLM output
- social/governance evidence as personal learning
- EXPLORE as if it were productive work

VAL5 explicitly reports historical prediction receipts as `NOT_RETAINED`. VAL6 therefore does not use prediction accuracy.

## Bounded signal

Export one pure deterministic signal with:

- `active`
- `bonus`
- `reason`
- `kind`
- `sampleCount`
- `satCount`
- `violCount`
- `unknownCount`
- `totalAmount`

### Eligibility

The signal is active only when all are true:

1. Independent world.
2. Candidate kind is exactly FORAGE / WOODCUT / MINE / BUILD.
3. No survival emergency.
4. At least 2 retained samples exist for that exact action family.
5. All eligible retained samples are SAT.
6. No VIOL sample exists for that family.
7. No UNKNOWN sample exists for that family.
8. Total retained productive amount is greater than 0.
9. Current VAL5 evidence is not `EVIDENCE_CONFLICT`.

### Bonus

```
bonus = min(4, satCount)
```

Therefore:

- 0–1 SAT samples → +0
- 2 SAT samples → +2
- 3 SAT samples → +3
- 4 SAT samples → +4
- more than 4 → impossible under current retained lesson bound, but still capped at +4

`MAX_OUTCOME_LEARNING_BONUS = 4`

This cap is intentionally below the existing labor-authority cap and well below stronger household-pressure signals.

## Positive-only rule

VAL6 does **not** add a negative penalty.

A VIOL outcome may be caused by environment, contention, depletion, reservation, timing, or other external conditions that current retained lessons do not causally classify.

Therefore any VIOL or UNKNOWN evidence produces:

```
bonus = 0
active = false
```

Negative learning is deferred until causal failure evidence or retained prediction receipts exist.

## Survival rule

If hunger/energy is in survival-emergency state:

```
bonus = 0
active = false
reason = survival-emergency
```

Learning must never teach a Clone to ignore survival.

## EXPLORE rule

A candidate whose actual kind is `EXPLORE` receives no VAL6 factor even when `purposeKind` is FORAGE/WOODCUT/MINE/BUILD.

VAL6 rewards demonstrated productive action only.

## Authority boundary

VAL6 may:

- derive a pure bounded signal from retained evidence
- add one numeric factor to the existing candidate factor object
- expose signal metadata in the candidate trace if useful for proof

VAL6 may not:

- change hard candidate status
- create or delete tasks
- claim reservations
- retry/replan
- change resources/items
- change Skill XP
- change `preference`
- write Knowledge/Memory
- write Household/Relationship/Settlement/Governance state
- persist a second learning ledger
- call an LLM/model
- create a second scorer
- create a second executor

## Required implementation shape

Preferred bounded shape:

1. Add a pure module such as `src/outcome-learning-authority.mjs`.
2. Reuse/refactor the smallest pure VAL5 retained-outcome aggregate helper rather than calling the entire VAL5 projection in the hot candidate loop.
3. Import one signal into `engine.mjs`.
4. Add `outcomeLearning` only when non-zero.
5. Preserve `score === sum(factors)`.
6. No UI file change required unless proof shows a missing label is materially necessary.

## Acceptance

1. Legacy mode: signal inactive, bonus 0.
2. Unsupported kind: signal inactive, bonus 0.
3. Survival emergency: signal inactive, bonus 0.
4. Zero/one SAT sample: no bonus.
5. Two SAT samples: exactly +2.
6. Three SAT samples: exactly +3.
7. Four SAT samples: exactly +4 and never higher.
8. Any matching VIOL: no bonus.
9. Any matching UNKNOWN: no bonus.
10. EXPLORE receives no bonus even with productive `purposeKind`.
11. VAL5 `EVIDENCE_CONFLICT`: no bonus.
12. Signal calculation is byte-read-only.
13. Candidate trace contains `outcomeLearning` only when active.
14. Candidate score still equals exact sum of factors.
15. Hard validation/status/path/reservation behavior is unchanged.
16. Existing `decide() → claim() → execute()` remains the only execution pipeline.
17. Save/load identical state yields identical signal and candidate ordering.
18. No new persisted learning ledger exists.
19. Full routine regression remains SAT.
20. Exact-main Pages/public release must be SAT before VAL6 is closed.

UNKNOWN is not PASS.

## Deferred

Not part of VAL6:

- negative penalties
- target-specific prediction calibration
- learned travel time
- learned success probability
- prediction-vs-actual accuracy
- cross-agent teaching of learning weights
- inherited behavioral weights
- LLM-generated strategies
- rule compilation

Those require new evidence contracts, not inference from the current four retained lessons.
