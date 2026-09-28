# RC4 Merchant Economy Integration Acceptance / Attack Suite

Status vocabulary: SAT / VIOL / UNKNOWN. UNKNOWN is never PASS.

Owner: RC4 ACCEPTANCE / ATTACK SUITE OWNER

This branch is verification-only. It MUST NOT implement or repair an RC4 domain subsystem, change authority ownership, alter shared runtime to satisfy a test, or reduce acceptance.

## Exact preparation baseline

Prepared from merged RC3.2 main:

- main SHA: 1b60b13394c11bd7b03d10227919f4bb509b02df
- RC3.2 PR #174 candidate: 0498dc9bc2b108741c60eee439dc6cba67f91b9d
- RC3.2 merged-main SHA: 1b60b13394c11bd7b03d10227919f4bb509b02df

Observed donor heads at latest acceptance audit:

| PR | Domain | Exact head | Exact-head evidence at latest audit |
| --- | --- | --- | --- |
| #175 | Merchant Career | 51f3c9727429ecfb055548c8bf0ffed09a70b0d9 | Verify #1946 SUCCESS |
| #176 | Home Market | 79ae6792063f8c70a9e676028646f2cd05a62d0a | Verify #1861 SUCCESS |
| #177 | Trade Kernel | 73be1764130978f529632aa955bf3a7adf931e29 | Verify #1898 SUCCESS |
| #178 | Merchant / Customer AI | 8c6c4ffb506cd192e2f81558880a7480ccf13932 | Verify #1864 SUCCESS |
| #179 | Pricing / Merchant Ledger | da82d2178e605283fabf76b80c91cd731da4ad49 | Verify #1978 push SUCCESS + #1979 PR SUCCESS; based on current RC3.2 main |
| #180 | Market UI prototype | 0aa5a824d7da70172a267dbf1f440e69d44ef271 | Verify #1990 SUCCESS; docs/prototype donor only |
| #181 | Canonical Wallet | 6d9eb098333eccc72e2352e605e5364d25e97768 | Verify #1959 SUCCESS |

#179 has now been merge-forwarded onto current RC3.2 main `1b60b13394c11bd7b03d10227919f4bb509b02df` and exact-head verification is green. #175, #176, #177, #178, #180 and #181 remain isolated donors rooted on the earlier pre-RC3.2 base unless separately rebuilt. No donor head by itself is the RC4 integration candidate.

Compatibility attack retained: #177 requires authoritative `listing.id`, `listing.revision`, and `reservation.listingRevision`. Prior #179 head `ba435943aa7a877fa7f9ff65cc74a961b34f3241` exposed `listingId` and no revision; that shape remains a permanent regression VIOL. Current #179 head `da82d2178e605283fabf76b80c91cd731da4ad49` is merge-forwarded onto RC3.2 main, exposes canonical id/revision, increments revision on authoritative mutation, enforces one OPEN listing per physical item, checks stale reservation revision, and has exact-head Verify #1978 SUCCESS plus PR Verify #1979 SUCCESS. This closes the isolated #179 exact-head/base prerequisite, but it does not constitute integrated RC4 SAT.

## Master Gate rule

Before the RC4 Master Gate opens, this workstream may prepare tests, fixtures, matrices and static preflight only.

No RC4 integration result may be called SAT until all required proof runs are executed on one exact integration head SHA.

After merge, all pre-merge integration evidence expires for production acceptance. The suite MUST be rerun on the exact merged-main SHA and public deployment proof must be tied to that new SHA.

## PHASE 0 — Master Gate Readiness

**Phase 0 is a hard stop. Every Phase-0 row must be SAT before Phase 1 can count as integrated acceptance evidence.**

Required before Master Gate opens:

