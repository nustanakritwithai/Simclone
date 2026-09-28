# RC4 Market UI — Interaction Notes

## Primary world flow

1. Player sees a normal house silhouette first.
2. If that home has a valid Home Market snapshot, presentation layers add only storefront cues: sign, awning/display, and explicit `OPEN` / `CLOSED` badge.
3. Tap the home or storefront cue to open Market Inspector.
4. Inspector remains a side sheet so the world and physical location stay visible.
5. Close button returns immediately to unobstructed world view.

The UI must never create a Market because a house was tapped. No valid market snapshot means no market storefront UI.

## Market Inspector

Read-only display fields:

- owner
- market status
- listings
- buy offers
- stock summary
- revenue
- COGS
- realized profit

Listing tap may submit a purchase command intent. It does not decrement buyer money, remove seller stock, reserve an item, or show success until the trade authority returns a verified result.

Buy Offer rows are read-only in this prototype. A future accepted command may create/modify offers, but that command remains domain-authoritative outside UI.

## Merchant Inspector

Read-only display fields:

- `Profession: Merchant`
- verified transaction count
- revenue
- COGS
- realized profit
- current canonical stock summary
- current merchant goal/proposal

The prototype “Request close shop” control emits `MARKET_CLOSE_INTENT`; the visible snapshot remains unchanged. Production must use the Integration Lead-approved canonical command name.

## Transaction feedback

Only show the success treatment after a VERIFIED transaction result. The feedback contains:

- buyer
- seller
- item
- quantity
- total price
- optional transaction ID for drill-down

Do not infer success from an accepted button tap or from an optimistic local state.

## Required state semantics

`OPEN` and `CLOSED` must be expressed with text and icon/shape as well as color. `UNKNOWN` must not be coerced into either status; render it explicitly as `UNKNOWN`/unavailable and disable transaction actions.

A listing with stale/invalid/unknown verification must not be presented as purchasable. A command rejection must leave the snapshot unchanged and show a bounded rejection message.

## Android landscape

Reference layout targets 915×412 and remains useful down to ~800×360:

- inspector width ≤ 46vw;
- world remains visible behind/beside the inspector;
- primary touch targets ≥ 44px;
- panel body scrolls independently;
- close control remains fixed in header;
- persistent bottom controls are compact and do not cover the center of world space.

## Integration adapter boundary

Recommended one-way data flow:

```text
canonical runtime snapshot
→ RC4 market UI adapter
→ render model
→ DOM

user tap
→ UI command intent
→ Integration Lead command bridge
→ domain validation / settlement
→ next canonical snapshot or verified result
→ UI
```

No reverse mutation path from DOM to ledger/wallet/item/profession/market objects is permitted.
