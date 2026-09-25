# Rust Survival RS1–RS4 — integrated candidate

Baseline: `main@09260a3ee9ba3a0b10c6ecd9a9f09570076e86e6`.

This slice reconciles the old RS1–RS4 branches onto the current Knowledge Continuity 1 main line without merging their stale 132-commit history.

## Authority

Authoritative:
- five bounded recipes: Stone Axe, Stone Pickaxe, Hammer, Crafting Table Lv1, Furnace
- physical item instances with stable IDs, four-slot personal bags and one equipped hand tool
- material commitment at order acceptance; committed material is removed from shared stock exactly once
- timed craft work executed by the normal deterministic scheduler
- hunger/energy may interrupt the task contract while the accepted order remains
- placed Crafting Table/Furnace entities with stable IDs and adjacency/terrain/occupancy validation
- Hammer requires a Crafting Table
- Furnace process Wood 2 -> Charcoal 1, timed and position-bound
- Stone Axe speeds WOODCUT work by 1.25; Stone Pickaxe speeds MINE by 1.25; Hammer has no BUILD bonus yet
- death drops finished bag items, removes equipment and cancels unfinished work without refund duplication
- save/load and same-version 0.5.0 extension migration
- offline UI commands still travel through the engine command bridge

Still non-authoritative:
- rope/fiber
- raw meat/cooked meat
- dirty/clean water
- durability/repair
- autonomous production-chain planning
- tool market/wages/ownership economy

## Conservation rule

Accepted craft/process orders use **atomic escrow by commitment**: the required shared materials leave `state.stock` once when the order is accepted. The order records the committed material. Completion creates the output and never spends the input again. An unfinished order interrupted by hunger is retained. Death cancels unfinished work; committed input is not duplicated back into stock.

This differs from the stale RS2/RS4 prototype that left material in shared stock until completion. The integrated rule prevents CLONE, BUILD, culture upgrades or another order from spending the same material while work is pending.

## Persistence

The base save version remains 0.5.0. `rustPossessions`, `rustStations` and `rustMaterials` are bounded optional 0.5.0 extensions. Loading an older valid 0.5.0 world that lacks them creates empty ledgers; malformed present ledgers fail validation.

## Verification

Required exact-candidate proof:
- runtime ESM linking
- cache pins for every shipped module
- unit/regression suite
- integrated craft/save/load/station/furnace/death tests
- Survival Core, birth, death and continuity proof suites
- offline Chromium including Rust command controls

UNKNOWN is not PASS. This document is not release proof; exact Actions and exact main Pages remain authoritative.
