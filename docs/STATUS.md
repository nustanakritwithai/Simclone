# Simclone — current implementation status

## Released baseline

Current released main:

`3ab58da6289a28dbdde3656ce5d8285f1656ad8f`

Release title:

`Governor v1: office, policy, legitimacy, succession and UI`

Exact-main GitHub Pages proof:
- Pages #79
- SUCCESS
- exact SHA: `3ab58da6289a28dbdde3656ce5d8285f1656ad8f`

## Released gameplay line

The current public release includes:

- Independent Clone World / personal resources / personal homes
- Rust survival crafting, stations and modular housing foundations
- Knowledge / mentorship / relationship evidence
- IC6B adult cohabitation
- IC6C household raw-resource pooling
- IC6D Leadership / follower capacity
- IC7A household recruitment + cooperation
- IC7B household shortage-driven cooperation
- MX2 deterministic regional world generation
- MX3 route/home intelligence
- MX4 neighborhood emergence
- MX5 Community evidence
- MX6 Settlement candidate projection
- MX7 Settlement authority
- VAL1 Visible Autonomous Life
- VAL2 executable personal plans
- VAL2.1 executable-plan read model
- VAL3 deterministic action-prediction shadow
- Governor v1 GOV0–GOV6

## Governor v1 — SAT / RELEASED

Governor is a social office and does not replace productive profession.

Released behavior:

- evidence-backed Governor candidacy
- active Settlement residency + productive adult + Leadership gate
- household support from retained Trust / Respect evidence
- deterministic candidate ranking
- persistent Governor office with valid VACANT state
- bounded Governor term history
- deterministic succession
- food / wood / stone settlement policy
- policy signals enter the existing scorer only
- survival emergency remains stronger
- IC7B household cooperation remains stronger than Governor policy
- successful policy outcomes write bounded Trust / Respect evidence
- Inspector separates profession from Governor office/candidate/policy
- save/load migration and validator coverage

Not included in Governor v1:

- tax / treasury
- elections
- law system
- diplomacy
- military command
- court / political factions
- hereditary office
- ownership transfer

## Verification tiers

Routine PR verification is intentionally focused:

- `npm test`
- active Chromium UI smoke
- Independent desktop smoke

Exact-main Pages release gate keeps:

- `npm test`
- active Chromium UI smoke
- Independent native HTTP/storage desktop smoke
- deployment
- exact public-byte verification

Heavy proofs remain available in the manual `Full Regression Proofs` workflow:

- independent 120-year continuity
- full viewport/browser matrix
- native HTTP/storage matrix
- ecology / survival / lifecycle / death / continuity proofs
- archived navigation and survival UI proofs

Heavy proofs are not silently deleted; they are separated from routine PR latency.

## Active external work

Do not overwrite or fold these into unrelated cleanup:

- PR #123 — Khet Sila separated adventurer rules — draft
- PR #124 — VAL4 deterministic productive outcome verification shadow — draft

Both were created after the Governor release and are separate workstreams.

## Evidence rule

A merge, local test or UI display is not release proof by itself.

Use:

`Success Contract → Candidate → Verify → SAT/VIOL/UNKNOWN → Merge → exact-main Pages → public proof`

UNKNOWN is never PASS.
