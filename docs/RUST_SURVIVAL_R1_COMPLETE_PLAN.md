# R1 — Rust Survival Complete

Baseline: `main@84b42ef43829bc456012b6c0ccf0de528c515270`.

## Goal

Turn the released five-item Rust slice into a complete bounded survival-item loop before social/economy expansion:

```text
world resources
→ fiber / rope
→ tools + stations
→ food / water processing
→ productive use
→ durability loss
→ repair
→ physical storage / transfer
→ autonomous production coordination
```

## Non-negotiable authority rules

- Deterministic engine only: no Math.random, Date/wall-clock, DOM or external API in simulation.
- Reuse the existing Rust command/scheduler path. No second crafting executor.
- Every material has one authoritative ledger/writer.
- Inputs commit exactly once when work is accepted; completion never spends them again.
- Interruptions may pause work; death/save/load cannot duplicate input or output.
- State and history are bounded and validate on restore.
- Old saves require explicit migration or rejection.
- UI only dispatches validated commands.

## R1A — Fiber + Rope

Success contract:
- introduce a bounded authoritative fiber acquisition path;
- Rope is produced from Fiber by a timed validated process/recipe;
- selected Rust recipes may require Rope only after old-save migration and conservation tests exist;
- no hidden infinite Fiber/Rope source;
- RP1 disabled baseline remains equivalent unless R1A is explicitly active by world state.

Proof:
- deterministic same-seed acquisition;
- insufficient-material rejection;
- exact-once Fiber → Rope conservation;
- interruption/save/load/death cases;
- validation and UI visibility.

## R1B — Food + Water processing

Add raw/processed consumables through existing survival authority. Processing may improve usable food/water but must never mint nutrition from nothing. Furnace/camp prerequisites are physical and positional where appropriate.

## R1C — Durability + Repair

Wear occurs only from proven productive tool use. Repair consumes authoritative material, is bounded by max durability and cannot clone/replace an item ID silently.

## R1D — Storage

Add a physical bounded storage container. Item transfer must have one location at a time: bag, drop, station/storage as defined. Capacity and ownership are explicit; no infinite hidden inventory.

## R1E — Integration proof

Required:
- old-save migration;
- death/drop/storage interaction;
- RP1 compatibility;
- survival/lifecycle/death/continuity regressions;
- offline Chromium mobile controls;
- exact candidate CI;
- exact merged-main Pages.

UNKNOWN is not PASS.
