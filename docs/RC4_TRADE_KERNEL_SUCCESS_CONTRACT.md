---
type: success-contract
project: Simclone
domain: economy
feature: RC4 Trade Kernel
status: candidate
canonical: true
owner: RC4 Trade Kernel Agent
last_reviewed: 2026-09-28
---

# RC4 Trade Kernel Success Contract

## Goal

Create a deterministic, atomic and replay-safe trade kernel without creating a second item inventory or a second currency authority.

The kernel is deliberately separate from Merchant AI, Customer AI, pricing strategy, profession, housing, production UI and shared-runtime integration.

## Exact starting source

Branch `feature/rc4-trade-kernel` was cut from:

`main@a3c98ecd4023e0b7e8dbec2a1e2d8970f594d19e`

Authority audit on that source found:

- physical item instances are owned by `src/rust-possessions.mjs`;
- `src/kingdom-market.mjs` is explicitly a read-only shadow and says it creates no money/trade mutation;
- `src/kingdom-household-trade.mjs` is explicitly a read-only opportunity shadow;
- `docs/KINGDOM_HOUSEHOLD_TRADE_SUCCESS_CONTRACT.md` explicitly says the existing shadow creates no currency and no central market authority;
- no canonical wallet/currency writer exists on this starting `main`.

Therefore RC4 MUST NOT invent `merchantWallet`, `shopWallet`, a generic second wallet, or a hidden currency ledger just to make the kernel appear integrated. Missing canonical money or market authority is a fail-closed integration dependency and remains UNKNOWN until a separately approved authority exists.

## Authority locks

### Items

The single item authority remains `src/rust-possessions.mjs`.

RC4 adds only generic transfer primitives inside that authority:

- `tradableRustItemIds(state, {agentId, itemKind})`
- `transferRustItemInstances(state, {fromAgentId, toAgentId, itemIds})`

They move the `location.agentId` of existing item instances. They do not mint an item, allocate a new item id, copy an item, replace `createdBy`, or create another inventory.

The transfer refuses equipped items, items held by an open Adventure loot result, dead parties, missing instances and buyer bag overflow.

`src/trade-rust-adapter.mjs` is only a facade over these authority methods. It is not a second writer.

### Currency

The trade kernel accepts a `wallet` adapter only when a canonical wallet authority exists. The adapter contract is:

```text
balance(state, agentId) -> safe integer balance

debit(state, agentId, amount) -> { ok }
credit(state, agentId, amount) -> { ok }
```

The adapter MUST mutate only authoritative state passed to it, MUST be deterministic, and MUST have no external side effects. RC4 provides no production wallet implementation because none exists on the audited starting main.

### Market/listing/reservation

The kernel accepts a canonical market adapter:

```text
market(state, marketId)
listing(state, listingId)
reservation(state, reservationId)
activeReservations(state, marketId)
```

K6 shadow prices and the older household trade shadow MUST NOT be silently promoted into market/listing/reservation authority by RC4.

## Canonical TradeProposal

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

All ids are deterministic caller-supplied ids. RC4 never generates ids from random or wall-clock time.

`quantity`, `unitPrice` and `totalPrice` are positive safe integers. Money is expressed in the canonical wallet's integer minor unit; floating prices, NaN and Infinity are invalid. This prevents floating-point settlement drift.

`totalPrice` MUST equal `unitPrice * quantity` without safe-integer overflow.

## Listing snapshot / reservation contract

An authoritative listing must expose at least:

```js
{
  id,
  marketId,
  status: 'OPEN' | 'CANCELED' | ...,
  revision,
  sellerId,
  itemKind,
  unitPrice,
  quantity
}
```

An authoritative reservation must expose at least:

```js
{
  id,
  status: 'ACTIVE' | ...,
  marketId,
  listingId,
  listingRevision,
  sellerId,
  buyerId,
  itemKind,
  unitPrice,
  quantity,
  itemIds
}
```

A listing snapshot is stale when `reservation.listingRevision !== listing.revision`.

`itemIds` freezes the exact Rust item instances for the transaction. Another active reservation may not reserve any of the same item ids.

## Validation contract

Before settlement RC4 revalidates all of the following against the current state:

