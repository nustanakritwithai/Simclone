# ER0 — Raw Resource Representation and Ownership Contract

Status vocabulary: **SAT / VIOL / UNKNOWN**. UNKNOWN never passes.

Baseline inspected before this candidate: `main@973a9609b58a94bb5bb634b020129267155cf12c`.

## Decision

Food, wood, stone, charcoal, iron ore, iron ingot and steel ingot remain **canonical resource counters** owned by the existing personal / household / material authorities.

They are **not Rust item instances** and must not be wrapped in fake item IDs merely so RC4 can trade them.

Current authority split is intentional:

- personal / household resource ownership: `individual-resources.mjs`
- bulk metal ownership / processing: `material-economy.mjs` + `rust-materials.mjs`
- physical item instances: `rust-possessions.mjs`
- canonical RC4 Trade Kernel: currently transfers physical Rust item IDs only
- Wallet: canonical money authority

## Proven current limitation

The released RC4 item adapter resolves seller ownership through `tradableRustItemIds()` and settles with `transferRustItemInstances()`.

Therefore a Miner with `ironOre = 20` does **not** own twenty physical Rust item IDs. A Listing requiring `itemInstanceId` cannot honestly represent those twenty resource units.

This is not a bug to bypass. It is the boundary ER0 freezes.

## Forbidden repairs

ER2 and later must not:

- mint one fake item per wood/stone/ore unit;
- add `producerInventory`, `crafterInventory`, `merchantMaterials` or another stock ledger;
- silently decrement a resource counter outside its existing authority;
- route a bulk transfer through the item adapter with invented item IDs;
- create a second wallet or a second general trade authority;
- mark Miner -> Crafter raw-material market sale SAT while the asset-transfer path is still UNKNOWN.

## Accepted future extension shape

Raw-material sale must be added as a **versioned extension of the canonical settlement boundary**, not as a shadow trade system.

The extension must preserve:

1. Market / Listing / BuyOffer reference semantics.
2. Canonical Wallet debit + credit.
3. One atomic settlement boundary.
4. Existing resource authority as the only bulk quantity writer.
5. Replay protection.
6. Quantity conservation.
7. Save/load compatibility and migration.
8. Existing item-instance trades byte-semantically compatible.

A future bulk proposal may identify a canonical resource key + quantity instead of an `itemInstanceId`, but it must not be accepted until the Trade/Reservation/Listing contracts are versioned to represent that asset type explicitly.

## ER0 proof carried by this candidate

The accompanying test proves that positive food/wood/stone/metal balances do not appear in `ITEM_CATALOG` and do not become tradable Rust item IDs.

So ER0 is a **representation contract**, not a claim that raw-resource market settlement already exists.

### Gate

- representation/ownership boundary: SAT if exact-head tests pass;
- raw-resource paid market settlement: **UNKNOWN** until the later canonical bulk-settlement extension exists;
- UNKNOWN is never PASS.
