# RC4 Merchant Economy verification handoff

This directory is owned by the RC4 Acceptance / Attack Suite workstream.

It is intentionally non-production.

Files:

- `merchant-economy-matrix.json` — machine-readable Phase 0–15 acceptance/attack matrix. Every prepared row starts UNKNOWN.
- `merchant-economy-fixture-contract.json` — legal scenario setup and anti-injection rules for A=Producer, B=Merchant, C=Customer.
- `master-gate-blockers.json` — machine-readable unresolved Phase-0 blockers, domain owners, required deliverables, affected acceptance rows and forbidden workarounds.
- `preflight.mjs` — exact-head/static fail-closed check for an assembled integration candidate.
- `tests/rc4-acceptance-suite.test.mjs` — meta-test that syntax-checks preflight, validates matrix/fixture structure and proves the preparation branch remains fail-closed UNKNOWN.

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

- #179 donor selection must stay pinned to verified head `da82d2178e605283fabf76b80c91cd731da4ad49` (or a later independently re-verified head); old #179 evidence cannot be reused after head drift;
- Home Market must own Listing/BuyOffer reference mutation;
- market `tradeRange` must have a canonical source;
- Navigation must own verified arrival/position evidence;
- Reservation must have a canonical writer, lifecycle, persistence and global ACTIVE view;
- BuyOffer must gain canonical persistence/procurement matching;
- post-settlement Listing/Reservation transitions must be defined;
- outer commit must stage authoritative mutations and replace the live root once.

Latest donor refresh:

- #179 current verified head: `da82d2178e605283fabf76b80c91cd731da4ad49` — current-main based, Verify #1978 SUCCESS, PR Verify #1979 SUCCESS.
- #180 current prototype donor: `0aa5a824d7da70172a267dbf1f440e69d44ef271` — Verify #1990 SUCCESS; canonical OPEN + listing revision + SAT/VERIFIED/COMMITTED/non-duplicate success vocabulary, but still docs/prototype only.

Known preparation-time contract attack:

- Trade Kernel #177 requires `listing.id`, `listing.revision`, and `reservation.listingRevision`.
- Prior Pricing/Listing #179 head `ba435943aa7a877fa7f9ff65cc74a961b34f3241` used `listingId` and had no revision.
- Current verified #179 head `da82d2178e605283fabf76b80c91cd731da4ad49` is merge-forwarded onto current RC3.2 main, exposes canonical `id`/`revision`, revision mutation rules, uniqueness and stale-revision checks, and has Verify #1978 SUCCESS plus PR Verify #1979 SUCCESS.
- Preflight deliberately keeps the old mismatch as a regression attack and rejects it if it reappears in the integration candidate.
- This donor repair is still not integration SAT. An alias/workaround in integration or tests remains forbidden.

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

Machine-readable matrix contains **171** checks including 13 Phase-0 Master Gate readiness rows. Latest pinned donor refresh: #179 `da82d217…` (#1978/#1979 SUCCESS) and #180 `0aa5a824…` (#1990 SUCCESS). All unexecuted rows remain UNKNOWN.

UNKNOWN is never PASS.


## Takeover audit — 2026-09-29

Latest accepted takeover facts:

- #179 current head is `9b5e63e386f0543f9700237242b2c4f0745a8c2d`; Verify #2013 push and #2015 PR are SUCCESS. Non-duplicate plain Trade results now fail closed as `UNKNOWN / trade-commit-provenance`.
- B3 #185 `34055f557d45ca3c9e9adc118d0f77e658b7f5e9` has green #2020/#2026 CI but is **VIOL** by source audit because complete caller-fabricated arrival evidence can recompute its own deterministic evidenceId without canonical journey provenance.
- B4 #186 `c4d1b544a1203459aa78ef55b83a28db6077056c` passed #2025/#2027 and is donor-scope SAT; P0-08 remains UNKNOWN until assembled integration.
- B1/B2 #184 and B5/B6 #187/#188 remain UNKNOWN pending exact-head/current-main verification and cross-domain proof.
- B7 is **VIOL / incomplete**: Home Market present `{}` can normalize to a fresh empty component instead of failing closed, and persistence ownership is not yet complete for all RC4 roots.
- B8 is `LOCKED_NOT_STARTED` until B1–B7 donor/domain closure is accepted.

Two explicit attack locks are now part of the matrix:
- full fabricated Navigation evidence + recomputed hash/id must fail;
- forged Trade receipt + matching forged tradeReplay + recomputed hashes must not mutate Ledger/Career without trusted canonical execution provenance.
