# Personal Inventory + Hand Equipment

Base: `main@734bb1379fe5a180d6ab1390e9a960bf5d676479`

Status: candidate. Release only after exact candidate Verify and exact main Pages are SAT.

## Scope

This slice makes the already-authoritative Rust possession model directly usable per Clone.

- Personal bag remains bounded at 4 physical item instances per living Clone.
- Item ownership remains the existing `location:{kind:'bag',agentId}`; no second inventory ledger is introduced.
- One derived equipment slot is exposed: `hand`.
- Current hand-equippable items are Stone Axe, Stone Pickaxe and Hammer.
- Equipped items remain in the owner's bag and continue consuming the same bag slot.
- Equipping another hand tool atomically replaces the previous hand selection.
- `UNEQUIP_ITEM` removes only the equipment reference; it never deletes, transfers or duplicates the item.
- Death behavior remains unchanged: finished bag items drop, equipment clears, unfinished committed work is cancelled without refund duplication.

## Authority

- `src/rust-possessions.mjs` remains the possession/equipment writer.
- `src/rust-runtime.mjs` remains the engine command bridge.
- UI uses `EQUIP_ITEM` / `UNEQUIP_ITEM`; it never mutates `rustPossessions` directly.
- The inspector Inventory tab is observation + validated command dispatch only.
- Save schema stays 0.5.0 because no persisted shape is changed.

## UI

Each character inspector exposes **กระเป๋า**:

- four explicit personal bag slots
- item instance id and item type
- current hand equipment
- equip/replace hand tool
- unequip hand tool
- dead/archived people are read-only and normally have no bag after death cleanup

The existing Rust dialog continues to show crafting and nearby drops; equipped tools there also expose a remove action.

## Success contract

1. A Clone cannot equip an item owned by another Clone.
2. Equip selects only a tool with `equipSlot:'hand'`.
3. Save/load preserves the hand selection.
4. Unequip leaves the physical item in the same personal bag.
5. At most one equipment row exists per living agent; malformed duplicates fail validation.
6. Personal bag capacity remains 4 and existing craft/pickup capacity checks remain authoritative.
7. Tool work multipliers still come only from the equipped hand item.
8. Death still drops finished bag items and clears equipment.
9. Inspector shows exactly four bag slots and hand equipment state on mobile/desktop.
10. UI equip/unequip actions route through engine commands and survive the existing browser regression suites.

Verification states: SAT / VIOL / UNKNOWN. UNKNOWN is never PASS.
