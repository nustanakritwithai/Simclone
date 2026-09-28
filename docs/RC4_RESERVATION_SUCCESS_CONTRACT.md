# RC4 Canonical Reservation Authority — Success Contract

Status vocabulary: SAT / VIOL / UNKNOWN. UNKNOWN is never PASS.

## Scope / authority

Canonical writer: `src/merchant-reservation.mjs`.

It owns Reservation identity, ACTIVE item locks, terminal lifecycle, global ACTIVE projection, serialization/migration and reconciliation only.

It does not own or mutate Rust item ownership, Wallet/currency, Home Market lifecycle, Listing truth, Trade commit/replay, AI state or UI state.

## Canonical record

```js
{
  id,
  marketId,
  listingId,
  listingRevision,
  sellerId,
  buyerId,
  itemKind,
  quantity,
  unitPrice,
  itemIds,
  createdTick,
  status,          // ACTIVE | COMMITTED | RELEASED | CANCELED
  terminalTick?,
  terminalReason?,
  transactionId?  // COMMITTED only
}
```

The Reservation ID is deterministic from the complete frozen reservation identity, including `createdTick`. Exact replay of the same request is idempotent. Corrupt duplicate IDs fail closed.

## Listing lock

Creation requires a current OPEN canonical Listing and exact `listingRevision`. A stale revision fails before any Reservation is written.

Every ACTIVE Reservation freezes exact sorted `itemIds[]`. `validateReservationState()` rejects overlap globally across every market. `globalActiveReservations()` therefore supplies the complete global ACTIVE view expected by Trade Kernel #177; invalid/corrupt state returns null rather than an incomplete view.

## Lifecycle

```text
ACTIVE
→ COMMITTED
→ or RELEASED
→ or CANCELED
```

Terminal records remain for replay/audit but no longer lock item IDs. Same-terminal replay is idempotent; conflicting terminal transitions fail closed. COMMITTED stores the canonical transaction ID. CANCELED is party-controlled.

## Reconciliation

`reconcileReservations()` releases ACTIVE records if the buyer/seller is dead, the Listing is missing/not OPEN, Listing revision is stale, or Listing identity/price/quantity no longer matches the frozen Reservation.

Reconciliation never transfers an item or money and never deletes historical Reservation records.

## Persistence / old-save migration

`serializeReservationState()` and `restoreReservationState()` validate the full collection, including duplicate IDs and cross-market item overlap.

A pre-RC4 save with no Reservation component migrates once to:

```js
{ version: 'RC4-reservation-state/1', reservations: [] }
```

A corrupt present component is never replaced with a fresh empty ledger. Reservation locks/replay history therefore cannot silently disappear after load.

## Direct #177 compatibility

Trade Kernel #177 consumes `reservation(state,id)` plus `activeReservations(state)`. A future explicit B8 adapter may map those directly to:

- `reservationById(canonicalReservationState,id)`
- `globalActiveReservations(canonicalReservationState)`

No second reservation array or test-only Reservation object is permitted.

## Required attacks

Focused proof covers deterministic create/replay, stale revision, dead buyer/seller, closed Listing, same-item cross-market overlap, duplicate-id corruption, terminal lock release, reconciliation, save/load replay and one-shot old-save migration.

No shared-runtime wiring is performed here. Exact-head focused tests and repo Verify remain mandatory before donor SAT. UNKNOWN is never PASS.
