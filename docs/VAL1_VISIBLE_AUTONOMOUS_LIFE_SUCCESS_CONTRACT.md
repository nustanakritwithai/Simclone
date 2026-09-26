# VAL1 — Visible Autonomous Life Success Contract

Status: FROZEN FOR IMPLEMENTATION  
Base: `main@9283a9c88bf4b8f540498e8539e5551865b18e2c` after IC7B Household Cooperation + MX7 Settlement Authority.

## Goal

Make existing autonomous causality legible in the live Independent-world UI without adding a new gameplay authority.

VAL1 is a **read-only projection** over state that already exists:

```
current task
+ selected decision trace
+ personal-home planning intent
+ household economy / labor pressure
→ compact "Autonomous Life" explanation
```

## Authority boundary

VAL1 must not:
- write tasks, reservations, stock, items, relationships, households, settlements or knowledge;
- invent a goal, motive, emotion or thought that is not retained by an authoritative system;
- create a second scorer, scheduler, planner or executor;
- change deterministic simulation behavior.

The existing engine remains the only task authority. Household economy remains read-only. Personal-home planning remains authoritative only for its existing planning intent.

## Player-facing contract

For a selected living Clone in Independent mode, show:
1. **ตอนนี้** — the current authoritative task/action, or explicit "ยังไม่มีงานปัจจุบัน".
2. **แผนบ้าน** — the current `personalHomeIntent` state.
3. **แรงกดดัน Household** — current top labor pressure when a household economy exists.
4. **ทำไมเลือกงานนี้?** — the exact non-zero factor breakdown from the selected engine trace.
5. Exact trace score and an integrity marker only when `score === sum(factors)`.
6. If the selected trace is unavailable/stale, show UNKNOWN instead of fabricating an explanation.

## Acceptance

1. Legacy mode returns no VAL1 projection.
2. Independent projection is byte-read-only.
3. Current action matches `agent.task`.
4. Selected decision factors come only from the retained selected trace.
5. Displayed score equals the exact sum of displayed factors.
6. IC7B `householdCooperation` factor is visible when it actually contributes.
7. Household pressure comes from existing `householdEconomySnapshot()`.
8. Home plan comes from existing `personalHomeIntent()`.
9. Browser Inspector exposes current action, home plan and expandable Why evidence.
10. Existing IC7B/MX7/Independent/Legacy/browser regressions remain SAT.
11. No engine/runtime behavior file is modified for VAL1.

UNKNOWN is not PASS.
