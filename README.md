# Simclone — Autonomous Clone World

**Stage Gameplay 0.3.1** over **Survival Core 0.2.0**.

Play: https://nustanakritwithai.github.io/Simclone/

Plan: https://nustanakritwithai.github.io/Simclone/plan.html

## Current engine gate

Lifecycle now affects real behavior:

- 360 ticks = 1 simulated day = 1 biological year.
- CHILD 0–15: no FORAGE / WOODCUT / MINE / BUILD.
- ADULT 16–54: full productive work.
- ELDER 55+: productive work at 75%.
- DEAD overrides age.
- Inspector displays derived age/stage and Decision Trace can explain stage-blocked work.
- Manual CLONE still creates an age-18 adult and costs Food 8 + Wood 4.
- Autonomous birth and age death are not enabled yet.

Save schema is 0.2.0 with explicit migration from legacy 0.1.0. Storage key remains `simclone:world:v1`.

## Verification

V0.3.1 candidate evidence:

- 69/69 unit/asset tests PASS.
- 18/18 Survival Core scenarios SAT.
- Offline Chromium: 43 observation UI + 36 navigation/save + 10 survival UI checks PASS.
- Versioned ES-module cache pins are regression-tested to stay aligned.

These tests do not prove autonomous generation continuity. Native browser persistence, live public HTTP delivery and physical Android performance remain separate evidence gates.

## Development

```sh
npm test
npm run test:survival
python tests/ui-smoke.py
python tests/navigation-smoke.py
python tests/survival-smoke.py
```

- [Current status](docs/STATUS.md)
- [Lifecycle V0.3 contract](docs/LIFECYCLE_0.3.0.md)
- [Survival 0.2 rules/evidence](docs/SURVIVAL_0.2.0.md)
- [Master roadmap](GAME_PLAN.md)
- [Agent handoff](AGENTS.md)

Next: **V0.3.2 Autonomous Birth**.
