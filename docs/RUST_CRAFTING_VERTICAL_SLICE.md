# Rust Crafting → Simclone vertical slice

Baseline: `main@798a26c61814c062d9ae13126273e8e0b51ed602`.

This slice imports the **catalog/progression contract** from `nustanakritwithai/RustIslandSurvival-`, not the donor engine.

## Included

- Stone Axe
- Stone Pickaxe
- Hammer
- Crafting Table Lv1
- Furnace
- Item catalog
- Recipe catalog
- Craft station requirement
- Craft tier
- Material requirement
- Craftable category

Rust Island topology retained:

```text
Hand
├─ Stone Axe
├─ Stone Pickaxe
├─ Crafting Table Lv1
└─ Furnace

Crafting Table Lv1
└─ Hammer
```

## Authority boundary

This checkpoint is intentionally read-only catalog groundwork.

It does **not** yet:

- mutate Simclone stock
- create possessions
- create buildings
- change scheduler/task ranking
- change K1–K4 Kingdom shadow authority
- change save schema
- change public UI

The existing Simclone `wood/stone` stock remains the only runtime material ledger used in this slice.

Rust Island uses rope in Stone Axe / Stone Pick / Hammer recipes. Simclone does not yet have an authoritative rope/fiber ledger, so runtime recipes remain adapted to current Simclone materials while donor costs are retained as provenance metadata. No hidden resource is invented.

## Next integration gate

Wire this catalog into the rebased G1 possessions implementation:

1. tool craft orders resolve recipe metadata from this catalog
2. Stone Axe affects WOODCUT only after held + equipped
3. Stone Pickaxe affects MINE only after held + equipped
4. Hammer remains no-op for BUILD until its authority contract is separately proven
5. Crafting Table/Furnace outputs must become physical/build placement state, not duplicated inventory entries
6. protect reserved materials from BUILD/CLONE/birth previews and execution
7. migrate old saves explicitly before runtime activation
8. expose catalog/craft status in UI only after engine ownership exists

UNKNOWN is not PASS.
