# Simclone — Autonomous Clone World

A deterministic autonomous-society survival simulation where a lineage can survive, learn, reproduce, die, preserve knowledge, craft physical tools and build bounded production/social structures across generations.

**Current release line:** Knowledge Continuity 1 + Rust Survival RS1–RS4 + Production Planning RP1 + Mentorship KF1 + WorldSim WM4.5 food / WM4.6 wood ecology on the 0.5.0 engine/UI/save family.

Play: https://nustanakritwithai.github.io/Simclone/

## Implemented

- deterministic fixed-step survival, routing, reservations and shared resources
- autonomous work, housing, births, aging, lifespan and death
- bounded historical identities across generations
- skill inheritance/provenance and evidence-backed personal knowledge
- local knowledge verification/planning and Cultural Archive
- Rust physical crafting, possessions, equipment, Crafting Table and Furnace
- Stone Axe WOODCUT ×1.25; Stone Pickaxe MINE ×1.25; Hammer BUILD ×1
- authoritative Wood 2 → Charcoal 1 timed furnace processing
- opt-in RP1 production coordinator for the bounded tool → station → charcoal chain
- bounded Mentor → Student links; teaching transfers UNVERIFIED knowledge and never grants XP
- WorldSim ecology/climate/hydrology/vegetation evidence plus active WM4.5 food and WM4.6 wood regeneration

## Important authority boundary

WorldSim remains the single resource-regeneration writer. **WM4.5 ecology-sensitive food regeneration and WM4.6 ecology-sensitive wood regeneration are active.** WM4.2–WM4.4 remain evidence/calibration layers. Stone stays finite.

Simulation rules remain deterministic: no DOM, wall-clock time, Math.random or external API calls in the engine. UI mutations go through validated commands. UNKNOWN is never PASS.

## Verification

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

Exact candidate checks and exact merged-main GitHub Pages runs are release authority. Offline Chromium uses a Storage test double and is not physical-Android proof.

## Start here

[Status](docs/STATUS.md) · [Next steps](docs/NEXT_STEPS.md) · [Game plan](GAME_PLAN.md) · [Closeout handoff](docs/HANDOFF_2026-09-25_CLOSEOUT.md)

Next WorldSim gates are harvest-pressure feedback, shadow resource-zone placement, then weighted routing authority. Do not reopen food-formula selection.
