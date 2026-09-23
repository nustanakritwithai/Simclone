# Simclone — Autonomous Clone World

**Autonomous Birth 0.3.2** over deterministic lifecycle and Survival Core 0.2.0.

Play: https://nustanakritwithai.github.io/Simclone/

Plan: https://nustanakritwithai.github.io/Simclone/plan.html

## Current engine gate

The colony can now produce new generations without player Clone commands.

- 360 ticks = 1 simulated day = 1 biological year.
- CHILD 0–15: no productive resource/build jobs.
- ADULT 16–54: full productive work.
- ELDER 55+: productive work at 75%.
- Autonomous birth: max 1/year; same parent cooldown 4 years.
- Birth costs Food 8 + Wood 4 and preserves survival reserves.
- Reserved meals cannot be spent on birth.
- Children start at age 0, preserve lineage, get a permanent identity and inherit 35% Skill XP.
- Manual CLONE remains a separate player Influence action that creates an age-18 adult.
- Age death is not enabled yet.

## Verification

V0.3.2 candidate:

- 76/76 unit/asset PASS.
- 18/18 Survival regression SAT.
- 5/5 autonomous-birth proof seeds SAT over 30 simulated years with **zero manual CLONE commands**.
- Every proof seed reached generation 2.
- Offline Chromium: 89 checks PASS.

This proves autonomous birth and growth into productive descendants. It does **not** yet prove continuity after age death or the full V1.0 Living World gate.

## Development

```sh
npm test
npm run test:survival
npm run test:lifecycle
python tests/ui-smoke.py
python tests/navigation-smoke.py
python tests/survival-smoke.py
```

- [Current status](docs/STATUS.md)
- [Lifecycle V0.3 contract](docs/LIFECYCLE_0.3.0.md)
- [Survival 0.2 rules/evidence](docs/SURVIVAL_0.2.0.md)
- [Master roadmap](GAME_PLAN.md)
- [Agent handoff](AGENTS.md)

Next: **V0.3.3 Age Death + Cleanup**.
