# RC4 Market UI / Visual Prototype

Docs-only prototype for Home Market, Market Inspector, Merchant Inspector, listing/buy-offer cards and verified transaction feedback.

## Scope lock

This folder is presentation-only. It does not import production runtime modules and must not be wired into `index.html`, `src/`, save/load, wallet, Rust possessions, profession, trade settlement or market state until the RC4 Integration Lead accepts the UI contract.

The design follows the existing Simclone UI direction:

- world stays visually dominant;
- a Home Market must still read as the same home, with storefront additions rather than a replacement market building;
- status uses icon + text + color, never color alone;
- inspectors are dismissible, scrollable secondary surfaces;
- Android landscape keeps more than half of the world visible;
- buttons target at least 44 CSS px in the landscape layout;
- UI actions produce command intents only.

## Files

- `preview.html` — standalone interactive prototype.
- `prototype.css` — world-space market cues, inspector, mobile-landscape layout.
- `prototype.js` — frozen fixture snapshot and intent-only interactions.
- `INTERACTION_NOTES.md` — production handoff rules and event mapping.
- `SNAPSHOT_CONTRACT.md` — minimal read model expected from integration.
- `screenshots/` — captured reference views.
- `visuals/` — visual tokens/assets used by the concept.

## Local preview

Open `preview.html` directly or serve this folder with any static HTTP server.

Useful states:

- `preview.html` — open market inspector.
- `preview.html?view=merchant` — merchant inspector.
- `preview.html?tx=1` — verified transaction feedback.
- `preview.html?view=closed` — closed Home Market selected.

## Non-authoritative fixture warning

All values are illustrative fixtures. Names, prices, stock and ledger values must be replaced by authoritative snapshots when integrated. The prototype deliberately does not derive market truth from its own UI state.
