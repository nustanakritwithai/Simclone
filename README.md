# Simclone — Autonomous Clone World

**Age Death 0.3.3** — autonomous birth, growth, stage-dependent work and deterministic age death.

Play: https://nustanakritwithai.github.io/Simclone/

Plan: https://nustanakritwithai.github.io/Simclone/plan.html

## Current lifecycle

- 360 ticks = 1 biological year.
- CHILD 0–15: no productive resource/build jobs.
- ADULT 16–54: 100% productive work.
- ELDER 55+: 75% productive work.
- Deterministic lifespan: 78–92 years.
- Autonomous birth: max 1/year, same-parent cooldown 4 years.
- Birth cost: Food 8 + Wood 4, with survival reserves protected.
- Dead agents stop actions and release all task-derived reservations.
- Manual CLONE remains a separate player Influence action.

## Verification

V0.3.3 candidate:

- 81/81 unit/asset PASS.
- 18/18 Survival regression SAT.
- 5/5 Autonomous Birth proof SAT.
- 5/5 Age Death/Cleanup proof SAT over 90 simulated years.
- 0 starvation deaths in the age-death proof.
- Offline Chromium: 89 checks PASS.

This does not yet prove multi-generation continuity after the original generation dies. That is V0.3.4.

## Development

```sh
npm test
npm run test:survival
npm run test:lifecycle
npm run test:death
python tests/ui-smoke.py
python tests/navigation-smoke.py
python tests/survival-smoke.py
```

- [Current status](docs/STATUS.md)
- [Lifecycle V0.3 contract](docs/LIFECYCLE_0.3.0.md)
- [Survival 0.2 rules/evidence](docs/SURVIVAL_0.2.0.md)
- [Master roadmap](GAME_PLAN.md)
- [Agent handoff](AGENTS.md)

Next: **V0.3.4 Generation Continuity Proof**.
