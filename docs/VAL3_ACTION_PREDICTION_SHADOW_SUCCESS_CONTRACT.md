# VAL3 — Action Prediction Shadow Success Contract

Status: FROZEN FOR IMPLEMENTATION  
Base: `main@5c035383bf75e711250d97ea4340332ae4846b16` (VAL2.1 merged; release gate SAT).

## Goal

Add a deterministic, read-only prediction shadow for the **currently selected authoritative task**.

VAL3 does not predict hidden world truth. It only projects facts already owned by the runtime:

```
authoritative task
+ selected decision trace
+ route progress
+ survival thresholds
→ bounded prediction snapshot
```

The prediction is diagnostic evidence for later Predict → Act → Verify → Learn work. It does not affect candidate scoring in VAL3.

## Authority boundary

- Existing `candidates() → decide() → claim() → execute()` remains unchanged.
- No score bonus/penalty comes from VAL3.
- No resource/item/household/relationship/settlement/knowledge write.
- No LLM/model call.
- No inspection of remote node quantities or future regeneration.
- Prediction uses only current task state, retained selected trace, and exported survival rules.
- If evidence is missing, return UNKNOWN instead of fabricating an estimate.

## Prediction fields

For a living Independent Clone:
- current task kind / target
- selected-trace score evidence when available
- remaining route steps
- deterministic minimum travel ticks from `RULES.moveTicks`
- current revalidation contract:
  - RESOURCE_AT_TARGET
  - BUILD_PLACEMENT
  - BUILD_TARGET
  - RUST_ORDER
  - SURVIVAL_ACTION
  - EXPLORE
  - NONE
- current survival interruption state (already hungry/exhausted now)
- linked VAL2 plan identity when available
- evidence status: `PREDICTABLE`, `TRACE_UNKNOWN`, `NO_TASK`

## Acceptance

1. Legacy mode returns null.
2. Projection is byte-read-only.
3. Remaining route steps exactly match authoritative task path length.
4. Minimum travel ticks derive from `RULES.moveTicks` and current `moveTick`; no duplicate movement constant.
5. Prediction never reads remote resource amount/output.
6. Revalidation contract matches the task family only.
7. Current hunger/energy interruption is descriptive only and does not mutate/replan.
8. Linked plan identity is copied from VAL2.1 projection, never recomputed.
9. Save/load yields identical prediction for identical state.
10. No files owned by Governor v1 PR #120 are modified.
11. Full regression remains SAT.

UNKNOWN is not PASS.
