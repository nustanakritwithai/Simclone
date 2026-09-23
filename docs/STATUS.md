# Simclone — current release 0.3.1

Current implementation: **Stage Gameplay 0.3.1 + Survival Core 0.2.0 + Observation UI 0.3.1**. Save schema remains 0.2.0 with explicit migration from 0.1.0. The master roadmap remains a plan, not a completion report.

## What works

All V0.2 survival behavior remains: seeded world, permanent identity, manual clone inheritance, real movement, exclusive resource jobs, two-builder construction, reserved meals, route-distance target selection, production-aware stock targets, hunger interruption and on-site eating.

Lifecycle is now gameplay-active:

- 360 ticks = 1 simulated day = 1 biological year.
- CHILD 0–15 cannot take FORAGE / WOODCUT / MINE / BUILD.
- ADULT 16–54 keeps full productive work rate.
- ELDER 55+ performs productive work at deterministic 75% rate.
- DEAD overrides age and cannot work.
- Stage-ineligible in-flight productive tasks fail validation, lose their derived claim, and replan.
- Inspector shows the engine-derived stage and age.
- Decision Trace exposes `stage` as a concrete blocked reason.
- Manual CLONE remains an age-18 Influence action. It is not autonomous birth.

V0.3.1 also fixes mixed-version ES-module cache pins so app, UX, navigation and engine use the same 0.3.1 asset version.

## Latest evidence

Candidate commit `b6cd1fc26408f34a08bf58db2344dc53f586c809`, workflow `35887581535`: **SAT**.

- `npm test`: **69/69 PASS**.
- Survival regression: **18/18 SAT**.
- Offline Chromium observation UI: **43 PASS**.
- Offline Chromium navigation/save recovery: **36 PASS**.
- Offline Chromium survival UI: **10 PASS**.

The survival matrix still uses fixture/manual population setup; it does not prove autonomous reproduction or generation continuity. Offline Chromium uses an explicit Storage test double. Native browser persistence and physical Android performance remain UNKNOWN. Exact GitHub Pages deployment must be verified for the main commit before release is called deployed.

## Save contract

Engine version: `0.3.1`.

Save schema: `0.2.0`.

Accepted legacy schema: `0.1.0`.

Storage key remains `simclone:world:v1`.

No schema bump was required for V0.3.1 because stage capability and elder work rate are derived from existing lifecycle state.

## Still not implemented

Autonomous reproduction, reproduction cooldown/pacing, age death, generation-continuity proof, mentor teaching, cultural archive, local perception, social/faction/economy/conflict systems, replay and LLM integration.

The V1.0 autonomy gate is not claimed.

## Next gate

**V0.3.2 — Autonomous Birth.** Birth must be a separate engine transition from manual CLONE, require safe food/housing/resources, enforce deterministic pacing/cooldown, create a CHILD age 0, preserve lineage/inheritance, and never create a second mutable reservation registry.
