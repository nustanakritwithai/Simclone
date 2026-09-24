# Simclone — Autonomous Clone World

**Knowledge Continuity 1** adds personal evidence revision, an opt-in local-resource planner, and a bounded cultural archive to the existing deterministic colony simulation. Exact branch and main GitHub Actions runs determine verification and deployment; this page is not a claim that the whole master roadmap is complete.

Play: https://nustanakritwithai.github.io/Simclone/

## Try the new gameplay

Open the food summary and select **ใช้ความรู้ส่วนตัว**. People can use nearby resource observations and their own remembered locations, but must visit a remembered location before treating its remote contents as available. Exploration can beat waiting idle; actual travel and survival interruptions still apply.

In the same panel, **สร้างคลัง** upgrades the existing camp for **wood 6 + stone 2**. People within four cells can publish personally confirmed knowledge or read stored claims. Automatic publication/reading performs at most one successful operation every 120 simulation ticks and can be paused. The Knowledge inspector provides explicit verification and publication controls.

Reading does not grant XP or confirm a claim. Stored knowledge can outlive its writer. Empty resources are stale, not evidence that a messenger lied. Original discovery and sender identity remain attributable after re-observation.

## Compatibility and boundaries

Engine/UI and the base save format remain `0.5.0`; storage key remains `simclone:world:v1`. The optional planner and culture records have their own explicit schema identifiers. Existing saves keep the legacy resource-planning policy until the player opts in; the archive is not created or paid for silently. Export a backup before changing releases, and do not use older engines to continue worlds with these extensions.

The living limit remains 36, retained identity limit 1024, archive knowledge limit 16 publications with three prior revisions per entry. This is finite storage, not an unlimited-history claim. Shared stock and navigation terrain are still public simulation information. Private terrain memory, social factions, complete markets, full replay, an LLM runtime and the full V1.0/V2.0 game are not claimed.

Kingdom K5 labor scoring is active; K1 profession/career records are real, but the other imported economic projections remain shadow/read-only. WorldSim WM4.1 remains the resource-regeneration writer with the original food cadence. WM4.3 calibration and Formula Lab do not activate a new food formula. Rust crafting/stations are separate pending integrations.

## Verify

```sh
node scripts/pin-assets.mjs  # after changing any src/*.mjs file
npm test
npm run test:survival
npm run test:lifecycle
npm run test:death
npm run test:continuity
python tests/ui-smoke.py
python tests/navigation-smoke.py
python tests/survival-smoke.py
```

Node and Python are required; browser checks also need Playwright and Chromium. `npm test` includes a separate five-seed 120-year knowledge/archive proof, not a replacement for the original 120/1800-year baseline proofs. The offline fixture loads each source module once through an import map and explicitly doubles Storage. Native HTTP/storage/restart tests remain a separately labelled scope; a policy-blocked environment is UNKNOWN, not PASS. Physical Android and the public website require independent observation.

[Status](docs/STATUS.md) · [Knowledge contract](docs/KNOWLEDGE_CONTINUITY_1.md) · [Next gates](docs/NEXT_STEPS.md) · [Master vision](GAME_PLAN.md)