- one exact integration head SHA is supplied and matches the checked-out candidate;
- integration base is the current audited merged-main, or compatibility is explicitly re-audited after any main movement;
- every selected donor exact head is frozen and has exact-head evidence; old-head CI cannot be reused;
- selected #179 source must be pinned to the verified repaired head `da82d2178e605283fabf76b80c91cd731da4ad49` (or a later independently re-verified head) and preserve canonical `id + revision` semantics;
- Home Market exposes canonical owner-controlled mutation for `listingIds` / `buyOfferIds`; the Integrator may not push/splice those arrays directly;
- the #177 market projection has documented canonical sources for `id/open/x/y/tradeRange`; `tradeRange` may not be guessed;
- Navigation owns the verified position/arrival evidence consumed by #178; Integration/UI/AI may not fabricate `verified:true`;
- one canonical Reservation authority exists with deterministic identity, lifecycle, persistence, complete global ACTIVE view and cleanup/reconciliation semantics;
- Buy Offer has an authoritative persistent collection and an approved Producer-procurement matching path;
- post-settlement Listing quantity/status/revision and Reservation terminal/release rules have named owners;
- production persistence ownership is explicit for Listings, BuyOffers, Reservations, tradeReplay, Merchant Ledgers and any required AI journal;
- all compatibility adapters are explicit documented projections over canonical authorities; hidden normalization is forbidden;
- the outer integration commit path stages all authoritative RC4 mutations and replaces the live root once only after every required postcondition succeeds.

Current audited blockers from the Integration Contract are therefore not ordinary later-phase UNKNOWNs; they keep the Master Gate closed:

- canonical Home Market reference mutation API is missing;
- canonical `tradeRange` source is undefined;
- canonical Navigation arrival-evidence producer is undefined;
- Reservation writer/lifecycle/persistence/ID rule is undefined;
- BuyOffer procurement matching/persistence is undefined;
- post-settlement Listing/Reservation transition semantics are undefined;

Resolved donor prerequisite at latest audit:

- #179 repaired Pricing/Listing/Ledger head `da82d2178e605283fabf76b80c91cd731da4ad49` is on current RC3.2 main and has Verify #1978 SUCCESS plus PR Verify #1979 SUCCESS.
- #180 prototype head `0aa5a824d7da70172a267dbf1f440e69d44ef271` has Verify #1990 SUCCESS and now uses canonical OPEN/revision/VERIFIED+COMMITTED+duplicate:false presentation vocabulary. It remains a docs/prototype donor and is not production UI integration.

No Integration Lead assumption may convert any remaining blocker to SAT.

## Non-negotiable authority locks

- Clone identity, life and canonical position remain Simclone authorities.
- Physical item identity and ownership remain Rust possession authority.
- Money balance and monetary replay remain the single canonical wallet authority.
- Trade commit and trade replay remain the canonical Trade Kernel.
- Home Market is a component of an existing completed personal home and is not housing authority.
- Listing and Buy Offer are references/intents; they do not own physical item or money.
- Merchant Ledger owns Revenue / COGS / Realized Profit.
- Merchant Career may read ledger profit but MUST NOT write accounting.
- Merchant / Customer AI may emit intent/proposal only.
- UI may read state and dispatch command intent only.

Any test helper that mints the sale item, directly moves ownership, directly edits a wallet, fabricates VERIFIED/COMMITTED evidence, teleports a customer, writes the ledger, or writes Career progression is invalid primary acceptance evidence.

## Reference actors and economics

Use at least three distinct living Clone identities:

- A = Producer
- B = Merchant
- C = Customer

Reference accounting case:

- B acquires one exact physical item from A for 70 integer currency units.
- B later sells that same exact item to C for 100 integer currency units.
- Expected Merchant Ledger after the sale: Revenue 100, COGS 70, Realized Profit 30.

Fixture metadata may identify roles and expected invariants. It MUST NOT create authoritative truth that the production runtime did not create.

## PHASE 1 — Producer

A must produce a real physical item through the existing production / Rust authority.

Required proof:

- the item has one canonical physical instance id;
- createdBy equals A;
- craft / production provenance is retained;
- no acceptance helper pushes a synthetic sale item into Rust possessions;
- save then load preserves the same instance identity and provenance.

Result rule:

