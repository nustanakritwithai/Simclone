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

Run only against the exact integration candidate being evaluated:

~~~bash
RC4_EXPECTED_HEAD="$(git rev-parse HEAD)" node verification/rc4/preflight.mjs
~~~

Exit meanings:

- 0 — preflight SAT only.
- 1 — preflight VIOL.
- 2 — preflight UNKNOWN.

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

Known preparation-time contract attack:

- Trade Kernel #177 requires `listing.id`, `listing.revision`, and `reservation.listingRevision`.
- Observed Pricing/Listing #179 head `ba435943aa7a877fa7f9ff65cc74a961b34f3241` used `listingId` and had no revision.
- Preflight therefore rejects that shape as VIOL if it appears unchanged in the integration candidate.
- Repair belongs to the Pricing/Listing owner. An alias/workaround in integration or tests is forbidden.

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

UNKNOWN is never PASS.
