# RC4 B7 — Persistence Ownership Contract

Status vocabulary: **SAT / VIOL / UNKNOWN**. UNKNOWN is never PASS.

## Purpose

B7 freezes persistence ownership before B8 integration. It does not edit `src/engine.mjs`, does not attach any RC4 component to production save/load, and does not authorize an assembled Merchant Economy candidate.

Canonical ownership is one component → one root key:

| State | Canonical production root |
| --- | --- |
| Home Market | `homeMarkets` |
| Listings | `merchantListings` |
| BuyOffers | `merchantBuyOffers` |
| Reservations | `merchantReservations` |
| Trade replay | `tradeReplay` |
| Wallet | `currencyWallet` |
| Merchant Ledgers | `merchantLedgers` |
| Career transaction count | `agents[*].merchantTransactions` |
| Career experience | `agents[*].merchantExperience` |

Career progression is embedded in the canonical Agent. A second top-level Career ledger is forbidden.

No `merchantAIJournal` persistence root exists in RC4 unless a later accepted AI contract proves it is required.

## Component migration / restore ownership

The machine-readable source of truth is `verification/rc4/persistence-ownership.json`.

Each missing pre-RC4 component must have exactly one owning migration rule. Corrupt **present** state must fail closed; no replay-bearing component may silently reset to an empty state.

Critical replay-bearing state:

- `tradeReplay`
- `currencyWallet.receipts`
- Reservation terminal/replay records
- Listing/BuyOffer lifecycle collections
- Merchant Ledger accounting/cost basis

Old committed transaction IDs must remain non-spendable/non-countable after save/load.

## B8 boundary

B8 alone may wire these components into the live root and engine persistence.

B8 must:

1. attach the exact declared root keys;
2. call the owning migration/restore paths;
3. reject corrupt present replay-bearing state;
4. perform one authoritative root replacement for canonical trade;
5. run Ledger/Career downstream catch-up from authoritative-root commit truth;
6. prove retry + save/load retry exactly-once semantics;
7. never use UI/localStorage shadow state as authority.

This B7 contract is not B8 implementation.

## Candidate closure rule

B7 may become a donor prerequisite only after every exact head named in the manifest has exact-head Verify evidence. Donor CI is not assembled integration CI.