1. adapter authorities are present;
2. replay state is valid;
3. `transactionId` is valid and not already committed with different content;
4. buyer and seller ids are valid and distinct;
5. buyer is alive;
6. seller is alive;
7. item kind and item instance id are valid;
8. quantity is a positive bounded safe integer;
9. price fields are positive safe integers and exact;
10. market exists and is open;
11. buyer is inside Manhattan `tradeRange` of the authoritative market position;
12. listing exists, is OPEN and matches market/seller/item/price/quantity;
13. reservation exists, is ACTIVE and exactly matches proposal + listing revision;
14. listing is not stale;
15. a global active-reservation view contains exactly one current reservation, matches the canonical reservation lookup (market/listing/revision/parties/item/price/quantity/itemIds), has unique active reservation ids, and no exact reserved item is held by any other active reservation in any market;
16. seller still owns every exact reserved Rust item instance and every instance is tradable;
17. buyer balance is sufficient;
18. seller credit cannot overflow.

UNKNOWN evidence is not accepted as a validation pass.

## Atomic settlement contract

`settleTradeAtomic()` never mutates its input state.

The algorithm is:

```text
validate current state
→ build immutable SettlementProposal
→ structuredClone(authoritative state) as staged candidate
→ canonical wallet debit on staged state
→ canonical wallet credit on staged state
→ Rust Item Authority transfer on staged state
→ append replay receipt on staged state
→ verify wallet postconditions
→ verify exact buyer item ownership
→ verify exactly one transaction receipt
→ return nextState
```

If any step returns failure, throws, violates a postcondition, or replay storage is full, the staged candidate is discarded. The caller receives no mutated source state. There is no compensating rollback sequence that could itself partially fail.

The shared runtime is intentionally not modified by RC4. A later integration gate may replace its authoritative root with `nextState` only after canonical wallet + market bindings are approved.

## Replay protection

Replay state:

```js
{
  version: 'RC4-trade-replay-1',
  receipts: [ ... ]
}
```

Each committed receipt stores:

- `transactionId`
- deterministic proposal fingerprint
- deterministic receipt-integrity fingerprint binding the proposal fields + exact sorted `itemIds[]`
- deterministic `eventId = 'TRADE:' + transactionId`
- exact `itemInstanceId`
- market/listing/reservation ids
- buyer/seller ids
- item kind
- exact item ids
- quantity/unit price/total price

Rules:

- exact same `transactionId` + same proposal fingerprint returns the existing receipt with `duplicate:true` and performs zero writes;
- same `transactionId` + different proposal is `transaction-conflict`;
- every stored receipt is re-fingerprinted from its own transaction/party/item/price/reference fields and exact canonical `itemIds[]` before replay is trusted;
- tampered `eventId`, party, market/listing/reservation, item kind, `itemInstanceId`, price, quantity or `itemIds` makes replay state invalid and fails closed;
- a committed id is never pruned by this kernel;
- replay storage is bounded at 512 receipts and fails closed when full rather than evicting old ids and making old replays spendable again;
- one transaction produces one receipt/event id only.

## Determinism

Forbidden in RC4 gameplay rules:

- `Math.random()`
- `Date.now()`
- `new Date()`
- wall-clock expiry
- external API calls

Freshness is version/revision evidence, not elapsed wall-clock time.

## Repair verification — 2026-09-28

The first exact-head repo gate exposed three violations. This contract now freezes their repairs:

- **Global reservation lock:** the market adapter's `activeReservations(state)` MUST be a complete global active-reservation projection across all markets. The kernel fails closed if the current reservation is omitted, duplicated, malformed, or disagrees with the canonical `reservation()` lookup. An item reserved by any other active reservation in any market is rejected as `item-reserved`.
- **Replay receipt integrity:** every receipt stores the proposal fingerprint plus an `integrityFingerprint` covering the canonical proposal fields and sorted exact `itemIds`. Replay validation recomputes both, requires `eventId === 'TRADE:' + transactionId`, validates `itemKind` / `itemInstanceId`, and rejects field or item-list tampering before duplicate replay can succeed.
- **Browser cache pins:** because RC4 adds runtime `.mjs` files and changes `rust-possessions.mjs`, `index.html` import-map pins MUST be regenerated even though shared runtime integration remains out of scope. Pinning makes modules cache-addressable; it does not import or execute the trade kernel from production boot.

These repairs do not create a wallet, market authority, runtime command, AI behavior, UI integration, or second inventory.

## Required adversarial proof

Tests must cover at least:

