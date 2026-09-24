# RS3 — Rust Survival stations + processing boundary

Stack:
`K6 main -> RS1 crafting catalog -> RS2 possessions -> RS3 stations`.

RS3 turns Crafting Table Lv1 and Furnace outputs into physical station entities.

Implemented:
- placement consumes one owned physical build item
- stable station IDs
- bounded station registry
- occupancy/range validation
- Crafting Table unlock lookup for Hammer
- Furnace presence lookup
- Rust processing catalog provenance for charcoal, cooked meat, clean water

Processing is intentionally **not authoritative yet** because Simclone currently has no authoritative charcoal/raw meat/water ledgers. RS3 reports these recipes as `not-authoritative` rather than inventing hidden stock.

Next RS4 should establish the first additional survival-material ledger contract, then activate one furnace process at a time.
