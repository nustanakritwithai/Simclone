# VAL5 — Outcome Learning Shadow Success Contract

Status: FROZEN FOR IMPLEMENTATION  
Base: `main@bb7070b11349e95536cb77cbce1a8009b7b46ba2` (VAL4 public exact-release SAT).

## Goal

Add a deterministic, read-only **learning evidence shadow** over outcomes the agent has actually retained.

VAL5 is not a learning authority. It does not change behavior. It exposes bounded factual experience that a later authority can consume only after a separate Success Contract.

```
VAL3 live prediction context
+ VAL4 current outcome verification
+ retained personal planning lessons
→ bounded learning evidence shadow
```

## Critical evidence limit

VAL3 does **not** retain historical prediction receipts after an action finishes.

Therefore VAL5 MUST NOT claim:

- prediction accuracy
- predicted-vs-actual error
- calibrated expected value
- learned route time
- learned success probability

The shadow must report:

`predictionHistory = NOT_RETAINED`

until a separate, explicitly approved prediction-receipt authority exists.

## Productive evidence scope

Only retained lessons from:

- FORAGE
- WOODCUT
- MINE
- BUILD

are learning evidence in VAL5.

EXPLORE and all other task families are ignored by the outcome aggregate.

## Output

For one living Independent Clone:

- current VAL3 live prediction context
- current VAL4 outcome-verification context
- bounded retained productive outcome samples
- per-task factual aggregate:
  - sampleCount
  - satCount
  - violCount
  - unknownCount
  - totalAmount
  - lastTick
- explicit evidence status
- explicit `predictionHistory = NOT_RETAINED`

## Evidence states

- `NO_OUTCOME_EVIDENCE` — no retained productive outcome sample.
- `OUTCOME_EVIDENCE` — one or more retained productive outcome samples.
- `EVIDENCE_CONFLICT` — current VAL4 verification reports contradictory terminal evidence.

No state means “learned rule” or “behavior should change”.

## Authority boundary

- Existing `candidates() → decide() → claim() → execute()` remains unchanged.
- No score bonus/penalty.
- No planner, scheduler, task, retry or executor mutation.
- No resource/item/household/relationship/settlement/governance/knowledge write.
- No new persistence ledger.
- No LLM/model call.
- No hidden-world inspection.
- No prediction receipt is invented.
- No success probability is inferred from the bounded samples.
- Current planning lesson retention remains owned by the existing personal-planning authority.

## Acceptance

1. Legacy mode returns null.
2. Projection is byte-read-only.
3. Empty retained productive lessons return `NO_OUTCOME_EVIDENCE`.
4. Only FORAGE/WOODCUT/MINE/BUILD lessons enter the aggregate.
5. Counts and total amounts exactly equal retained lesson evidence.
6. VAL4 VERIFIED outcome is surfaced as context without becoming a score/rule.
7. VAL4 EVIDENCE_CONFLICT promotes the shadow evidence state to `EVIDENCE_CONFLICT`, never to learned knowledge.
8. VAL3 current prediction is surfaced only as live context.
9. Historical prediction/calibration is explicitly `NOT_RETAINED`.
10. No prediction accuracy, score adjustment, preference or learned rule field exists.
11. Save/load yields identical shadow for identical state.
12. No active Khet/Household/Building branch files are modified.
13. Full routine regression remains SAT.

UNKNOWN is not PASS.
