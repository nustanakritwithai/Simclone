# RS1 — Rust Survival crafting/station contract after Kingdom K6

Baseline: `main@1c4954a9cccb41c9edace6100a4dda94bc31e02d`.

This branch continues **directly from Kingdom K6**. K7 settlement work is not a dependency.

RS1 imports the smallest Rust Island crafting/station contract needed for Simclone gameplay-first progression.

## Included

- Stone Axe
- Stone Pickaxe
- Hammer
- Crafting Table Lv1
- Furnace
- item catalog
- recipe catalog
- station requirement
- tier requirement
- material requirement
- craftable category

Rust progression topology:

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

Kingdom K1–K6 behavior is preserved.

RS1 is still catalog/query groundwork only. It does not yet:

- mutate stock
- create/equip possessions
- create buildings
- alter K5 bounded labor authority
- alter K6 market projection
- change save schema
- change UI

Simclone's current authoritative material ledger remains `food/wood/stone`.

Rust donor recipes use rope for Stone Axe, Stone Pickaxe and Hammer. RS1 keeps those donor costs as provenance metadata but does not invent rope/fiber authority before the engine has one owner for it.

## Next

RS2 should connect this catalog to the possessions/task system:

1. timed craft orders
2. material reservations
3. Stone Axe → WOODCUT multiplier
4. Stone Pickaxe → MINE multiplier
5. Hammer remains no-op until BUILD authority is separately proved
6. station placement for Crafting Table/Furnace
7. save migration + death cleanup
8. UI only after engine ownership exists

UNKNOWN is not PASS.
