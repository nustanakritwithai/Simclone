# ER0.5 — Canonical Bulk Resource Settlement Success Contract

Status vocabulary: **SAT / VIOL / UNKNOWN**. UNKNOWN never passes.

Production prerequisite:

- merged main: `90cef501a069e5c34a99027654422579b3a6c150`
- exact-main Verify #2236 / run `36581104245`: SUCCESS
- Pages #119 / run `36581104386`: SUCCESS
- public exact-release / RC4 / Adventure / RC2 / RC3.1 / RC3.2 gates: SUCCESS

This work extends the released ER0 representation boundary. It does not replace ER1 Demand Authority.

## Goal

Allow canonical paid market settlement for resource counters without minting fake Rust item instances or creating a second economy.

Supported resource keys:

- food
- wood
- stone
- charcoal
- ironOre
- ironIngot
- steelIngot

Canonical flow:

`Resource owner -> Listing / BuyOffer -> Reservation -> canonical Trade Kernel -> Wallet + Resource Authority -> Merchant Ledger -> Career projection`

## Authority ownership

- resource quantity writer: `material-economy.mjs` over existing personal/household/material accounts
- item-instance writer: `rust-possessions.mjs` unchanged
- money writer: canonical Currency Wallet unchanged
- Listing: existing Merchant Listing collection
- BuyOffer: existing Merchant BuyOffer collection
- Reservation: existing Reservation authority
- settlement/replay: existing Trade Kernel
- accounting: existing Merchant Ledger
- profession/progression: existing Merchant Career projection
- spatial proof: existing Navigation Arrival evidence
- Home Market: existing Home Market authority

No second inventory, wallet, market, trade replay or material ledger is permitted.

## Backward compatibility

Legacy physical item trades remain the default schema.

They keep:

- no `assetType` field
- exact existing Listing shape
- exact existing BuyOffer ID calculation
- exact existing Reservation item IDs
- exact existing Trade fingerprint
- exact existing `|ITEMS|` integrity fingerprint
- exact item-level Merchant cost basis

Bulk rows opt in explicitly with:

`assetType: 'BULK_RESOURCE'`

Legacy records are not rewritten merely because bulk support exists.

## Bulk Listing

A bulk Listing:

- uses the existing Listing collection
- has `assetType:'BULK_RESOURCE'`
- has `itemKind` equal to the canonical resource key
- has quantity + integer unit price
- has no `itemInstanceId`
- has at most one OPEN bulk Listing per seller/resource pair
- remains reference-only; it does not reserve quantity by itself

## Bulk BuyOffer

A bulk BuyOffer:

- uses the existing BuyOffer collection
- has `assetType:'BULK_RESOURCE'`
- requests explicit quantity + integer unit price
- owns no money and no resource
- Producer acceptance creates a canonical procurement Listing, not a hidden transfer

## Bulk Reservation

A bulk Reservation:

- uses the existing Reservation collection
- freezes listing revision, buyer, seller, resource key, quantity and unit price
- has no fake `itemIds`
- prevents reservation quantity from exceeding the Listing snapshot
- remains a lock only; it does not move money or resources

## Canonical resource transfer

`transferMaterialQuantity()` is the only bulk quantity mutation used by settlement.

It must:

- run only in Independent resource ownership mode
- require two living distinct agents
- reject shared resource account self-trade
- validate supported resource key
- validate seller quantity before mutation
- validate buyer capacity before mutation
- decrement seller existing account
- increment buyer existing account
- conserve seller+buyer quantity exactly
- roll back its own mutation if its postcondition fails
- mint no Rust item
- touch no Wallet / Listing / profession state

## Trade Kernel

Bulk settlement is a variant inside the existing Trade Kernel, not another trade engine.

It must retain:

- transaction ID replay protection
- deterministic fingerprint
- market open validation
- canonical arrival / trade range
- Listing revision validation
- Reservation validation
- seller quantity validation
- buyer capacity validation
- Wallet debit/credit
- resource transfer
- post-settlement Listing/Reservation/BuyOffer/Ledger updates
- one staged atomic root
- source world unchanged on failure

Bulk receipt integrity uses a distinct explicit bulk fingerprint form. Item receipt fingerprints remain byte-compatible with released RC4.

## Merchant accounting

Merchant bulk purchases remain in the existing `purchases` array.

They track:

- resource key
- purchased quantity
- remaining quantity
- unit acquisition cost
- total cost
- canonical transaction/listing/reservation references

Merchant bulk resale uses deterministic FIFO acquisition basis.

Example:

- buy 10 wood @ 3
- sell 4 wood @ 5

Then:

- Revenue = 20
- COGS = 12
- Realized Profit = 8
- remaining purchase basis quantity = 6

No shadow profit field or second material accounting ledger is allowed.

## Spatial truth

Knowing a Listing never authorizes remote settlement.

Every buyer must still:

`known market -> RC4_TRAVEL_TO_MARKET -> canonical arrival evidence -> RC4_BUY_LISTING`

This applies equally to item and bulk trades.

## Demand integration

ER1 may project bulk BuyOffers/Listings using the same actor-observed knowledge rules.

World truth may invalidate stale resource supply, but must not leak hidden markets.

Base household shortage for food/wood/stone may become actionable now that canonical bulk settlement exists.

Metal demand remains explicit only when a later Crafter/material procurement contract proves a real need. Do not invent generic iron demand.

## Acceptance attacks

The exact-head candidate must prove at least:

1. wood resource transfers without Rust item creation
2. ironOre transfer uses the same resource authority
3. insufficient seller quantity leaves source bytes unchanged
4. buyer capacity failure leaves source bytes unchanged
5. Producer accepts canonical bulk BuyOffer
6. Merchant must use canonical market arrival before purchase
7. Wallet money is conserved
8. resource quantity is conserved
9. Merchant acquisition basis is stored
10. Merchant partial resale decrements Listing quantity/revision
11. FIFO COGS/Profit is exact
12. Merchant career counts only verified committed bulk trades
13. save/load preserves resources, Listing, replay and ledger
14. corrupt / mismatched asset type fails closed
15. legacy item RC4 tests remain SAT
16. RC2 / RC3.1 / RC3.2 / Adventure retained
17. browser import-map exact-hash invariant retained

## Release gate

Candidate implementation does not imply release.

Required order:

`Success Contract -> exact-head tests -> Verify SUCCESS -> merge exact head -> exact-main Verify -> Pages/public exact release`

Only after those post-merge gates are SAT may ER2 Raw Producer claim paid surplus market settlement as a released dependency.

UNKNOWN is never PASS.