- SAT only from canonical production evidence;
- VIOL if the item is minted, cloned, reminted or provenance changes;
- UNKNOWN if production cannot be exercised on the candidate.

## PHASE 2 — Merchant Qualification and Home Market

B must qualify Merchant through canonical profession authority, own/control a real completed personal home and attach Home Market to that existing home.

Required proof:

- Merchant transition routes through canonical profession authority;
- completed home exists before market creation;
- one home has at most one active market;
- market creation does not create a second building or second housing record;
- housing capacity is byte-identical before/after market attachment;
- market owns no wallet and no physical item;
- old save missing Home Market initializes deterministically.

## PHASE 3 — Merchant Procurement: A to B

B creates a Buy Offer and A sells the exact Phase-1 item to B.

Buy Offer acceptance additionally proves that the offer is reference/intention only, holds no spendable money or physical item, is referenced exactly once by the owning Home Market through its canonical reference API, and survives save/load without duplicate reference drift.

Before committed trade:

- A owns the item;
- B does not own the item;
- capture total currency across all canonical accounts;
- capture authoritative item identity and provenance.

After canonical committed trade:

- A no longer owns the item;
- B owns the same item id;
- B balance decreases by exactly 70;
- A balance increases by exactly 70;
- total currency is unchanged;
- total count of that exact item id is one;
- createdBy / production provenance remains unchanged.

Any clone/delete/remint behavior is VIOL.

## PHASE 4 — Listing

B creates a Listing for the exact acquired physical item.

Canonical acceptance shape MUST expose:

~~~text
listing.id
listing.revision >= 1
listing.marketId
listing.sellerId == B
listing.itemInstanceId == exact acquired item id
listing.quantity
listing.unitPrice as positive safe integer
listing.status
~~~

Attack cases:

- same physical item cannot have two OPEN listings;
- replay create is idempotent and cannot add a second OPEN row;
- duplicate listing id with conflicting payload is rejected;
- transition or mutation that changes authoritative listing data increments revision;
- stale reservation.listingRevision is rejected;
- save/load preserves id, revision and uniqueness;
- CLOSED / CANCELED / FILLED lifecycle releases the listing lock exactly once.

Any pre-repair #179 `listingId`-only/no-revision vocabulary is not accepted as canonical proof. The verified donor repair is pinned at `da82d2178e605283fabf76b80c91cd731da4ad49`; those semantics must still be re-proven after assembly on the exact integration SHA.

The Listing itself remains reference/intention only: it cannot own money or a Rust item. The owning Home Market must reference the canonical Listing exactly once through the approved Home Market reference API; duplicate create/replay may not duplicate that reference.

## PHASE 5 — Customer Discovery

C must have a real item need.

Discovery may use only C-local / observed knowledge:

- known markets;
- known listings;
- local observations;
- explicitly learned evidence.

The policy must ignore leaked worldMarkets, worldListings, global prices or equivalent omniscient world truth.

## PHASE 6 — Travel and Arrival

Required path:

find market -> create travel goal -> canonical walking -> arrive -> verified position -> verified arrival

Proof:

- no teleport;
- no remote purchase;
- forged arrival does not override current coordinates;
- out-of-range purchase fails;
- closed market fails;
- stale listing fails;
- arrival evidence must match C, the selected market and current position;
- the evidence must carry provenance from the approved Navigation evidence producer, not a record fabricated by UI/AI/integration.

## PHASE 7 — Customer Purchase: B to C

Before committed trade:

- B owns the exact item;
- C does not own it.

Required validation at commit time:

- current Home Market is OPEN;
- current Listing is valid and OPEN;
- reservation is ACTIVE;
- reservation.listingRevision equals current listing.revision;
- reservation refers to exact current item ids;
- global reservation view is complete;
- buyer and seller are alive;
- C is in canonical trade range;
- C has enough money.

After canonical commit:

- B no longer owns the item;
- C owns the same physical item id;
- C money decreases by exactly 100;
- B money increases by exactly 100;
- total money is unchanged;
- item conservation remains one exact instance;
- the #177 market projection used for commit must derive `id/open/x/y/tradeRange` from documented canonical sources;
- post-settlement Listing and Reservation transitions must be staged inside the same outer commit boundary, not cleaned up afterward.

