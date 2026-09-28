# RC4 Merchant Economy verification handoff

This directory is owned by the RC4 Acceptance / Attack Suite workstream.

It is intentionally non-production.

Files:

- `merchant-economy-matrix.json` — machine-readable 15-phase acceptance/attack matrix. Every prepared row starts UNKNOWN.
- `merchant-economy-fixture-contract.json` — legal scenario setup and anti-injection rules for A=Producer, B=Merchant, C=Customer.
- `preflight.mjs` — exact-head/static fail-closed check for an assembled integration candidate.

Canonical human-readable contract:

- `docs/RC4_MERCHANT_ECONOMY_ACCEPTANCE_SUITE.md`

## Preflight

Run only against the exact integration candidate being evaluated. Until canonical owners are supplied for the hard-stop dependencies, preflight MUST remain UNKNOWN.

~~~bash
RC4_EXPECTED_HEAD="$(git rev-parse HEAD)" \
RC4_RESERVATION_MODULE="src/<approved-reservation-authority>.mjs" \
RC4_MARKET_BINDING_MODULE="src/<approved-market-binding>.mjs" \
RC4_ARRIVAL_EVIDENCE_MODULE="src/<approved-navigation-evidence>.mjs" \
node verification/rc4/preflight.mjs
~~~

The three module paths are declarations of already-approved authorities/bindings. Supplying a test-only or hidden adapter is a VIOL, not a way to unlock the gate.

Exit meanings:

- 0 — preflight SAT only; inspect `masterGateResult` separately.
- 1 — preflight VIOL.
- 2 — preflight UNKNOWN.

`masterGateResult` is SAT only when the static/declaration-level hard-stop dependencies checked by preflight are present. It still does not replace executable Phase-0 and Phase-1..15 proof.

A preflight SAT is **not** RC4 integration SAT. The script deliberately reports:

~~~text
integrationVerdict: UNKNOWN
~~~

until the complete vertical, attack, save/load, migration, desktop/mobile browser, retained-regression and independent Red Team gates are executed on that exact SHA.

## Master Gate

Before the Integration Lead supplies one assembled exact candidate:

- prepare/maintain tests, fixtures and matrices;
- keep unexecuted rows UNKNOWN;
- do not wire a hidden test adapter;
- do not modify production runtime to satisfy this suite;
- do not convert donor-level SAT into integration SAT.

Current Master Gate locks:

- #179 repaired exact head must gain exact-head Verify evidence and remain contract/source aligned;
- Home Market must own Listing/BuyOffer reference mutation;
- market `tradeRange` must have a canonical source;
- Navigation must own verified arrival/position evidence;
- Reservation must have a canonical writer, lifecycle, persistence and global ACTIVE view;
- BuyOffer must gain canonical persistence/procurement matching;
- post-settlement Listing/Reservation transitions must be defined;
- outer commit must stage authoritative mutations and replace the live root once.

Known preparation-time contract attack:

- Trade Kernel #177 requires `listing.id`, `listing.revision`, and `reservation.listingRevision`.
- Prior Pricing/Listing #179 head `ba435943aa7a877fa7f9ff65cc74a961b34f3241` used `listingId` and had no revision.
- Latest observed repaired #179 head `964b14b21c1e4d0ce872c3343b9bcce7c1d41f2f` now exposes canonical `id`/`revision`, revision mutation rules, uniqueness and stale-revision checks.
- Preflight deliberately keeps the old mismatch as a regression attack and rejects it if it reappears in the integration candidate.
- This donor repair is not integration SAT. An alias/workaround in integration or tests remains forbidden.

## Browser proof

Use the repository's existing browser-proof discipline:

- a validated save may prepare prerequisites;
- RC4 business mutations claimed as acceptance must occur through real UI actions/command intent/runtime validation;
- browser-side direct mutation cannot make a trade, walk, wallet update, ledger update, Career progress or verified receipt pass.

Required reference viewports:

- Desktop: 1440 x 1000
- Mobile: 390 x 844

## After merge

Candidate evidence cannot be reused as production evidence.

Capture the new merged-main SHA and rerun:

- complete RC4 acceptance/attack suite;
- all retained regressions;
- Pages/deployment;
- exact deployed-byte checks;
- required public desktop/mobile browser proof.

Machine-readable matrix now contains **171** checks including 13 Phase-0 Master Gate readiness rows. All unexecuted rows remain UNKNOWN.

UNKNOWN is never PASS.
