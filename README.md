# Simclone — Autonomous Clone World

A deterministic autonomous-society survival simulation where one lineage can learn, reproduce, die, preserve knowledge and keep changing the world across generations.

**Current released baseline:** Knowledge Continuity 1 on engine/UI/save family 0.5.0.  
**Current candidate:** Rust Survival RS1–RS4 integration (PR #52).

Play: https://nustanakritwithai.github.io/Simclone/

## What exists now

- deterministic fixed-step world, routing, survival needs and shared resources
- autonomous work, housing, births, aging, deterministic lifespan and death
- bounded historical identity/archive across generations
- 35% skill-XP inheritance with provenance
- personal knowledge, direct evidence, sharing, local verification and bounded memory
- opt-in local-knowledge resource planning and a paid Cultural Archive
- Kingdom occupation/labor scoring with other economy layers still separated by authority
- WorldSim ecology/hydrology/climate/vegetation evidence with resource-writer boundaries
- candidate Rust physical crafting: Stone Axe, Stone Pickaxe, Hammer, Crafting Table and Furnace
- candidate physical possessions/equipment/stations and Wood 2 -> Charcoal 1 processing

## Authority discipline

The engine owns simulation rules. UI only reads state and sends validated commands. No DOM, wall-clock time, Math.random or external API belongs in simulation rules. UNKNOWN is never PASS.

Rust candidate materials are committed exactly once when an order is accepted; timed completion never spends them again. Hunger/energy may interrupt the task while the order remains. Stone Axe speeds WOODCUT ×1.25, Stone Pickaxe speeds MINE ×1.25 and Hammer currently gives no BUILD bonus.

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

Candidate verification and the exact merged-main GitHub Pages run are the release authority. Offline Chromium uses a Storage test double; it is not physical-Android or public-browser proof.

## Read first

[Status](docs/STATUS.md) · [Next steps](docs/NEXT_STEPS.md) · [Master plan](GAME_PLAN.md) · [Rust RS1–RS4 contract](docs/RUST_SURVIVAL_RS1_RS4_INTEGRATED.md)

The remaining roadmap includes ecological food-formula authority, autonomous multi-step production chains, mentor/social relationships, factions/governance, real economy/trade, cooperation/conflict, culture/technology, spatial maturity, optional novelty reasoning and the final Original-only V1.0 autonomous proof.
