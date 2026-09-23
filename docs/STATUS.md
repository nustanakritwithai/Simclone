# Simclone — current release 0.3.0

Current implementation: **Lifecycle Foundation 0.3.0 + Survival Core 0.2.0 + Observation UI 0.2.0**. Saved-world schema is now 0.2.0 with explicit migration from 0.1.0. The master roadmap remains a plan, not a completion report.

## What works

All 0.2.0 survival and observation behavior remains: seeded world, permanent identity, manual clone inheritance, real movement, exclusive resource jobs, two-builder construction, reserved meals, route-distance target selection, production-aware stock targets, hunger interruption, on-site eating, inspector/decision trace, minimap/camera and protected local-browser save flow.

V0.3.0 adds deterministic lifecycle state at the engine layer:

- 360 ticks = 1 simulated day = 1 biological year;
- CHILD 0–15, ADULT 16–54, ELDER 55+, DEAD when `alive=false`;
- new worlds and manual CLONE actions begin as age-18 ADULT;
- each agent persists a lifecycle anchor;
- a real 0.1.0 save fixture migrates to schema 0.2.0 at load without changing identity, lineage, appearance, skills or resources.

Stage currently has **no productivity or job restriction effect**. Autonomous birth and age death are still absent; the UI does not pretend they exist.

## Latest evidence

Lifecycle candidate verification run `35885291046` on commit `c573e6fa63834b61a137c89875e88f507a98e402` completed successfully:

- `npm test`: **62/62 PASS**;
- `npm run test:survival`: **18/18 SAT** — the same five seeds × populations 6/12/36 for 100 simulated days, plus three 10-day empty-food crisis fixtures.

The previous 88 offline Chromium UI assertions are retained as 0.2.0 UI evidence; no new UI behavior is claimed by V0.3.0. Public HTTP, native browser storage and physical Android performance are still not established by those offline fixtures. GitHub Pages deployment must be verified against the exact main commit workflow run.

## Save contract

Engine version: `0.3.0`.

Save schema: `0.2.0`.

Accepted legacy schema: `0.1.0`.

Storage key remains `simclone:world:v1`.

On legacy migration, existing agents receive a lifecycle anchor at the loaded simulation tick and age 18. This prevents a long-running pre-lifecycle world from becoming instantly elderly when lifecycle rules are adopted. Corrupt/unreadable-save overwrite protection remains unchanged.

## Still not implemented

Stage-dependent work rules, autonomous reproduction, age death, generation-continuity proof, mentor teaching, cultural archive, local perception, social/faction/economy/conflict systems, replay and LLM integration.

The V1.0 autonomy gate is not claimed.

## Next gate

**V0.3.1 — Stage gameplay.** CHILD must be excluded from full productive jobs, ADULT keeps current productivity, and ELDER receives a deterministic productivity reduction. Any stage transition that invalidates an in-flight task must release its task-derived reservation and replan. See [the lifecycle contract](LIFECYCLE_0.3.0.md).
