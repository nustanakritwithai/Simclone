# IC2 — Personal Autonomous Home Planning Work State

Status: PREPARED / STACKED ON IC1  
Branch: `feature/independent-clone-world-ic2`  
Base dependency: `feature/independent-clone-world-ic1`  
Success Contract: `docs/IC2_PERSONAL_HOME_SUCCESS_CONTRACT.md`

## Goal

Prepare the next individual-first gameplay slice without activating it before IC1 is verified.

## Completed preparation

- Pure planner module: `src/individual-home-planning.mjs`
- Deterministic intent matrix:
  - INELIGIBLE
  - HOME_COMPLETE
  - NO_SITE
  - NEED_HAMMER
  - EQUIP_HAMMER
  - NEED_MATERIALS
  - CRAFT_PIECE
  - PLACE_PIECE
- Planner reads IC1 home/site projection and existing Rust catalog/possession/equipment state.
- Planner performs no mutation and creates no ledger.
- Unit test matrix authored in `tests/individual-home-planning.test.mjs`.
- Game Studio runtime correlation contract added to `docs/INDEPENDENT_CLONE_GAME_STUDIO_SCENARIOS.md`.
- Runtime import map pinned for the new planner module.

## Not activated

IC2 currently does **not**:
- call the planner from `engine.step`;
- alter RP1;
- issue `CRAFT_ITEM`, `EQUIP_ITEM` or `PLACE_STATION`;
- alter birth, Camp, global stock, save schema or UI.

## Activation sequence after IC1 SAT

1. Verify pure planner tests.
2. Add a bounded IC2 coordinator that consumes exactly one planner intent per eligible homeless adult.
3. Route mutations only through existing engine/Rust commands.
4. Reuse existing task execution for physical BUILD placement.
5. Add deterministic two-person proof: each person completes their own house.
6. Add save/load continuation proof mid-home-plan.
7. Add Game Studio capture when `game-dev` is available.

## Risks to watch

- A global crafting table/Hammer chain can accidentally reintroduce colony-first ownership.
- Shared stock is still migration compatibility, not the target personal economy.
- A helper must not steal ownership from the founding foundation owner.
- Children must remain stage-ineligible.
- RP1 and IC2 must never both order the same personal piece in one tick.
- Planner intent must be revalidated at execution time; intent is not authority.

## Validation state

Prepared source only. CI/runtime evidence is not yet accepted. UNKNOWN is not PASS.