## PHASE 8 — Merchant Accounting

Merchant Ledger is the only accounting writer.

Reference case:

- purchase at 70;
- resale at 100;
- Revenue = 100;
- COGS = 70;
- Realized Profit = 30.

Career may project profit read-only. Career state MUST NOT contain an authoritative Revenue / COGS / Realized Profit accumulator.

A forged successful-looking Trade Kernel result that is absent from canonical `tradeReplay` must not mutate Merchant Ledger.

## PHASE 9 — Career Progression

Progression may mutate only from canonical transaction projection satisfying all of:

- state = SAT;
- duplicate = false;
- verification = VERIFIED;
- commitStatus = COMMITTED;
- canonical receipt integrity is valid;
- B is receipt buyer or seller.

The following MUST NOT progress:

- forged object;
- malformed receipt;
- B is not a party;
- duplicate = true;
- UNKNOWN;
- missing verification;
- missing commit status;
- tampered fingerprint;
- tampered integrityFingerprint;
- a direct runtime-fabricated canonical-looking VERIFIED/COMMITTED projection that bypasses #179 `assessTradeKernelResult()`.

## PHASE 10 — Replay Attack Suite

Run all of these after at least one committed transaction:

1. replay immediately;
2. same transaction id + same payload;
3. same id + different payload;
4. commit more than 32 unique transactions, then replay the first;
5. replay after save/load;
6. tampered receipt;
7. tampered fingerprint;
8. tampered integrityFingerprint;
9. changed buyer;
10. changed seller;
11. changed itemIds;
12. changed quantity;
13. changed price;
14. changed market;
15. changed listing;
16. changed reservation;
17. changed eventId;
18. fill Trade Kernel replay storage to its canonical capacity, attempt another commit, and replay the oldest transaction.

For every replay or tamper failure, assert byte-identical authoritative state for:

- canonical money;
- Rust item ownership/provenance;
- Merchant Ledger;
- Merchant Career;
- transaction receipt/replay state except that a valid first-time transaction may have already created its original receipt.

No duplicate receipt mutation is allowed. Replay-capacity exhaustion must fail closed without evicting old receipts or making an old transaction spendable again.

## PHASE 11 — Atomic Failure Attacks

Attack at least:

- insufficient money;
- wallet validation failure;
- wallet transfer failure;
- item missing;
- item equipped / nontradable;
- item transfer failure;
- seller dead;
- buyer dead;
- buyer bag overflow;
- listing stale;
- reservation stale;
- overlapping reservation same market;
- overlapping reservation another market;
- duplicate reservation id;
- incomplete global reservation view;
- market closed;
- buyer outside range;
- Merchant Ledger validation/projection failure after the trade has been staged;
- Merchant Career validation/progression failure after trade/ledger work has been staged;
- post-settlement Listing/Reservation postcondition failure.

For each failed settlement, authoritative source state must be byte-identical.

No partial money mutation.
No partial item mutation.
No partial Merchant Ledger.
No Merchant Career progress.

A rollback that performs compensating writes after partial commit is not sufficient evidence. The Trade Kernel contract requires staged atomic commit, and the integration boundary must keep the live authoritative root unchanged until required wallet/item/replay/market/accounting/career postconditions for that RC4 event have succeeded on the staged candidate.

## PHASE 12 — Save / Load

After the full vertical slice, canonical save then load must preserve:

- wallet balances;
- wallet replay receipts;
- physical item ownership and provenance;
- Home Market;
- Listings;
- listing revision;
- Buy Offers;
- Reservations;
- trade replay receipts;
- Merchant Ledger;
- Merchant Career progression.

Then replay an old transaction. Every authoritative domain must remain unchanged.

## PHASE 13 — Old Save Migration

Use a pre-RC4 save with no RC4 components.

Required result:

