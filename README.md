# Simclone — Autonomous Clone World

**Historical Identity 0.3.6 candidate** — preserve ancestry while living generations continue beyond the old 200-person history cap. Exact candidate and main Actions determine release status.

Play: https://nustanakritwithai.github.io/Simclone/

People live, work, inherit skills and die. Dead identities can move into a bounded archive without losing parent/generation, death facts, skills or retained memories. The roster searches both living and historical people. Temporary decision-score traces are omitted on archival and labelled honestly. This is not mentor teaching or a cultural archive.

The living limit remains min(housing,36); retained history is separately capped at 1024 with character budgets. Birth cost, four-year pacing, parent cooldown and 35% XP inheritance stay unchanged. Manual cloning creates an adult, autonomous birth creates a child.

Save schema 0.3.0 explicitly migrates 0.1.0 and 0.2.0, preserving old lifecycle evidence and unknown death facts. Storage key remains simclone:world:v1. Export a backup before upgrading; the new save schema is not readable by old engines.

```sh
npm test
npm run test:survival
npm run test:lifecycle
npm run test:death
npm run test:continuity
python tests/ui-smoke.py
python tests/navigation-smoke.py
python tests/survival-smoke.py
```

Continuity includes the old 120-year proof and five untouched 1800-year worlds. Navigation includes separately labelled offline and real HTTP/native-storage tests. A blocked local HTTP environment is UNKNOWN, not native persistence PASS. CI/mobile emulation is not physical Android or public Pages browser verification.

[Status](docs/STATUS.md) · [Contract](docs/HISTORY_LIMITS_0.3.5.md) · [Evidence](docs/verification/history-0.3.6.json) · [Next steps](docs/NEXT_STEPS.md) · [Master plan](GAME_PLAN.md)

Finite storage still stops new births eventually. Imported-age cohorts, device performance, knowledge transfer, social systems and full replay remain separate gates. V1.0 is not claimed.
