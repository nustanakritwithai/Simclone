# IC2 — Personal Autonomous Home Planning Work State

Status: IMPLEMENTATION CANDIDATE  
Branch: `feature/independent-clone-world-ic2-main`  
Base: `main@3139e979b4446fd3f9873bb8b6fbbfae5ee6248d` with IC1 merged  
Success Contract: `docs/IC2_PERSONAL_HOME_SUCCESS_CONTRACT.md`

## Goal

Let an explicitly enabled full-RP1 world progress one productive homeless Clone at a time toward that person's own modular home while reusing existing Rust and engine authorities.

## Implemented candidate

- Pure planner: `src/individual-home-planning.mjs`
- IC1 personal ownership/site projection reused from `src/individual-housing.mjs`
- Personal placement projection: `pendingPersonalPlacements()`
- Full RP1 bounded coordinator in `src/production-planning.mjs`
- Engine BUILD candidates use personal placement only when full RP1 is enabled.
- Default housing-only autonomy remains the legacy settlement-pressure path.
- Planner/coordinator intents:
  - INELIGIBLE
  - HOME_COMPLETE
  - NO_SITE
  - NEED_HAMMER
  - EQUIP_HAMMER
  - NEED_MATERIALS
  - CRAFT_PIECE
  - PLACE_PIECE
- No direct placement by the coordinator; physical construction remains:
  `BUILD task → command(PLACE_STATION) → Rust validator/executor`.
- No new item/material/building/ownership ledger.
- No save-version change.
- No birth/Camp/global-stock/UI change.

## Authored proof

- `tests/individual-home-planning.test.mjs`
  - pure intent matrix
  - another person's bag does not count
  - planner read-only
  - child stage-ineligible
- `tests/individual-home-integration.test.mjs`
  - personal Hammer order even when another Clone has a Hammer
  - personal piece craft order
  - personal placement projection
  - engine BUILD places founding Foundation for the same owner
- Game Studio correlation contract:
  `docs/INDEPENDENT_CLONE_GAME_STUDIO_SCENARIOS.md`

## Authority boundary

```text
personalHomeIntent (read-only)
→ bounded IC2 coordinator
→ existing CRAFT_ITEM / EQUIP_ITEM
→ existing scheduler / BUILD candidate
→ existing PLACE_STATION
→ IC1 evidence-derived owner
```

Planner intent is never execution authority. Rust validation is final.

## Remaining candidate gates

1. Regenerate runtime source pins for changed modules.
2. Exact candidate CI.
3. Existing regression suites remain green.
4. Add save/load continuation proof mid-personal-home loop if the first candidate is otherwise SAT.
5. Add deterministic two-owner full-completion proof before changing default autonomy in IC3.
6. Game Studio sealed run remains UNKNOWN until `game-dev` is available.

## Risks to watch

- Full RP1 still uses shared stock and shared infrastructure as migration compatibility.
- Default housing-only behavior is intentionally not individual-first yet.
- One blocked person must not create a second executor workaround.
- Helpers must not steal founding ownership.
- Children remain stage-ineligible.
- No RP1/global placement path may consume a personal carried piece while full RP1 is active.

## Validation state

Implementation candidate. Exact CI/runtime evidence is not yet recorded. UNKNOWN is not PASS.
