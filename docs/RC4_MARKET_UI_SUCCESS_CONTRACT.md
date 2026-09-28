# RC4 Market UI / Visual — Success Contract

**Owner:** RC4 MARKET UI / VISUAL AGENT  
**Branch:** `feature/rc4-market-ui-prototype`  
**Scope:** prototype/docs only  
**Production integration:** forbidden until accepted by RC4 Integration Lead

## Success statement

A player can identify which existing homes are operating markets, inspect market and merchant information, understand listings/buy offers and receive transaction feedback without the UI becoming an authority for money, items, ledger, profession or market state.

## Scope boundary

Allowed changes:

- `docs/wip/rc4-market-ui/**`
- `docs/RC4_MARKET_UI_SUCCESS_CONTRACT.md`

Forbidden changes in this branch:

- `src/**`
- production `index.html`
- production CSS / boot / import maps
- save/load schema
- wallet or currency writers
- Rust possession/item writers
- Merchant Ledger writers
- profession writers
- Home Market state writers
- transaction settlement

Any forbidden production change is an automatic **VIOL**.

## Acceptance gates

### UI-1 — Home Market visual identity

SAT only if the prototype shows:

- shop sign;
- storefront treatment;
- item display;
- explicit OPEN/CLOSED indicator;
- original home silhouette/identity remains legible;
- ordinary home is visually distinct from Home Market;
- market is not represented as a replacement building authority.

### UI-2 — Market Inspector

SAT only if the inspector displays:

- owner;
- market status;
- listings;
- buy offers;
- stock;
- revenue;
- COGS;
- realized profit.

### UI-3 — Listing UI

Each listing visibly exposes:

- item;
- quantity;
- unit price;
- stock available.

UI must not decrement any field optimistically.

### UI-4 — Buy Offer UI

Each offer visibly exposes:

- item wanted;
- quantity wanted;
- bid/unit price.

### UI-5 — Merchant Inspector

SAT only if it displays:

- `Profession: Merchant`;
- verified transaction count;
- revenue;
- COGS;
- realized profit;
- current stock summary;
- current merchant goal/proposal.

### UI-6 — Transaction Feedback

A verified result presentation contains:

- buyer;
- seller;
- item;
- quantity;
- total price.

Success feedback is forbidden before a VERIFIED transaction result. Intent submission alone cannot render a successful sale.

### UI-7 — Authority lock

UI may do only:

```text
snapshot → display
user action → command intent
```

UI must not:

- write wallet;
- move item;
- write Merchant Ledger;
- change profession;
- create/update Home Market state directly;
- commit a trade;
- fabricate stock or a verified result.

UNKNOWN is not PASS and must not enable a transaction action.

### UI-8 — Android landscape

At reference landscape size 915×412:

- panel does not cover the whole world;
- world context remains visible;
- important touch controls are at least 44 CSS px in one dimension;
- text remains readable;
- inspector content scrolls;
- inspector has an accessible close control;
- status is not color-only.

### UI-9 — Prototype isolation

Standalone prototype works without production runtime imports and all changed files remain within the allowed scope.

### UI-10 — Deliverables

Required artifacts exist:

- interactive prototype;
- CSS/visual assets;
- screenshots;
- interaction notes;
- read-model/snapshot handoff notes;
- this success contract.

## Verification matrix

| Gate | Evidence | Result rule |
|---|---|---|
| UI-1 | world screenshot + prototype DOM | SAT only when Home + Market remains visibly a home |
| UI-2–5 | inspector screenshots + DOM | all required fields visible |
| UI-6 | verified-transaction screenshot | no optimistic success |
| UI-7 | source review of JS + interaction notes | no domain mutation path |
| UI-8 | 915×412 screenshot | world visible + panel scroll/close/touch layout |
| UI-9 | changed-file diff | no production file touched |
| UI-10 | branch tree | all deliverables present |

## Handoff requirement

Integration Lead must map this prototype onto the accepted canonical RC4 market/trade/pricing/career contracts. This branch does not choose or override those domain authorities.

Final branch status must remain **DO NOT MERGE / prototype donor** until Integration Lead explicitly accepts it.
