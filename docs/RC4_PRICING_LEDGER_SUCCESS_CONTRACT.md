# RC4 Pricing & Merchant Ledger — Success Contract

## Provenance boundary repair override — Red Team round 2 (2026-09-28)

**This section supersedes every conflicting statement below about a plain Trade Kernel result being sufficient to become VERIFIED / COMMITTED accounting evidence.**

Red Team proved that receipt shape + valid fingerprint + valid integrityFingerprint + a matching caller-supplied `state.tradeReplay` are still forgeable together. Therefore structural correctness is necessary but is not proof that canonical `settleTradeAtomic()` actually executed.

### Locked rule

`src/merchant-ledger.mjs` must never promote a caller-supplied non-duplicate result to VERIFIED / COMMITTED by itself.

For a structurally valid non-duplicate plain result, including a fully forged matching replay state:

```js
{ state: 'UNKNOWN', reason: 'trade-commit-provenance' }
```

`applyTradeKernelCommitToLedger()` must return the original Ledger unchanged.

The following are explicitly insufficient provenance and may not turn UNKNOWN into SAT inside #179:

- `ok:true`
- `duplicate:false`
- recomputed valid `fingerprint`
- recomputed valid `integrityFingerprint`
- matching caller-supplied `tradeReplay`
- `verified:true` / `committed:true`
- `verification:'VERIFIED'` / `commitStatus:'COMMITTED'`
- synthetic nonce/signature/flag owned by #179
- caller-supplied verifier callback

This repair intentionally refuses to invent a hidden adapter or a second transaction authority.

### Canonical integration dependency

A future RC4 Integration Contract / Trade Kernel boundary must tie Merchant Ledger ingestion to the actual canonical transaction execution path itself. Until that trusted provenance exists, non-duplicate transaction ingestion is UNKNOWN and cannot mutate purchases, sales, Revenue, COGS or Realized Profit.

Pure accounting arithmetic remains independently testable: `resolveCostBasis()` and `calculateSaleAccounting()` may prove item-level basis and `Revenue = 100 / COGS = 70 / Realized Profit = 30` without claiming that a caller-supplied Trade result committed.

A structurally valid `duplicate:true` result remains a safe accounting no-op and may return SAT/duplicate because it cannot increase accounting state.

### Required adversarial additions

1. forged receipt + recomputed valid fingerprint + recomputed valid integrityFingerprint + forged matching `tradeReplay` => UNKNOWN / no Ledger mutation;
2. forged purchase followed by forged sale => Revenue / COGS / Profit remain unchanged;
3. changed buyer/seller + recomputed hashes + matching forged replay => no accounting;
4. changed `itemInstanceId` / `itemIds` + recomputed hashes + matching forged replay => no accounting;
5. tampered fingerprint/integrityFingerprint remain structural VIOL;
6. Revenue / COGS / Profit arithmetic regression remains SAT independently of provenance.

UNKNOWN is never PASS. This repair does not authorize merge. Red Team must re-run on the new exact head.

---

## Repair override — Trade Kernel #177 direct compatibility (2026-09-28)

This section supersedes any older conflicting Listing / receipt-boundary wording below.

Inspected canonical donor:

- PR #177 exact head: \`73be1764130978f529632aa955bf3a7adf931e29\`
- Trade Kernel listing adapter consumes \`id\`, not \`listingId\`.
- Trade Kernel rejects stale reservations unless \`reservation.listingRevision === listing.revision\`.
- Trade Kernel receipt integrity binds the canonical proposal fingerprint plus exact sorted \`itemIds[]\`.

### Canonical Listing after repair

\`\`\`js
{
  id,
  marketId,
  sellerId,
  itemKind,
  itemInstanceId,
  quantity,
  unitPrice,
  revision,
  status
}
\`\`\`

Rules:

- \`revision\` is a positive safe integer and starts at 1.
- Any authoritative price / quantity / status mutation increments revision exactly once.
- No-op / replay mutation does not increment revision.
- Reservation evidence freezes \`{ listingId: listing.id, listingRevision: listing.revision }\`.
- A stale listing revision is fail-closed.
- At collection level, one physical \`itemInstanceId\` may have at most one \`OPEN\` sale Listing.
- Duplicate create with the same Listing id and physical identity is idempotent and cannot reset revision or status.
- Reusing the same Listing id for a different physical identity is a conflict.
- \`CLOSED\` releases the physical-item listing lock and may be reopened only after rechecking the collection lock.
- \`CANCELED\` and \`FILLED\` are terminal in this slice.
- Listing save/load validates the same duplicate-open-item invariant; corrupt state is rejected.
- Listing remains a reference only and never owns the Rust item.

### Committed receipt boundary after repair

Ledger accepts only a successful Trade Kernel result whose receipt passes the #177 canonical integrity vocabulary and whose returned \`state.tradeReplay\` contains exactly the same committed receipt.

Required receipt facts include:

- exact \`transactionId\`, market/listing/reservation ids and parties;
- exact \`itemKind\`, \`itemInstanceId\`, sorted \`itemIds[]\`, quantity and integer prices;
- \`eventId === 'TRADE:' + transactionId\`;
- recomputed canonical \`fingerprint\`;
- recomputed canonical \`integrityFingerprint = fingerprint + '|ITEMS|' + sorted itemIds\`.

A forged \`{ ok:true, duplicate:false, receipt }\` object without canonical committed replay-state evidence cannot mutate Merchant Ledger. Tampered fingerprint, integrity fingerprint, event id, parties, item ids, quantity or price fail closed. Duplicate replay is a no-op.

Merchant Ledger remains an accounting read model only. It does not settle a transaction, mutate Wallet, mutate Rust Item Authority, create a market, or become profession authority.

### Repair proof added

Focused adversarial suite now covers:

1. canonical Listing vocabulary compatible with #177;
2. revision starts at >= 1;
3. authoritative Listing mutation increments revision;
4. stale reservation revision rejected;
5. matching reservation revision accepted;
6. duplicate OPEN Listing for the same physical item rejected;
7. duplicate create replay idempotent;
8. CLOSED Listing releases physical listing lock and reopen rechecks it;
9. save/load preserves revision;
10. save/load preserves duplicate-item invariant;
11. forged committed object cannot change Ledger;
12. tampered fingerprint cannot change Ledger;
13. tampered integrityFingerprint cannot change Ledger;
14. duplicate transaction cannot increment accounting;
15. Revenue / COGS / Realized Profit regressions remain protected.

UNKNOWN remains not PASS. This repair does not authorize merge; RC4 Red Team still owns acceptance.


## RC3.2 main sync override — 2026-09-28

This candidate is merged forward onto current released source:

- `main@1b60b13394c11bd7b03d10227919f4bb509b02df` (merged PR #174, RC3.2 Iron / Steel economy)
- previous repaired Pricing/Ledger head: `964b14b21c1e4d0ce872c3343b9bcce7c1d41f2f`
- merge strategy: preserve current main tree and add only RC4 Pricing/Ledger-owned modules/tests/docs plus regenerated combined import-map pins
- no Repair-Agent edit to `src/engine.mjs`, Wallet, Home Market, Merchant/Customer AI, profession authority, Rust item authority, or production UI
- RC3.2 metal authority/runtime files come byte-for-byte from current main

The prior exact-head Verify #1964 proves the isolated repaired slice on its old base. It is not the post-sync proof. The merge-forward candidate requires a new exact-head Verify including the RC3.2 native Iron/Steel smoke before Red Team may treat current-main compatibility as SAT.

UNKNOWN remains not PASS and this section does not authorize merge.

## Source / candidate boundary

Starting source inspected before implementation:

- `main@a3c98ecd4023e0b7e8dbec2a1e2d8970f594d19e`
- merged RC3.1 physical Blueprint release source
- candidate branch: `feature/rc4-merchant-pricing-ledger`

Required repository sources were read before coding:

- `AGENTS.md`
- `GAME_PLAN.md`
- `docs/STATUS.md`
- `docs/NEXT_STEPS.md`
- current open PRs / RC4 branches
- Rust item/craft provenance
- existing Kingdom market/trade shadows

This branch owns only Pricing + Merchant accounting. It must not become a Wallet, Inventory, Trade Commit, AI, Housing, Profession or UI authority.

UNKNOWN is never PASS.

## RC4 Trade Kernel vocabulary inspected during implementation

The parallel `feature/rc4-trade-kernel` branch was initially empty, then published its candidate while this work was in progress. The candidate was re-read before finalizing this slice.

Inspected Trade Kernel source blob:

- `src/trade-kernel.mjs`
- blob `e1f828be7007be7ac5c173ac568d1f6ccb79abc5`

Canonical proposal used by the kernel:

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

Important kernel boundaries now adopted by this candidate:

- transaction/reference IDs are bounded strings
- buyer/seller IDs are positive safe integers
- item instance IDs are positive safe integers
- quantity is a positive safe integer, max 128
- `unitPrice` and `totalPrice` are **positive safe integers**
- fractional currency is rejected
- `totalPrice === unitPrice * quantity`
- buyer != seller
- successful atomic settlement returns `{ ok:true, duplicate:false, receipt, state }`
- committed receipt contains the exact transferred `itemIds[]`
- replay returns `{ ok:true, duplicate:true, receipt, state }`

The ledger therefore consumes the **successful settlement result / committed receipt**, not a raw TradeProposal.

A successful non-duplicate kernel result is normalized by the accounting layer as:

```text
VERIFIED + COMMITTED
```

because the kernel has already revalidated the proposal, wallet, items, market/listing/reservation, range, replay state and postconditions before emitting the committed receipt.

Raw proposals, failed results, malformed results, UNKNOWN results and duplicate results do not add accounting totals.

## Existing Rust item / cost evidence

Current Rust item authority is `src/rust-possessions.mjs`.

At craft acceptance the pending order retains:

- `reserved` material quantities
- `reservedItems` item receipts
- deterministic craft snapshot

At craft completion the final item retains facts including:

- `id`
- `kind`
- `createdBy`
- `createdTick`
- optional deterministic `craft` provenance such as `orderId` / `recipeId`

Then the completed order is removed.

Therefore current final self-produced items do **not** retain an authoritative monetary material cost.

Consequences:

- `createdBy` is provenance, not money.
- recipe material quantities are not monetary cost.
- Kingdom shadow prices are not cost authority.
- donor recipe `cost` metadata is not RC4 transaction cost.
- self-produced cost basis is UNKNOWN unless verified production/material cost evidence is supplied for the exact item instance.
- no cost may be fabricated.

## Existing Kingdom market/trade shadows

`src/kingdom-market.mjs` explicitly owns read-only shadow prices and no money/trade mutation.

`src/kingdom-household-trade.mjs` explicitly owns read-only trade opportunities and no stock reservation/cargo/money mutation.

Neither is an acquisition-cost or settlement authority for RC4 Merchant Ledger.

## Deliverable 1 — Canonical Listing

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

V1 status vocabulary:

```text
OPEN | CLOSED | CANCELED | FILLED
```

Rules:

- Listing is reference/intention only.
- Listing owns no Rust item.
- Listing owns no reservation.
- Listing owns no wallet value.
- sellerId/itemInstanceId are positive safe integers.
- quantity is 1..128.
- unitPrice is a positive safe integer, matching Trade Kernel money.
- invalid / negative / zero / fractional / NaN / Infinity price is VIOL.

## Deliverable 2 — Canonical BuyOffer

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

V1 status vocabulary:

```text
OPEN | CLOSED | CANCELED | FILLED
```

Rules:

- BuyOffer is reference/intention only.
- BuyOffer does not reserve or hold money.
- BuyOffer owns no item.
- buyerId is a positive safe integer.
- quantityWanted is 1..128.
- unitPrice is a positive safe integer.

## Deliverable 3 — Deterministic Pricing V1

Formula:

```text
Acquisition Cost
+ Margin
+ bounded scarcity adjustment
= Ask Price
```

Money is integer currency to remain compatible with the RC4 Trade Kernel.

Margin:

- expressed in basis points
- deterministic integer rounding
- bounded by this V1 module

Scarcity adjustment reads only merchant-local observations supplied to the pure function:

```js
{
  localStock,
  targetStock,
  recentDemand
}
```

V1 scarcity adjustment is bounded to ±2500 bps (±25% of acquisition cost).

Forbidden pricing inputs:

- global world inventory
- hidden inventories
- Kingdom-wide perfect market price
- future demand
- Math.random
- wall-clock time
- external API

If acquisition cost cannot be proven, Ask Price is UNKNOWN.

## Deliverable 4 — Merchant Ledger

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

The purchase/sale arrays are accounting provenance needed to prove item-level cost basis and replay handling. They are not wallet balances and not inventory authority.

Accounting identity:

```text
Realized Profit = Revenue - COGS
```

Required example:

```text
Merchant buys Pickaxe at 70
Merchant sells the same Pickaxe at 100