- load succeeds;
- missing RC4 components initialize deterministically;
- no duplicate wallet/account;
- no duplicate item;
- no duplicate market;
- no duplicate transaction;
- no hidden money creation beyond the explicitly approved wallet bootstrap policy;
- migration is one-shot;
- second load/migration is byte-stable.

## PHASE 14 — Browser Acceptance

Direct JavaScript state injection is not primary acceptance.

Required browser proof line:

world -> real click -> Market UI -> command intent -> runtime -> canonical validation -> authoritative mutation -> visible result

Visible proof must include:

- Merchant home remains visibly the original home;
- storefront;
- OPEN / CLOSED;
- Listing;
- Buy Offer;
- Merchant identity / Profession: Merchant;
- Customer physically walks;
- arrival feedback;
- transaction feedback only after canonical VERIFIED result;
- stock changes;
- wallet balances change;
- Revenue;
- COGS;
- Realized Profit.

Run both:

- desktop viewport;
- mobile / Android-class viewport.

Scenario preparation may load a validated canonical save, as existing Simclone browser proofs do, but browser-side direct mutation may not be used to make trade succeed.

## PHASE 15 — Regression Gates

Retain all existing release gates:

- full npm test;
- cache/import-map invariant;
- SWA7;
- Active Observation;
- Adventure Hunt / Combat;
- Independent gameplay;
- RC2 crafting;
- RC3.1 Blueprint;
- RC3.2 metal economy.

The Integration Lead may not remove or weaken a regression to make RC4 green.

## Result matrix rule

Every row is exactly one of SAT / VIOL / UNKNOWN.

UNKNOWN is never PASS.

Final RC4 integration candidate may be called SAT only when **Phase 0 is fully SAT** and all mandatory top-level gates are SAT:

- money conservation;
- item conservation;
- replay;
- atomicity;
- save/load;
- old-save migration;
- desktop browser;
- mobile browser;
- retained regressions;
- independent Red Team.

One VIOL blocks release.
One UNKNOWN blocks release.

## Exact-SHA evidence binding

Every generated report must contain:

- repository;
- exact integration head SHA;
- source branch;
- timestamp from CI metadata if available, not a simulation rule;
- exact test ids executed;
- SAT / VIOL / UNKNOWN per test;
- evidence paths;
- failure reason for VIOL;
- missing evidence reason for UNKNOWN.

The suite preflight requires RC4_EXPECTED_HEAD and compares it with git rev-parse HEAD. A mismatch is VIOL.

## Production rerun

Pre-merge candidate evidence proves only that exact candidate SHA.

After merge:

1. capture exact merged-main SHA;
2. rerun the complete RC4 suite;
3. rerun retained regressions;
4. require Pages success;
5. require public HTTP success;
6. verify deployed exact bytes correspond to merged-main;
7. rerun public desktop/mobile browser acceptance where release contract requires it.

Do not reuse candidate SAT as merged-main SAT.

## Handoff to RC4 MERCHANT ECONOMY INTEGRATION LEAD

The Integration Lead receives:

- this Success Contract;
- verification/rc4/merchant-economy-matrix.json;
- verification/rc4/merchant-economy-fixture-contract.json;
- verification/rc4/master-gate-blockers.json;
- verification/rc4/preflight.mjs;
- tests/rc4-acceptance-suite.test.mjs, which validates the harness itself under normal `npm test`.

The Integration Lead must provide one exact integrated candidate SHA and production command/UI wiring. Acceptance Owner then binds executable end-to-end and browser proofs to those real public interfaces without creating a hidden test authority.


## Master Gate blocker handoff

`verification/rc4/master-gate-blockers.json` is the execution handoff for unresolved Phase-0 work. It maps each blocker to:

- the owning domain/workstream;
- exact Phase-0 and downstream acceptance rows;
- required deliverables/evidence;
- forbidden Integration Lead workarounds.

A blocker is removed from the unresolved set only after its owning domain supplies exact-head proof and the assembled integration candidate re-proves the mapped Phase-0 row. Donor-local SAT alone does not close an integration blocker.
