# VAL2 — Executable Personal Plans Success Contract

Status: FROZEN FOR IMPLEMENTATION  
Base: `main@a81610c6b6a64dd157d5462420254ab734c0fca3` (VAL1 public exact-release SAT).

## Goal

Upgrade the existing `personal-planning.mjs` goal record into a bounded, deterministic executable-plan record without creating a second scheduler or executor.

VAL2 adapts the AstraLife P4 idea:

```
existing personal goal
→ bounded plan metadata
→ current step
→ existing candidates()/decide()/claim()/execute()
→ authoritative outcome
→ complete / fail / bounded replan
```

## Authority boundary

- `candidates() → decide() → claim() → execute()` remains the only task scheduler/executor.
- VAL2 never writes resources, items, households, relationships or settlements.
- No LLM/model call is part of VAL2.
- No hidden-world read is added.
- Existing `personal-planning.mjs` remains the single personal-goal authority; VAL2 extends it instead of adding a parallel planner.

## Bounded plan contract

Each active personal goal may carry:
- `planVersion`
- `planId`
- `step`: current executable action kind/phase
- `attempt`: bounded replan count
- `maxReplans`: constant limit
- `status`: active / interrupted / completed / failed
- `outcome`: factual outcome only

A changed target/goal starts a new plan. A same goal/target selection advances/refreshes the existing plan without resetting its start tick. A failed factual outcome may increment replan count only up to the bound; after the bound the plan is failed.

## Acceptance

1. Legacy mode behavior is unchanged.
2. Independent worlds retain one personal planning authority only.
3. Same goal+target selection preserves `planId` and `startedTick`.
4. Changed goal/target creates a new deterministic `planId`.
5. Productive outcome completes the plan.
6. Failed productive outcome is bounded; no unbounded replan loop.
7. Survival interruption records interruption but does not invent a new goal.
8. Save/load continuation is byte-deterministic.
9. Existing IC7B/MX7/VAL1/120-year/browser regressions remain SAT.
10. No resource/household/relationship/settlement writer is introduced.

UNKNOWN is not PASS.
