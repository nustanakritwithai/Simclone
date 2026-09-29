# ER0B — Canonical Bulk Resource Settlement Success Contract

Status vocabulary: **SAT / VIOL / UNKNOWN**. UNKNOWN never passes.

Base: `main@90cef501a069e5c34a99027654422579b3a6c150` after merged ER0/ER1 PR #211.

## Goal

Close the ER0 blocker that prevented resource-counter assets from participating in paid market trade.

The extension must remain one RC4 market/trade system:

`Home Market → BuyOffer / Listing → Reservation → canonical arrival → Trade Kernel → Wallet + material authority → Ledger`

No second inventory, wallet, market, trade replay or material ledger is allowed.

## Compatible asset vocabulary

- missing `assetType` = released `PHYSICAL_ITEM` behavior;
- explicit `assetType: BULK_RESOURCE` = quantity owned by the existing resource/material authority.

Supported bulk keys are the existing canonical counters:

- food
- wood
- stone
- charcoal
- ironOre
- ironIngot
- steelIngot

Bulk rows never mint fake Rust item IDs.

A canonical bulk receipt therefore uses:

- `itemInstanceId: null`
- `itemIds: []`
- explicit resource `quantity`

## Ownership and writers

- personal/household resource ownership remains `individual-resources.mjs`;
- material debit/credit remains `material-economy.mjs`;
- `trade-material-adapter.mjs` is a thin adapter only;
- money remains `currency-wallet.mjs`;
- lock ownership remains `merchant-reservation.mjs`;
- atomic commit/replay remains `trade-kernel.mjs`;
- Merchant accounting remains `merchant-ledger.mjs`.

Agents sharing the same canonical resource account cannot pay one another for a no-op resource transfer.

## Reservation

Physical reservations retain exact item-ID locks.

Bulk reservations lock a quantity for `sellerId + resource key`.

The sum of active bulk reservations cannot exceed the seller's current canonical balance, including reservations created from different Listings.

Reservation never subtracts resources. Settlement is the writer.

## Atomic settlement

A bulk commit is accepted only if all of these succeed on one staged root:

1. market and Listing snapshot valid;
2. buyer has canonical arrival evidence;
3. Reservation is active and asset-compatible;
4. seller still has unreserved quantity;
5. buyer has sufficient Wallet balance;
6. Wallet transfer succeeds;
7. material authority subtracts seller quantity;
8. material authority adds identical buyer quantity;
9. Trade replay receipt appends once;
10. Listing / Reservation / BuyOffer lifecycle commits;
11. Merchant Ledger / career projection commits where applicable;
12. postconditions prove money and resource conservation.

Any failure discards the complete staged root.

## Merchant Ledger

Bulk Merchant purchases use `remainingQuantity`, never fake item IDs.

Bulk resale cost basis consumes purchased quantity deterministically in purchase order (FIFO). Selling bulk quantity without canonical purchase basis remains UNKNOWN rather than inventing acquisition cost.

## ER1

Observed funded bulk BuyOffers and valid bulk Listings become `bulk-resource` demand/supply signals with `tradable:true`.

This replaces ER1's previous intentional `tradable:false` blocker once this candidate is accepted.

## Acceptance attacks

- real ironOre Producer → Merchant paid trade;
- exact Wallet conservation;
- exact resource quantity conservation;
- no fake item identity;
- replay no-op;
- destination-capacity rollback;
- cross-listing oversell rejection;
- bulk Merchant purchase basis;
- save/load continuity;
- legacy physical asset semantics retained;
- full RC2/RC3/RC4/RC5/Adventure regression gates retained.

Implementation does not make ER2 reserve/surplus policy complete. It only makes its canonical paid settlement route possible.

UNKNOWN never passes.
