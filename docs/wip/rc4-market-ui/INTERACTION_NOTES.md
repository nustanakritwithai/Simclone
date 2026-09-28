# RC4 Market UI — Interaction Notes

## Primary world flow

1. Player sees a normal house silhouette first.
2. If that home has a valid Home Market snapshot, presentation layers add only storefront cues: sign, awning/display, and explicit `OPEN` / `CLOSED` badge.
3. Tap the home or storefront cue to open Market Inspector.
4. Inspector remains a side sheet so the world and physical location stay visible.
5. Close button returns immediately to unobstructed world view.

The UI never creates a Market because a house was tapped. An unresolved market ID renders explicit `UNKNOWN`; it never falls back to another shop.

## Market Inspector

Every selected market re-renders from its own snapshot:

- owner
- market status
- listings
- buy offers
- stock summary
- revenue
- COGS
- realized profit

A listing can submit `PURCHASE_INTENT` only when the selected market is `OPEN`, the canonical listing is `OPEN`, its positive `revision` is retained in the intent, and stock evidence is positive. CLOSED/CANCELED/FILLED/UNKNOWN listings render controls disabled. Clicking a listing never decrements buyer money, seller stock, reservations or ledger values.

Buy Offer rows are read-only in this prototype. A future accepted command may create/modify offers, but that command remains domain-authoritative outside UI.

## Merchant Inspector

Read-only display fields are re-bound to the selected market owner:

- `Profession: Merchant`
- verified transaction count
- revenue
- COGS
- realized profit
- current canonical stock summary
- current merchant goal/proposal

The “Request close shop” control emits `MARKET_CLOSE_INTENT` only for an OPEN market. For CLOSED/UNKNOWN it is disabled. The visible status remains unchanged until a new authoritative snapshot arrives.

## Transaction feedback

There is no player-facing “fake success” button and no query-string shortcut that can display a verified sale.

The UI exposes one receive-only boundary:

```text
rc4:transaction-result event
→ validate complete canonical result
→ require state === SAT
→ require verification === VERIFIED
→ require commitStatus === COMMITTED
→ require duplicate === false
→ require positive safe-integer quantity / totalPrice
→ render success feedback
```

The feedback contains buyer, seller, item, quantity, total price and transaction ID. Missing fields, UNKNOWN, SAT-like strings, ACCEPTED intents, FAILED/REJECTED outcomes, duplicate replays, zero/fractional trade values and unverified/uncommitted results are rejected without showing success.

## Required state semantics

`OPEN`, `CLOSED` and `UNKNOWN` are explicit states. UNKNOWN is not coerced to OPEN/CLOSED. Status uses text/icon/shape as well as color.

A stale/invalid/unknown listing must not be presented as purchasable. Command rejection leaves snapshot values unchanged.

## Android landscape

Reference layout targets 915×412 and remains useful down to ~800×360:

- inspector width ≤ 46vw;
- world remains visible behind/beside inspector;
- primary touch targets ≥ 44px;
- panel body scrolls independently;
- close control remains fixed in header;
- persistent bottom controls stay compact and never include a transaction-success shortcut.

## Integration adapter boundary

```text
canonical runtime snapshot
→ RC4 market UI adapter
→ render model
→ DOM

user tap
→ UI command intent
→ Integration Lead command bridge
→ domain validation / settlement
→ authoritative snapshot or verified transaction result
→ UI
```

No reverse mutation path from DOM to ledger/wallet/item/profession/market objects is permitted.
