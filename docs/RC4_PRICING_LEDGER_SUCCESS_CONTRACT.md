# RC4 Pricing & Merchant Ledger — Success Contract

## Source / candidate boundary

Inspected source baseline before work: `main@a3c98ecd4023e0b7e8dbec2a1e2d8970f594d19e` (merged RC3.1).
Candidate branch: `feature/rc4-merchant-pricing-ledger`.

At inspection time these parallel RC4 branches existed but were identical to the same main (0 commits):
- `feature/rc4-trade-kernel`
- `feature/rc4-merchant-career`
- `feature/rc4-market-ui-prototype`

During implementation `feature/rc4-merchant-career` advanced independently; it does not overlap this branch's files. `feature/rc4-trade-kernel` remained identical to main when this contract was frozen.

Therefore the Trade Kernel's eventual committed-receipt field names are **UNKNOWN** at this boundary. This module does not invent or own that receipt. It accepts a small accounting wrapper `{ verification, commitStatus, transaction }`, where `transaction` follows the RC4 canonical TradeProposal vocabulary. The future integrator must adapt the verified Trade Kernel receipt into this wrapper without weakening verification.

UNKNOWN is never PASS.

## Scope

Owned here only:
- canonical Listing
- canonical BuyOffer
- deterministic Pricing V1
- acquisition cost / cost basis read model
- Revenue
- COGS
- Realized Profit
- Merchant Ledger

Explicitly out of scope:
- wallet writer or currency settlement
- Rust possession / inventory writer
- trade commit / reservation authority
- Merchant AI or policy
- housing / HomeMarket
- profession adoption
- production UI
- engine integration

The four production modules are pure. They do not import `engine.mjs`, `rust-possessions.mjs`, housing/profession modules, DOM, wall clock, external APIs or simulation RNG.

## Existing source evidence

Current Rust item truth is owned by `src/rust-possessions.mjs`.

Craft acceptance records material escrow on the pending order as `reserved` and `reservedItems`. Craft completion creates a final item with `id`, `kind`, `createdBy`, `createdTick` and, for generated items, `craft` provenance containing `orderId` / `recipeId` / deterministic ticket data. The completed craft order is then removed.

Important consequence: current final self-produced items do **not** retain a monetary material cost. `createdBy` or `craft.orderId` is provenance, not a cost basis. RC4 must not turn recipe quantities or global shadow prices into a fabricated acquisition cost.

Current Kingdom market/trade modules are read-only shadows and explicitly do not own money or trade settlement. They are not valid cost authority for RC4 Merchant Ledger.

## Canonical Listing

```js
{
  listingId,
  marketId,
  sellerId,
  itemKind,
  itemInstanceId,
  quantity,
  unitPrice,
  createdTick,
  status
}
```

V1 statuses: `OPEN | CLOSED | CANCELED | FILLED`.

A Listing is a reference/intention only. It does not reserve, move, copy or own a Rust item and does not write a wallet.

## Canonical BuyOffer

```js
{
  offerId,
  marketId,
  buyerId,
  itemKind,
  quantityWanted,
  unitPrice,
  createdTick,
  status
}
```

V1 statuses: `OPEN | CLOSED | CANCELED | FILLED`.

A BuyOffer is a reference/intention only. It holds no money and no item.

## Canonical TradeProposal vocabulary consumed by the ledger

```js
{
  transactionId,
  marketId,
  sellerId,
  buyerId,
  itemKind,
  itemInstanceId,
  quantity,
  unitPrice,
  totalPrice,
  listingId,
  reservationId
}
```

Ledger accounting additionally requires external evidence:

```js
{
  verification: 'VERIFIED',
  commitStatus: 'COMMITTED',
  transaction: TradeProposal
}
```

Anything else is `VIOL` or `UNKNOWN` and must not modify the ledger.

The ledger does not make a proposal committed. It only accounts for a transaction after the authoritative Trade Kernel has already verified and committed it.

## Money representation

V1 public values are JS numbers with at most two decimal places. All arithmetic converts to integer minor units first.