Revenue = 100
COGS = 70
Realized Profit = 30
```

## Committed receipt gate

The ledger updates only from a successful, non-duplicate Trade Kernel settlement result with a valid committed receipt.

Expected success shape:

```js
{
  ok: true,
  duplicate: false,
  receipt: {
    transactionId,
    fingerprint,
    eventId,
    marketId,
    listingId,
    reservationId,
    buyerId,
    sellerId,
    itemKind,
    itemIds,
    quantity,
    unitPrice,
    totalPrice
  }
}
```

Accounting rejects or no-ops:

- raw proposal → UNKNOWN / no mutation
- `ok:false` failed settlement → VIOL / no mutation
- missing commit result → UNKNOWN / no mutation
- malformed receipt → VIOL / no mutation
- replay / `duplicate:true` → SAT no-op
- same transaction already in ledger → SAT no-op
- self trade → VIOL
- invalid price/quantity/total → VIOL

The ledger never calls the kernel settlement function and never writes wallet/inventory state.

## Acquisition cost / cost basis

### Purchased items

A committed purchase receipt records the exact transferred `itemIds[]` and actual `unitPrice`.

Each acquired item instance therefore has a real acquisition cost:

```text
item acquisition cost = committed purchase unitPrice
```

The ledger retains `remainingItemIds` for each purchase lot. Selling an item consumes its accounting cost basis from that lot only.

This supports a multi-item purchase without averaging away item identity.

### Self-produced items

For an item with no prior merchant purchase cost basis, production cost requires explicit upstream evidence tied to the exact item instance:

```js
{
  verification: 'VERIFIED',
  evidenceId,
  itemInstanceId,
  totalCost,
  sourceEvidenceIds
}
```

Rules:

- itemInstanceId must match the sold item.
- totalCost must be canonical non-negative integer money.
- evidence references must exist as supplied provenance references.
- UNKNOWN evidence does not count.
- invalid evidence is VIOL.
- absent evidence is UNKNOWN.
- UNKNOWN never adds Revenue/COGS/Profit for that sale.

Mixed purchased + produced item batches can compute COGS per item only when every item has SAT cost evidence.

## Atomic accounting behavior

`applyTradeKernelCommitToLedger` is pure with respect to its input ledger.

A new ledger is returned only after:

1. current ledger validates,
2. Trade Kernel result is a successful non-duplicate commit,
3. receipt validates against the inspected kernel vocabulary,
4. transaction was not already accounted,
5. merchant is a transaction party,
6. seller cost basis is SAT for every sold item,
7. Revenue / COGS / Profit arithmetic remains safe integer,
8. post-update ledger validates.

Any VIOL or UNKNOWN returns the original accounting state unchanged.

## Save/load continuity

`serializeMerchantLedger` validates before serializing.

`restoreMerchantLedger` validates after parsing.

Cost basis is retained by item instance identity, so save/load must not:

- reset acquisition cost,
- restore already-consumed item basis,
- alter Revenue,
- alter COGS,
- alter Realized Profit.

Byte-stable JSON round-trip is tested for a valid ledger.

## Runtime packaging repair

The first exact-head Verify failed only the repository runtime packaging gates after four new `src/*.mjs` files were added:

- `cache-pins.test.mjs`: import-map count was 108 while runtime modules were 112.
- `release.test.mjs`: merchant modules imported `./merchant-pricing.mjs` without the required `?v=0.5.0` suffix.

Repair applied:

- all merchant internal imports now use `?v=0.5.0`.
- `index.html` import map now contains 112 entries including exact SHA-256 pins for all four merchant modules.
- the `index.html` change is cache/import-map metadata only; no DOM, control, layout or gameplay UI behavior was changed.

## Authority locks

These modules do not import or call:

- `engine.mjs`
- `rust-possessions.mjs`
- Wallet authority
- Housing / HomeMarket
- Profession authority
- Kingdom market shadow
- Household trade shadow
- DOM/browser APIs
- external services

They do not use:

- `Math.random`
- `Date.now`
- `new Date()`
- simulation RNG

## Parallel integration finding — Merchant Career PR #175

PR #175 currently maintains:

```js
agent.merchantRealizedProfit += fact.realizedProfit
```

with only a bounded recent transaction receipt tail.

For RC4 accounting this is an integration **VIOL** if `agent.merchantRealizedProfit` is treated as another authoritative monetary profit ledger.

Repair rule:

- Merchant Ledger `realizedProfit` remains the canonical accounting result.
- Career may consume a read-only projection of ledger results for qualification/progression/UI.
- Career may keep non-monetary progression counters.
- Career must not independently accumulate a second authoritative profit balance.
- bounded replay history cannot replace long-horizon accounting idempotency.

This pricing/ledger branch does not modify PR #175 because Profession/Career is outside its ownership.

## Verification matrix

| Gate | State |
|---|---|
| Current main / branch base checked | SAT |
| Required project docs read | SAT |
| Rust item provenance inspected | SAT |
| Existing monetary production cost retained on final crafted item | UNKNOWN (not present in current main) |
| TradeProposal vocabulary inspected | SAT |
| Trade Kernel committed receipt shape inspected | SAT |
| Listing canonical shape | SAT |
| BuyOffer canonical shape | SAT |
| Integer price compatibility with Trade Kernel | SAT |
| Deterministic pricing | SAT |
| Local-only bounded scarcity | SAT |
| Purchase acquisition cost | SAT |
| Revenue | SAT |
| COGS | SAT |
| Realized Profit | SAT |
| 70 → 100 example = 100 / 70 / 30 | SAT |
| Replay / duplicate no increment | SAT |
| Failed settlement no increment | SAT |
| UNKNOWN no increment | SAT |
| Self trade rejected | SAT |
| negative / fractional / NaN / Infinity rejected | SAT |
| production cost absent → UNKNOWN | SAT |
| verified production evidence supported | SAT |
| multi-item item-level cost basis | SAT |
| save/load cost basis no drift | SAT |
| forbidden authority imports/writes absent | SAT |
| focused test suite | SAT — 15/15 |
| Merchant Career duplicate `merchantRealizedProfit` authority | REPAIRED on PR #175 head `3a6d095556b55317d7dfe76e98fba8add85a25f7`; exact-head Career CI pending |
| prior exact-head Verify #1866 | VIOL — 887/889; two runtime pin/version failures only |
| runtime pin/version repair | SAT by source inspection — 112 pins and versioned merchant imports |
| repaired exact-head repository CI / `npm test` | UNKNOWN until new Actions run finishes |

## Verification command

Focused candidate proof:

```bash
node --test tests/rc4-merchant-pricing-ledger.test.mjs
```

Observed result before final push:

```text
15 tests
15 pass
0 fail
```

Repository routine gate remains:

```bash
npm test
```

No focused/local result authorizes merge. Exact-head CI must be SAT before any future integration decision.

## Definition of Done for this isolated slice

- all six requested deliverable files exist
- no forbidden gameplay/accounting subsystem is edited
- `index.html` changes only runtime import-map/cache pins required by repository policy
- exact branch is based on inspected current main
- focused proof is SAT
- exact-head PR is opened
- CI status is reported SAT / VIOL / UNKNOWN without treating UNKNOWN as PASS
- cross-branch Career accounting conflict is explicitly recorded
- PR remains unmerged


## Master Gate closure repair — B5 + Listing side of B6

This section is additive and supersedes older BuyOffer wording where it conflicts.

### B5 — Canonical BuyOffer persistence

Production collection writer:

- `createBuyOfferCollection()`
- `createBuyOfferInCollection()`
- `transitionBuyOfferInCollection()`
- `serializeBuyOfferCollection()`
- `restoreBuyOfferCollection()`

The collection path computes a deterministic `offerId` from market, buyer, item kind, requested quantity, unit price and created tick. Same request is replay-idempotent. Caller-supplied conflicting IDs fail closed. Duplicate collection IDs and non-deterministic IDs are invalid.

Creation returns an explicit Home Market reference request naming B1's canonical writer:

```text
attachHomeMarketBuyOfferReference
```

The BuyOffer module does not push/splice Home Market arrays and does not become Home Market authority.

### Producer procurement matching

`proposeProducerBuyOfferMatch()` is proposal-only and freezes exact physical item IDs supplied by the Producer-side canonical Rust projection. It creates no Reservation, transfers no item, reserves no money and commits no Trade.

The explicit handoff is:

```text
BuyOffer match proposal
→ #179 canonical Listing request
→ B1 attachHomeMarketListingReference
→ B4 canonical Reservation from the created Listing snapshot
→ #177 canonical TradeProposal / settleTradeAtomic
→ staged post-settlement domain transitions
```

The proposal names those authorities directly. There is no hidden procurement ledger.

### BuyOffer terminal lifecycle

After a verified exact settlement, `applyBuyOfferSettlementInCollection()` changes the staged canonical BuyOffer from OPEN to FILLED only when quantity and unit price match the frozen offer. It is pure; failure leaves the source collection byte-identical.

### B6 — Listing settlement semantics

Generic Listing lifecycle is no longer allowed to fabricate `FILLED`.

`applyListingSettlementInCollection()` owns post-settlement Listing mutation:

- requires current OPEN status;
- requires exact expected revision and unit price;
- requires positive fill quantity not exceeding remaining quantity;
- decrements remaining quantity and increments revision exactly once;
- partial fill stays OPEN;
- zero remaining quantity becomes FILLED with quantity 0;
- any failure returns the original source collection unchanged.

These are domain semantics only. They do not by themselves claim outer atomic settlement. #177 must provide the staged post-settlement hook so Listing + Reservation transitions occur before the live root can be replaced.

Exact-head focused tests and repository Verify are required before donor SAT. UNKNOWN is never PASS.
