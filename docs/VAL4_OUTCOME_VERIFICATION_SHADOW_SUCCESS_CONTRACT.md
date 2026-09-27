# VAL4 — Productive Outcome Verification Shadow Success Contract

Status: FROZEN FOR IMPLEMENTATION  
Base: `main@ddd266dea8c77d14a54368fe80b10e4d33aaa31e` (VAL3 public exact-release SAT).

## Goal

Add a deterministic, read-only verification shadow for the **current retained VAL2 productive plan outcome**.

VAL4 does not learn, score, replan, execute, or write World Truth. It only joins facts already retained by the current authorities:

```
VAL2 current plan
+ bounded personal planning lessons
→ terminal outcome verification snapshot
```

This is the next bounded step toward:

```
Predict → Act → Verify → Learn
```

VAL3 remains the prediction shadow. VAL4 verifies actual productive outcomes after the authoritative executor has already acted. Learning is explicitly deferred.

## Scope

Productive task families only:

- FORAGE
- WOODCUT
- MINE
- BUILD

EXPLORE and other task families remain out of scope for this gate.

## Authority boundary

- Existing `candidates() → decide() → claim() → execute()` remains unchanged.
- Existing VAL2 plan/lesson writers remain unchanged.
- VAL4 is a read model only.
- No task creation, scoring, retry, replan or execution.
- No resource/item/household/relationship/settlement/knowledge write.
- No LLM/model call.
- No hidden-world inspection.
- No prediction-history or learning ledger is introduced.
- If retained evidence is insufficient or inconsistent, return UNKNOWN/conflict instead of fabricating a result.
- Do not modify files owned by Governor v1 PR #120.

## Evidence states

- `NO_PLAN` — no retained plan exists.
- `LEGACY_PLAN` — retained goal predates VAL2 identity and cannot be verified as VAL2.
- `OUT_OF_SCOPE` — VAL2 plan exists but its task family is not in this gate.
- `PENDING` — productive VAL2 plan is still active/interrupted.
- `VERIFIED` — terminal plan outcome agrees with the exact-tick retained productive lesson.
- `OUTCOME_UNKNOWN` — terminal plan exists but matching retained lesson evidence is unavailable.
- `EVIDENCE_CONFLICT` — plan and matching lesson disagree.

UNKNOWN is not PASS.

## Matching rule

For a terminal productive VAL2 plan, a lesson is eligible only when all are exact:

- `lesson.tick === plan.updatedTick`
- `lesson.kind === plan.kind`
- `lesson.targetId === plan.targetId`

Newest exact match wins only as a deterministic stability rule.

## Verified SAT

All must hold:

- plan status = `completed`
- plan outcome = `SAT:productive-outcome`
- matching lesson outcome = `SAT`
- matching lesson amount > 0

## Verified VIOL

All must hold:

- plan status = `failed`
- plan outcome = `VIOL:replan-budget-exhausted`
- `attempt === maxReplans`
- matching lesson outcome = `VIOL`
- matching lesson amount = 0

## Acceptance

1. Legacy mode returns null.
2. Projection is byte-read-only.
3. VAL2 identity is consumed through the existing executable-plan read model; no plan id is recomputed.
4. Active/interrupted productive plans remain PENDING and do not invent terminal outcomes.
5. Productive completion with exact matching SAT lesson becomes VERIFIED/SAT.
6. Exhausted bounded failure with exact matching VIOL lesson becomes VERIFIED/VIOL.
7. Missing exact matching lesson returns OUTCOME_UNKNOWN.
8. Contradictory plan/lesson evidence returns EVIDENCE_CONFLICT.
9. Out-of-scope tasks are explicit and do not infer results.
10. Save/load yields identical verification for identical state.
11. No existing runtime authority or Governor v1 PR #120 owned file is modified.
12. Full regression remains SAT.

UNKNOWN is not PASS.
