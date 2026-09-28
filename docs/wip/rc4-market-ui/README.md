# RC4 Market UI / Visual Prototype

Docs-only prototype for Home Market, Market Inspector, Merchant Inspector, listing/buy-offer cards and verified transaction feedback.

## Scope lock

This folder is presentation-only. It does not import production runtime modules and must not be wired into `index.html`, `src/`, save/load, wallet, Rust possessions, profession, trade settlement or market state until the RC4 Integration Lead accepts the UI contract.

The design follows the existing Simclone UI direction:

- world stays visually dominant;
- a Home Market still reads as the same home, with storefront additions rather than a replacement market building;
- status uses icon + text + color, never color alone;
- inspectors are dismissible, scrollable secondary surfaces;
- Android landscape keeps more than half of the world visible;
- buttons target at least 44 CSS px in the landscape layout;
- UI actions produce command intents only;
- CLOSED and UNKNOWN snapshots cannot emit purchase intents;
- verified transaction feedback accepts only an externally supplied canonical result with `state === "SAT"`, `verification === "VERIFIED"`, `commitStatus === "COMMITTED"`, and `duplicate === false`.

## Files

- `preview.html` — standalone interactive prototype.
- `prototype.css` — world-space market cues, inspector, mobile-landscape layout.
- `prototype.js` — frozen read fixtures, snapshot renderer and intent-only interactions.
- `INTERACTION_NOTES.md` — production handoff rules and event mapping.
- `SNAPSHOT_CONTRACT.md` — minimal read model expected from integration.
- `screenshots/` — captured reference views.
- `visuals/` — visual tokens/assets used by the concept.

## Local preview

Open `preview.html` directly or serve this folder with any static HTTP server.

Useful states:

- `preview.html` — Mira OPEN market.
- `preview.html?view=merchant` — selected Merchant inspector.
- `preview.html?market=market-arin` — Arin CLOSED market; purchase controls disabled.
- `preview.html?market=missing` — explicit UNKNOWN market; no fallback to an OPEN shop.

Verified feedback has no player-facing demo button. A preview harness or Integration Lead adapter supplies the verified result:

```js
window.dispatchEvent(new CustomEvent("rc4:transaction-result", {
  detail: {
    state: "SAT",
    verification: "VERIFIED",
    commitStatus: "COMMITTED",
    duplicate: false,
    transactionId: "tx-041",
    buyerDisplayName: "Nok",
    sellerDisplayName: "Mira",
    itemDisplayName: "Iron Pickaxe",
    quantity: 1,
    totalPrice: 38
  }
}));
```

Anything other than a complete VERIFIED + COMMITTED + non-duplicate result with positive safe-integer quantity/total price is rejected and does not show the success toast.

## Non-authoritative fixture warning

All market/listing/ledger values are illustrative read fixtures. They stand in for authoritative snapshots and are never mutated by UI actions. Production integration must replace them with canonical RC4 snapshots.
