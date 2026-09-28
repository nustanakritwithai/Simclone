# RC4 Merchant Economy Integration Acceptance / Attack Suite

Status vocabulary: SAT / VIOL / UNKNOWN. UNKNOWN is never PASS.

Owner: RC4 ACCEPTANCE / ATTACK SUITE OWNER

This branch is verification-only. It MUST NOT implement or repair an RC4 domain subsystem, change authority ownership, alter shared runtime to satisfy a test, or reduce acceptance.

## Exact preparation baseline

Prepared from merged RC3.2 main:

- main SHA: 1b60b13394c11bd7b03d10227919f4bb509b02df
- RC3.2 PR #174 candidate: 0498dc9bc2b108741c60eee439dc6cba67f91b9d
- RC3.2 merged-main SHA: 1b60b13394c11bd7b03d10227919f4bb509b02df

Observed donor heads at preparation time:

| PR | Domain | Exact head |
| --- | --- | --- |
| #175 | Merchant Career | 51f3c9727429ecfb055548c8bf0ffed09a70b0d9 |
| #176 | Home Market | 79ae6792063f8c70a9e676028646f2cd05a62d0a |
| #177 | Trade Kernel | 73be1764130978f529632aa955bf3a7adf931e29 |
| #178 | Merchant / Customer AI | 8c6c4ffb506cd192e2f81558880a7480ccf13932 |
| #179 | Pricing / Merchant Ledger | ba435943aa7a877fa7f9ff65cc74a961b34f3241 |
| #180 | Market UI prototype | 1bb01790e9af627588504af226759f5aff79b80c |
| #181 | Canonical Wallet | 6d9eb098333eccc72e2352e605e5364d25e97768 |

All #175-#181 donor branches were based on pre-RC3.2 main a3c98ecd4023e0b7e8dbec2a1e2d8970f594d19e at this audit. None of those donor heads is itself an RC4 integration candidate.

Important current incompatibility to attack, not hide: #177 requires authoritative listing.id plus listing.revision and reservation.listingRevision. Observed #179 head ba435943... exposes listingId and no revision in src/merchant-listing.mjs. An integration that keeps that mismatch is VIOL. The acceptance suite MUST NOT create an alias adapter that makes the mismatch appear SAT.

## Master Gate rule

Before the RC4 Master Gate opens, this workstream may prepare tests, fixtures, matrices and static preflight only.

No RC4 integration result may be called SAT until all required proof runs are executed on one exact integration head SHA.

After merge, all pre-merge integration evidence expires for production acceptance. The suite MUST be rerun on the exact merged-main SHA and public deployment proof must be tied to that new SHA.

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

Observed #179 pre-repair listingId-only vocabulary is not accepted as canonical proof.

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
- arrival evidence must match C, the selected market and current position.

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
- item conservation remains one exact instance.

## PHASE 8 — Merchant Accounting

Merchant Ledger is the only accounting writer.

Reference case:

- purchase at 70;
- resale at 100;
- Revenue = 100;
- COGS = 70;
- Realized Profit = 30.

Career may project profit read-only. Career state MUST NOT contain an authoritative Revenue / COGS / Realized Profit accumulator.

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
- tampered integrityFingerprint.

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
17. changed eventId.

For every replay or tamper failure, assert byte-identical authoritative state for:

- canonical money;
- Rust item ownership/provenance;
- Merchant Ledger;
- Merchant Career;
- transaction receipt/replay state except that a valid first-time transaction may have already created its original receipt.

No duplicate receipt mutation is allowed.

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
- buyer outside range.

For each failed settlement, authoritative source state must be byte-identical.

No partial money mutation.
No partial item mutation.
No partial Merchant Ledger.
No Merchant Career progress.

A rollback that performs compensating writes after partial commit is not sufficient evidence. The Trade Kernel contract requires staged atomic commit.

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

Final RC4 integration candidate may be called SAT only when all mandatory top-level gates are SAT:

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
- verification/rc4/preflight.mjs.

The Integration Lead must provide one exact integrated candidate SHA and production command/UI wiring. Acceptance Owner then binds executable end-to-end and browser proofs to those real public interfaces without creating a hidden test authority.
