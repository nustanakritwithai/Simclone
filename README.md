# Simclone — Autonomous Clone World

**Generation Continuity 0.3.4** — autonomous birth, growth, work and deterministic age death.

Play: https://nustanakritwithai.github.io/Simclone/

Births are at least four simulated years apart when conditions allow. Same-parent cooldown is four years. Birth costs Food 8 + Wood 4 and protects survival reserves. Manual Clone remains a separate Influence action that creates an age-18 adult; automatic birth creates an age-zero child.

The release gate uses five fresh seeded worlds for 120 years with no player Clone commands, real aging/death, and saved checkpoint continuation. It requires productive living descendants after the initial six die. This is NOT unlimited-time or full V1.0 proof.

Save schema stays 0.2.0, with legacy 0.1.0 migration and `simclone:world:v1` storage key unchanged. Existing ages are preserved, not silently reset.

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

[Current status](docs/STATUS.md) · [Release contract](docs/LIFECYCLE_0.3.4.md) · [Verification](docs/verification/lifecycle-0.3.4.json) · [Next steps](docs/NEXT_STEPS.md) · [Master roadmap](GAME_PLAN.md)

Offline Chromium uses an explicit Storage double. Physical Android/native browser persistence and full V1.0 social/knowledge/replay requirements remain separate gates. The 200-agent history cap still limits very long runs.
