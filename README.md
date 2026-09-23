# Simclone — Autonomous Clone World

**Lifecycle Foundation 0.3.0** over **Survival Core 0.2.0** with Observation UI 0.2.0.

Play: https://nustanakritwithai.github.io/Simclone/

Plan: https://nustanakritwithai.github.io/Simclone/plan.html

## Current engine gate

V0.3.0 establishes deterministic lifecycle time and save migration before lifecycle behavior is allowed to affect survival.

- 360 ticks = 1 simulated day = 1 biological year.
- CHILD: 0–15, ADULT: 16–54, ELDER: 55+, DEAD overrides age.
- Fresh worlds and manual CLONE actions start as age-18 adults.
- Save schema is now 0.2.0. Existing 0.1.0 saves migrate explicitly and start the V0.3 lifecycle clock at age 18 at load time.
- Storage key remains `simclone:world:v1`.
- Autonomous birth, child work restrictions, elder productivity changes and age death are **not enabled yet**.

Survival behavior from 0.2.0 remains active: route-aware resource selection, task-derived reservations, one worker per resource node, two builders per site, reserved meals, stock targets, hunger interruption and on-site eating.

## Verification

Candidate evidence for the lifecycle engine: 62/62 unit/asset tests and 18/18 Survival Core scenarios passed. The survival proof is still a V0.2 regression fixture with manual population setup; it is not a generation-continuity proof.

The prior 88 offline Chromium UI assertions belong to the 0.2.0 observation release. Native browser persistence, public HTTP delivery and physical Android performance remain separate evidence gates.

## Development

Static HTML/CSS/ES modules; no runtime dependencies or build step.

```sh
npm test
npm run test:survival
python -m http.server 8000
```

Use an HTTP server, not a file URL, for ES modules.

- [Current status](docs/STATUS.md)
- [Lifecycle V0.3 contract](docs/LIFECYCLE_0.3.0.md)
- [Survival 0.2 rules/evidence](docs/SURVIVAL_0.2.0.md)
- [Master roadmap](GAME_PLAN.md)
- [Agent handoff](AGENTS.md)

Next engine milestone is V0.3.1 stage gameplay. Autonomous reproduction follows only after stage rules are deterministic and regression-safe.
