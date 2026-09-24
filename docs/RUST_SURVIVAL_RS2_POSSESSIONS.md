# RS2 — Rust Survival possessions/tools

RS2 stacks directly on RS1, whose root baseline is Kingdom K6 main.

Adds a bounded physical-tool domain:
- unique physical item IDs
- personal bag
- one equipped hand tool reference
- timed craft orders
- shared material reservations
- death drop/cancel behavior
- Stone Axe -> WOODCUT x1.25
- Stone Pickaxe -> MINE x1.25
- Hammer craftable only at Crafting Table Lv1
- Hammer BUILD multiplier remains x1 until separately proven

Still component-level: engine scheduler, save migration, live UI and authoritative building placement are not yet wired.