Reject:
- negative prices
- `NaN`
- `Infinity` / `-Infinity`
- non-canonical sub-cent values
- unsafe overflow
- `totalPrice !== unitPrice × quantity`
- self trade

Zero is allowed by this accounting layer; business policy may forbid zero-price Listings elsewhere without changing ledger arithmetic.

## Pricing V1

Formula:

```text
Acquisition Cost
+ Margin
+ bounded local scarcity adjustment
= Ask Price
```

Margin is basis points of acquisition cost.

Scarcity adjustment is derived only from merchant-local observations supplied to the pure pricing function:
- `localStock`
- `targetStock`
- `recentDemand`

V1 scarcity adjustment is bounded to `±2500 bps` (±25% of acquisition cost). No world state, hidden inventory, global market average or perfect-market knowledge is read.

If acquisition cost is not proven, pricing returns `UNKNOWN`; it does not invent a cost.

## Cost basis

### Purchased item

Use the merchant's earlier `VERIFIED + COMMITTED` purchase transaction for the same `itemInstanceId` / `itemKind`. Its actual purchase `unitPrice` is the acquisition cost. Quantity remaining is persisted in the ledger for replay-safe later sales.

### Self-produced item

Use production/material cost only when an upstream authority supplies `VERIFIED` production-cost evidence tied to the exact `itemInstanceId`, with stable evidence references.

Current main does not retain enough monetary production evidence on the completed item to derive this automatically. Therefore absent external verified production-cost evidence, the result is `UNKNOWN` and a sale does not change Revenue/COGS/Profit.

This is deliberate. Recipe material quantities and `createdBy` are not silently converted into money.

## Merchant Ledger

Canonical top-level shape:

```js
{
  merchantId,
  purchases,
  sales,
  revenue,
  costOfGoodsSold,
  realizedProfit
}
```

`purchases` and `sales` are accounting/audit entries used to prove replay handling and cost basis. They do not duplicate wallet or inventory state.

Accounting identity:

```text
Realized Profit = Revenue - COGS
```

Example:

```text
Buy Pickaxe 70
Sell Pickaxe 100

Revenue = 100
COGS = 70
Realized Profit = 30
```

A transaction ID already present in purchases/sales is a replay. It returns `SAT + duplicate:true` and changes no totals.

## Atomic accounting rule

`applyCommittedTransactionToLedger` is pure: input ledger is never mutated.

A new ledger is returned only after:
1. existing ledger validates,
2. evidence is `VERIFIED`,
3. commit status is `COMMITTED`,
4. canonical transaction validates,
5. merchant is buyer or seller,
6. replay check passes,
7. seller cost basis is `SAT`,
8. post-update ledger identities validate.

If any required fact is `UNKNOWN`, no partial Revenue/COGS/Profit update occurs.

## Required verification matrix

| Gate | Required | Candidate expectation |
|---|---|---|
| Purchase cost from committed acquisition | yes | SAT |
| Revenue accounting | yes | SAT |
| COGS accounting | yes | SAT |
| Realized Profit identity | yes | SAT |
| Replay cannot increase ledger | yes | SAT |
| Failed transaction cannot increase ledger | yes | SAT |
| UNKNOWN cannot increase ledger | yes | SAT |
| Self trade rejected | yes | SAT |
| Negative / NaN / Infinity rejected | yes | SAT |
| `totalPrice` multiplication checked | yes | SAT |
| Pricing deterministic | yes | SAT |
| Scarcity bounded and local-only | yes | SAT |
| Save/load cost basis byte stability | yes | SAT |
| No wallet/inventory/trade commit writer | yes | SAT |
| Exact Trade Kernel receipt adapter | integration dependency | UNKNOWN until Trade Kernel publishes a committed receipt contract |
| Current-main self-produced monetary cost authority | source dependency | UNKNOWN; current item provenance does not retain it |

## Verification commands

Focused:

```bash
node --test tests/rc4-merchant-pricing-ledger.test.mjs
```

Routine PR gate remains repository policy:

```bash
npm test
```

No branch or local focused result is authority to merge. Exact-head CI remains required; failed or unavailable CI is `UNKNOWN/VIOL`, never PASS.