- successful exact settlement;
- buyer funds insufficient;
- seller item missing;
- stale listing;
- canceled listing;
- closed market;
- invalid reservation;
- duplicate transaction id conflict;
- exact replay idempotence;
- quantity 0;
- negative price;
- NaN / Infinity;
- fractional quantity/price/total;
- buyer = seller;
- buyer dead before commit;
- seller dead before commit;
- overlapping reservation on item in the same market;
- overlapping reservation on the same item in another market;
- incomplete/malformed global reservation evidence;
- total price mismatch;
- buyer outside trade range;
- wallet credit failure after staged debit leaves source unchanged;
- item transfer failure after staged money mutation leaves source unchanged;
- Rust batch transfer validates before mutating;
- Rust transfer preserves exact ids and creator provenance;
- equipped/open-loot items are not tradable;
- buyer Rust bag overflow is immutable failure;
- twin deterministic inputs produce byte-identical next states;
- replay receipt field/item tampering is rejected;
- source audit finds no random/wall-clock gameplay rule.

## Acceptance / verification state

| Area | State | Evidence required |
| --- | --- | --- |
| TradeProposal contract | SAT candidate | pure tests |
| Validator | SAT candidate | adversarial pure tests |
| Atomic staged settlement algorithm | SAT candidate | staged debit/credit/item failure tests |
| Replay protection | SAT candidate | replay + conflict + single receipt tests |
| Rust item transfer authority extension | SAT candidate after repo CI | authority tests on full repo |
| Canonical wallet binding | UNKNOWN | no canonical wallet exists on audited starting main |
| Canonical market/listing/reservation binding | UNKNOWN | current K6/household trade are shadow only |
| Shared runtime/save integration of `tradeReplay` | OUT OF SCOPE / UNKNOWN for production | explicitly forbidden from RC4 integration scope |
| Production end-to-end money trade | UNKNOWN | wallet + market + integration dependencies absent |

**Overall RC4 production status is UNKNOWN until the missing canonical authorities are supplied and a later integration gate proves them. UNKNOWN is never PASS.**

The RC4 PR must remain unmerged while overall state is UNKNOWN.


## Master Gate closure repair — B6 outer staged post-settlement boundary

This section supersedes any older wording that allowed a successful Trade candidate to return before Listing / Reservation / Ledger post-settlement authorities completed.

### Required staged sequence

`settleTradeAtomic()` now keeps the entire transaction on one cloned root:

```text
clone root
→ validate proposal/market/listing/reservation/range/wallet/items
→ wallet debit + credit on staged root
→ exact Rust item transfer on staged root
→ append canonical Trade receipt/replay on staged root
→ postSettlement.apply(staged, canonical execution context)
→ postSettlement.verify(staged, canonical execution context)
→ wallet/item/trade replay postconditions
→ return staged root candidate
```

The live input root is never mutated by the kernel. The caller still owns the later single live-root replacement.

The post-settlement execution context is emitted only from inside the canonical settlement path and includes:

```js
{
  provenance: 'CANONICAL_TRADE_SETTLEMENT_EXECUTION',
  proposal,
  receipt
}
```

The future B8 explicit adapter must use that hook to stage the accepted Merchant Ledger write plus B6 Listing transition plus B4 Reservation terminal transition. The hook may not become a second Trade authority.

### Fail-closed behavior

A non-duplicate settlement cannot return success without an explicit `postSettlement.apply` and `postSettlement.verify` authority.

If apply or verify fails after wallet/item/receipt mutations have occurred on the staged clone, the function returns failure and the caller-supplied live root remains byte-identical. No compensating rollback is used or counted as atomicity.

Exact transaction replay returns the already committed root unchanged and does not re-run post-settlement transitions.

### Proof

Focused attacks cover:

- missing post-settlement authority;
- injected post-settlement apply failure after staged money/item/receipt writes;
- injected postcondition failure after staged Listing/Reservation mutation;
- successful partial Listing fill and Reservation COMMITTED state;
- duplicate replay leaves Listing revision / Reservation terminal state unchanged;
- live source bytes stay identical on every injected failure.

This branch defines the atomic extension point only. It does not assemble #179 + B4 into production runtime and therefore does not start B8. Exact-head repository Verify remains required. UNKNOWN is never PASS.


## B7 stacked persistence repair — Trade replay

The Trade Kernel owns the canonical production root key `tradeReplay` for committed transaction replay evidence.

This stacked repair adds:

- `TRADE_REPLAY_ROOT_KEY = 'tradeReplay'`
- `migrateTradeReplayState(raw)`
- `serializeTradeReplayState(tradeReplay)`
- `restoreTradeReplayState(serialized)`

Persistence rules:

- a pre-RC4 save with no replay component migrates once to the empty canonical replay component;
- a valid replay component round-trips byte-stably;
- corrupt present replay state fails closed and is never replaced by an empty replay ledger;
- an old committed transaction remains duplicate/no-op after restore;
- production root wiring remains B8-owned and is not added here.

UNKNOWN is never PASS. Exact-head Verify is required.
