# Simclone — current release 0.2.0

Current implementation: **Survival Core 0.2.0 + Observation UI 0.2.0**. Saved-world schema remains 0.1.0. The master roadmap is a plan, not a completion report.

## What works

The seeded world, portraits, clone inheritance, real movement, house placement, inspector, roster, Chronicle, minimap, camera framing and protected browser save flow remain. Survival now has exclusive resource jobs, two builders per site, reserved meals, reachable-target selection by actual path distance, production-aware stock targets, hunger interruption and on-site eating of harvested food.

Tap the food counter or Menu → ภาพรวมการอยู่รอด for current free/reserved food and assigned jobs. Clone/build previews still mutate only disposable copies; confirmation validates authoritative state again.

## Latest evidence

57 unit/asset tests passed; 18 survival scenarios passed; 88 offline Chromium UI checks passed. See [scope, rules, migration and verification](SURVIVAL_0.2.0.md) and [long-run results](verification/survival-0.2.0.json). The prior 0.1.2 landscape camera failure encountered under new work choices was repaired before release.

UI fixtures are offline and use a Storage test double. Public HTTP, native browser storage and physical Android performance are not established by these tests. Deployment must be verified against the actual workflow run. Closing/hiding the game still stops time; there is no 24/7 or offline catch-up simulation.

## Still not implemented

Autonomous reproduction, child/adult/elder aging, mentor teaching, cultural archive, local perception, social/faction/economy/conflict systems, replay and LLM integration. Manual generations are not proof of autonomous population continuity. The V1.0 autonomy gate is not claimed.

## Next gate

V0.3 lifecycle: define age units, life stages, autonomous clone creation, resource/housing requirements, death and inheritance contracts first. Preserve old worlds through an explicit migration if persistent fields change.

Historical presentation releases: [0.1.1](UX_UI_0.1.1.md), [0.1.2](UX_UI_0.1.2.md). Those documents describe their own earlier scopes and test results.
