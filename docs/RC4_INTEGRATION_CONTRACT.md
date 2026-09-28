# RC4 Merchant Economy — Integration Contract & Wiring Plan

Status: PLANNING ONLY / DOCS ONLY / NOT AN INTEGRATION CANDIDATE  
Repository: nustanakritwithai/Simclone  
Audit date: 2026-09-28  
Planner role: RC4 INTEGRATION CONTRACT PLANNER  
Verification vocabulary: SAT / VIOL / UNKNOWN. UNKNOWN is never PASS.

## 0. Scope, precedence, and audited baseline

This document defines wiring, authority boundaries, data contracts, dependency order, stop conditions, and the acceptance handoff for RC4 Merchant Economy.

It does not:

- implement RC4 runtime;
- edit src/engine.mjs;
- merge, cherry-pick, or rebase donor code;
- create a hidden adapter;
- invent domain behavior;
- replace an existing authority;
- lower an acceptance gate.

Source precedence for this planning snapshot:

1. current GitHub repository state and exact PR heads;
2. exact-head Success Contract and exact-head source/tests;
3. current project guidance in AGENTS.md, GAME_PLAN.md, docs/STATUS.md, docs/NEXT_STEPS.md;
4. older handoffs or historical status notes.

If an exact-head Success Contract and exact-head source disagree, the donor is VIOL for integration until its owner repairs the contract/source mismatch. The Integrator must not silently normalize the mismatch.

### 0.1 Current main and RC3.2

Current main:

    1b60b13394c11bd7b03d10227919f4bb509b02df

That commit is the merge commit of PR #174, RC3.2 deterministic Iron / Steel material economy.

RC3.2 candidate head:

    0498dc9bc2b108741c60eee439dc6cba67f91b9d

RC3.2 merged-main SHA:

    1b60b13394c11bd7b03d10227919f4bb509b02df

RC3.2 Production Gate is SAT according to current release evidence prepared in PR #183:

- candidate Verify #1823 SUCCESS;
- post-merge exact-main Verify #1965 SUCCESS;
- workflow run 36448294976 / job `verify` SUCCESS;
- Pages #112 SUCCESS;
- workflow run 36446558699 / job `deploy` SUCCESS;
- evidence is bound to exact released SHA `1b60b133...`.

PR #183 is documentation/release metadata and does not change the released runtime baseline. RC4 must build on top of these released RC3.2 authorities.

RC4 donor ancestry is now mixed:

- #179 exact head `da82d2178e605283fabf76b80c91cd731da4ad49` has been merge-forwarded onto current RC3.2 main. Compare against `1b60b133...` is ahead 25 / behind 0 with merge-base equal to current main.
- #175–#178 and #180–#181 still diverge from current RC3.2 main and retain the older merge base:

      a3c98ecd4023e0b7e8dbec2a1e2d8970f594d19e

Therefore isolated donor Verify SUCCESS remains evidence for that donor head only. For stale-base donors it is not proof of post-RC3.2 compatibility. For #179, ancestry is aligned but exact-head verification is still required.

### 0.2 Donor board snapshot

| PR | Subsystem | Exact audited head | Exact-head candidate evidence | Integration verdict |
| --- | --- | --- | --- | --- |
| #175 | Merchant Career | 51f3c9727429ecfb055548c8bf0ffed09a70b0d9 | Verify #1946 SUCCESS; donor comment marks accepted candidate | UNKNOWN post-RC3.2 |
| #176 | Home Market | 79ae6792063f8c70a9e676028646f2cd05a62d0a | Verify #1861 SUCCESS | UNKNOWN post-RC3.2 |
| #177 | Trade Kernel | 73be1764130978f529632aa955bf3a7adf931e29 | Verify #1898 SUCCESS | UNKNOWN post-RC3.2 and missing market/reservation bindings |
| #178 | Merchant / Customer AI | 8c6c4ffb506cd192e2f81558880a7480ccf13932 | Verify #1864 SUCCESS on isolated donor | VIOL vs repaired #179: Customer AI still consumes legacy listingId + createdTick/snapshotVersion and carries no canonical Listing revision |
| #179 | Pricing / Listing / Buy Offer / Ledger | da82d2178e605283fabf76b80c91cd731da4ad49 | Verify #1979 SUCCESS; ahead 25 / behind 0 from RC3.2 main | SAT donor for Pricing/Listing/Ledger contract; integration bindings/persistence remain separate gates |
| #180 | Market UI prototype | 0aa5a824d7da70172a267dbf1f440e69d44ef271 | Verify #1990 SUCCESS; docs-only changed files | SAT as docs/prototype donor; canonical OPEN + Listing revision read-model repair retained; production wiring UNKNOWN |
| #181 | Canonical Wallet | 6d9eb098333eccc72e2352e605e5364d25e97768 | Verify #1959 SUCCESS | UNKNOWN post-RC3.2; donor contract explicitly requires post-RC3.2 re-audit/rebuild |

Older #179 Verify evidence belongs to older heads and MUST NOT be used as post-sync evidence for `da82d217...`.

Post-sync proof is now available:

    #179 exact head da82d217...
    → Verify #1979 SUCCESS
    → RC3.2 ancestry aligned (ahead 25 / behind 0)

The current #179 Success Contract starts with a Repair override that supersedes older conflicting Listing / receipt wording below it. That override and current source/tests agree on canonical `id + revision`. Therefore Pricing/Listing/Ledger is SAT as a donor on this exact head; runtime binding, Reservation, persistence root ownership, and end-to-end settlement remain separate integration gates.

Cross-donor re-audit still finds #178 head 8c6c4ff... using the pre-repair Listing vocabulary (`listingId`, `createdTick` / `snapshotVersion`). This remains a donor compatibility VIOL, not an Integration Lead mapping task.

### 0.3 Verification support prepared for Integration Lead

PR #182 is a verification-only RC4 acceptance/attack-suite donor.

PR #182 is currently **volatile / not frozen**. The latest observed head during this audit moved repeatedly and was:

    9a1b6581c753613b3a14558a94ff708132375838

with Verify #2002 in progress at the time of observation.

The acceptance owner has already documented that old-head Verify results cannot be reused. This Integration Contract applies the same rule: do not pin #182 as the acceptance baseline until the owner freezes one exact head and that exact head has a completed SUCCESS verification.

The current #182 line retains the refreshed donor snapshot:

- #179 = `da82d217...` with Verify #1978/#1979 SUCCESS;
- #180 = `0aa5a824...` with Verify #1990 SUCCESS;
- #178 remains `8c6c4ff...`.

The branch remains based directly on current RC3.2 main and changes only RC4 acceptance documentation, fixtures/matrices, static preflight and acceptance-suite tests.

The harness Phase-0 Master Gate already checks the hard dependencies identified here: exact SHA, canonical Listing id/revision, Home Market reference authority, BuyOffer persistence, Reservation authority, market/tradeRange binding, Navigation arrival evidence and deterministic source rules.

PR #182 does not make the Master Gate SAT by itself. Its Phase-0 rows remain UNKNOWN until one exact integrated candidate supplies all missing authorities/bindings.

Coverage note: #178's known cross-donor legacy Listing vocabulary remains an Integration Contract VIOL even though #182's static preflight does not currently make that specific source-vocabulary mismatch a named Phase-0 check. Integrated AI/travel/purchase proofs must not be allowed to bypass that donor repair.

### 0.4 Governing project locks retained from current main

- deterministic simulation; no Math.random or wall-clock gameplay authority;
- UI reads state and emits validated commands only;
- no duplicate item, resource, housing, profession, wallet, ledger, position, or transaction writer;
- current navigation remains position/path authority;
- old-save compatibility and corruption fail-closed behavior must be preserved;
- exact head must be re-read before any write;
- UNKNOWN is never PASS;
- the physical action pattern remains choose target -> path -> move -> reach -> revalidate -> execute.

---

# 1. Authority Matrix

A domain has one authoritative writer. Read projections and explicit compatibility facades do not become writers.

| Domain | Single authoritative writer | May read | May commit | Explicitly forbidden |
| --- | --- | --- | --- | --- |
| Clone identity / life | existing Simclone Agent/Lifecycle authority | Career, AI, Trade validation, UI | existing authority only | RC4 donors creating clone/life copies |
| Profession | existing adoptProfession authority; #175 may request Merchant transition through it | Career, AI, UI | adoptProfession path only | direct agent.profession Merchant assignment outside canonical transition |
| Housing / home identity | existing Housing + Individual Housing authority | #176, Career qualification, AI, UI | existing housing authority only | Home Market creating a new house/building/capacity |
| Home Market | #176 Home Market component | AI, explicit market binding, UI | #176 lifecycle functions only | UI/AI/Trade Kernel directly mutating Home Market |
| Listing | #179 canonical Listing collection | Trade market adapter, AI, UI, Reservation binding | #179 Listing functions only | hidden listing copies or legacy listingId normalization |
| Buy Offer | #179 BuyOffer domain | Merchant AI, UI, future procurement matching | #179 functions only | holding money/items; Trade Kernel treating an offer as a committed trade |
| Reservation | canonical market/reservation integration authority required by #177 | Trade Kernel, UI read model | only the approved reservation authority | Integrator inventing a second reservation ledger |
| Money | #181 currencyWallet | Career capital projection, AI affordability, Trade Kernel, UI | #181 canonical transfer/mint/burn rules only | merchantWallet, shopWallet, marketWallet, customerWallet |
| Physical items | existing Rust Item Authority | AI stock projection, Listing, Trade Kernel, Ledger cost evidence, UI | existing Rust transfer functions only | merchantInventory, marketInventory, UI stock mutation |
| Movement / position | existing Simclone Navigation/task authority | AI, Trade Kernel, UI | existing movement/path command path only | teleport or RC4 position writer |
| Arrival evidence | MUST be derived from approved Navigation evidence producer | AI purchase/restock gate, Command Router | Navigation evidence producer only | AI/UI/Integrator fabricating verified:true |
| Trade validation / settlement | #177 Trade Kernel | current root snapshot + explicit wallet/item/market bindings | #177 settlement result only | AI/UI/Ledger/Career committing trade |
| Trade replay truth | #177 tradeReplay receipts | #179 transaction assessment, #175 progression, UI feedback | #177 only | local/bounded Career or UI replay list becoming authority |
| Revenue / COGS / Realized Profit | #179 Merchant Ledger | Career profit projection, UI | #179 Ledger only | Career agent profit accumulator, wallet-derived profit writer |
| Merchant Career progression | #175 | canonical transaction assessment + Ledger read projection | #175 non-monetary progression only | Career writing Revenue/COGS/Profit |
| Merchant / Customer decision policy | #178 proposal policy | approved snapshots only | NO domain commit | AI writing market/listing/wallet/item/path/trade/ledger/profession |
| Production UI | production UI using accepted #180 read-model concepts | read models only | intent dispatch only | any direct domain mutation or optimistic VERIFIED sale |
| Command Router | integration orchestration boundary, not a domain authority | intents + current authoritative root | dispatch/coordinate approved authorities; final root replacement only after all required gates | storing parallel truth or upgrading UNKNOWN |
| Authoritative root replacement | existing runtime root ownership under Integration Lead | fully validated staged candidate | one replacement at the accepted commit boundary | partial root mutation followed by compensating rollback |

Rule: an explicit adapter may project an existing authority into a contract required by #177. It MUST be documented here, read/write only through the named canonical authority, and must not own parallel state. An undocumented mapping is a hidden adapter and is forbidden.

---

# 2. Canonical Data Flow

## 2.1 End-to-end wiring

    Customer / Merchant AI (#178)
    ↓ proposal only
    Intent / Proposal
    ↓
    Command Router
    ↓
    authoritative current root snapshot
    ↓
    Navigation / Arrival validation
    ↓
    Home Market + Listing + Reservation validation
    ↓
    canonical TradeProposal
    ↓
    Trade Kernel (#177)
    ↓
    #181 wallet facade + Rust item facade
    ↓
    atomic staged settlement
    ↓
    canonical Trade Receipt + tradeReplay receipt
    ↓
    authoritative root replacement
    ↓
    Merchant Ledger (#179)
    ↓
    Merchant Career (#175)
    ↓
    UI read model
    ↓
    production UI (#180 design donor)

No downstream component is allowed to create VERIFIED or COMMITTED transaction evidence.

The only accepted chain is:

    #177 successful non-duplicate canonical settlement
    → exact canonical receipt
    → #179 validates/recomputes receipt identity and projects the kernel result
    → VERIFIED + COMMITTED projection
    → #175 may consume that projection for non-monetary Merchant progression
    → UI may display success

A caller object such as:

    { transactionId, verified: true, committed: true }

is never canonical evidence.

## 2.2 Navigation and arrival rule

#178 requires verified current position and verified arrival evidence before AI emits a purchase intent.

#177 independently revalidates current buyer coordinates against current market coordinates and tradeRange immediately before settlement.

Therefore both layers are required:

1. AI/Command precondition: accepted Navigation-derived arrival/position evidence;
2. final settlement precondition: #177 current-state distance validation.

#178 already defines the **consumer-side** evidence shape in source:

    positionEvidence: {
      verified: true,
      agentId,
      tick,
      x,
      y
    }

    arrivalEvidence: {
      verified: true,
      agentId,
      marketId,
      tick,
      x,
      y,
      evidenceId? / source?
    }

#178 rejects evidence when agent identity, coordinates, tick ordering, market identity, or current trade-range position do not match the current snapshot.

What is still missing on current main is the **producer/authority contract** that is allowed to set `verified:true` for those records. That producer must be Navigation/task-derived and must bind the evidence to the actual movement outcome. Until that producer is named and proven, arrival production is UNKNOWN.

The Integrator must not manufacture a verified record from a distance comparison, from the AI's travel intent, or from current coordinates alone and call it Navigation evidence.

## 2.3 Explicit market projection into #177

#177 requires market(state, marketId) to return at least:

    {
      id,
      open,
      x,
      y,
      tradeRange
    }

#176 Home Market owns:

    marketId
    status
    storefrontSocket

An accepted explicit binding may project, without writing new truth:

- id from marketId;
- open from status === "open";
- x/y only from an approved physical market location projection, plausibly the canonical storefront socket if the donor owners approve that interpretation.

But #176 does not define tradeRange. #178 contains a policy fallback `defaultTradeRange: 1`, but that is an AI decision fallback, **not** a canonical market authority and cannot satisfy #177.

Result: the market binding is UNKNOWN until a domain owner defines the tradeRange source. Production snapshots MUST supply that accepted canonical range to both #178 and #177. The Integrator must not choose a number and must not promote #178's default into market truth.

---

# 3. Canonical Schemas

Only schemas already supported by an audited donor are canonical here. Missing schemas are marked UNKNOWN.

## 3.1 Home Market — #176

    {
      marketId,
      homeId,
      ownerAgentId,
      status,              // "closed" | "open" | "invalid" | "archived"
      listingIds,          // references only
      buyOfferIds,         // references only
      storefrontSocket,
      reputation,
      invalidReason?
    }

Authority notes:

- no money;
- no physical items;
- no housing capacity;
- no trade settlement;
- no profession mutation.

Current #176 source has no exported authority method to attach/detach listingIds or buyOfferIds after market creation. Direct array mutation by the Integrator would bypass #176 ownership. This is UNKNOWN and a stop condition for production reference wiring.

## 3.2 Listing — #179 repaired source shape

The repaired #179 source at head 964b14b2... uses:

    {
      id,
      marketId,
      sellerId,
      itemKind,
      itemInstanceId,
      quantity,
      unitPrice,
      revision,
      status               // OPEN | CLOSED | CANCELED | FILLED
    }

Rules proven by repaired source/tests:

- revision starts at 1;
- authoritative quantity/price mutation increments revision by exactly 1;
- OPEN -> CLOSED/CANCELED/FILLED increments revision;
- CLOSED -> OPEN through the canonical collection increments revision;
- no-op duplicate mutation does not increment revision;
- only one OPEN listing may reference the same physical itemInstanceId;
- duplicate create by the same id/identity is idempotent;
- reservation freeze exposes listingId = listing.id and listingRevision = listing.revision.

Important integration lock:

At #179 exact head `da82d217...`, the Success Contract begins with an explicit **Repair override** that declares `id + revision` canonical and says it supersedes older conflicting Listing wording retained later in the document. Current source/tests match that override.

Therefore #179 is no longer VIOL for the Listing vocabulary itself. Exact-head Verify #1979 is SUCCESS, so the repaired Pricing/Listing/Ledger donor is SAT on this head. This does not make its missing runtime bindings/persistence or RC4 end-to-end integration SAT.

The lower historical Listing block must not be treated as a second accepted schema, and the Integrator MUST NOT write a compatibility shim that accepts both shapes.

## 3.3 Buy Offer — #179 current source

    {
      offerId,
      marketId,
      buyerId,
      itemKind,
      quantityWanted,
      unitPrice,
      createdTick,
      status               // OPEN | CLOSED | CANCELED | FILLED
    }

Rules:

- reference/intention only;
- holds no item;
- reserves no money;
- positive integer price;
- OPEN may transition to CLOSED/CANCELED/FILLED;
- same terminal request is duplicate/no-op;
- no current canonical BuyOffer collection/serializer was observed on the audited head.

Persistent collection ownership is therefore UNKNOWN.

## 3.4 Reservation — minimum shape consumed by #177

#177 accepts only an authoritative reservation exposing at least:

    {
      id,
      status,              // ACTIVE required for settlement
      marketId,
      listingId,
      listingRevision,
      sellerId,
      buyerId,
      itemKind,
      unitPrice,
      quantity,
      itemIds
    }

The reservation freezes:

- listingId;
- listingRevision;
- buyer;
- seller;
- item kind;
- exact itemIds;
- quantity;
- unitPrice.

Global invariant:

    activeReservations(state)

must be a complete global ACTIVE reservation projection across all markets.

The current reservation and the global projection must agree exactly. Duplicate active reservation IDs, malformed rows, omitted current reservation, or any overlapping item ID fail closed.

UNKNOWN:

- reservation creation authority;
- deterministic reservation ID rule;
- ACTIVE -> terminal transition vocabulary;
- COMMITTED / RELEASED / CANCELED / EXPIRED semantics;
- reservation persistence/migration;
- reservation cleanup/reconciliation.

Those rules MUST be defined by the reservation/domain owner before Integration Step 6. The Integrator may not invent them.

## 3.5 TradeProposal — #177

    {
      transactionId,
      marketId,
      sellerId,
      buyerId,
      itemKind,
      itemInstanceId,
      quantity,
      unitPrice,
      totalPrice,
      listingId,
      reservationId
    }

Constraints:

- deterministic caller-supplied IDs;
- positive safe integer quantity, max 128;
- positive integer money;
- totalPrice === unitPrice * quantity;
- buyer != seller;
- buyer/seller alive;
- current market open;
- buyer in trade range;
- Listing OPEN and current;
- Reservation ACTIVE and exact;
- reservation.listingRevision === listing.revision;
- seller owns each exact reserved tradable item;
- buyer has enough canonical money;
- seller credit cannot overflow.

## 3.6 Canonical Trade Receipt — #177

A committed receipt contains:

    {
      transactionId,
      fingerprint,
      integrityFingerprint,
      eventId,             // "TRADE:" + transactionId
      marketId,
      listingId,
      reservationId,
      buyerId,
      sellerId,
      itemKind,
      itemInstanceId,
      itemIds,
      quantity,
      unitPrice,
      totalPrice
    }

The exact sorted itemIds are integrity-bound.

Replay rules:

- same transactionId + same proposal fingerprint -> duplicate:true, zero writes;
- same transactionId + different proposal -> transaction-conflict;
- tampered receipt/integrity -> fail closed;
- #177 does not evict old committed IDs;
- tradeReplay capacity is 512 receipts and fails closed at capacity rather than making old IDs spendable.

## 3.7 Canonical Wallet — #181

    currencyWallet: {
      version: "RC4-wallet-1",
      accounts: [
        { agentId, balance }
      ],
      receipts: [ ... ],
      bootstrap: null | {
        version: "RC4-wallet-bootstrap-1",
        initialBalance,
        agentIds,
        totalGranted
      }
    }

Rules:

- one account per canonical Agent ID;
- non-negative safe integer balance;
- ordinary trade uses conserved transfer;
- trade debit facade is validation-only;
- trade credit facade executes exactly one canonical transfer bound to transaction/buyer/seller/amount;
- monetary replay receipts persist;
- no merchant/shop/customer/market wallet.

The donor defines a deterministic V1 legacy bootstrap of 100 units per current Agent when the wallet is absent. Production use still requires the post-RC3.2 donor compatibility gate.

## 3.8 Merchant Ledger — #179

    {
      merchantId,
      purchases,
      sales,
      revenue,
      costOfGoodsSold,
      realizedProfit
    }

Rules:

    realizedProfit = revenue - costOfGoodsSold

Purchased item cost basis comes from the actual committed purchase receipt and exact item IDs.

Self-produced item cost basis remains UNKNOWN unless an exact-item VERIFIED production/material monetary-cost evidence record is supplied.

Ledger never writes wallet or Rust ownership and never commits a trade.

## 3.9 Merchant Career — #175

Persisted non-monetary progression may include:

    merchantTransactions
    merchantExperience

The following MUST NOT be an authoritative persisted agent field:

    merchantRealizedProfit

Realized profit is a read-only projection from canonical Merchant Ledger.

Career transaction progression accepts only #179 validated assessment of a #177 receipt:

    state: SAT
    duplicate: false
    verification: VERIFIED
    commitStatus: COMMITTED
    canonical receipt valid
    Merchant is buyer or seller

Canonical duplicate:true is always a no-op.

## 3.10 AI intents — #178

AI outputs are proposals only and carry no authority.

Customer proposal path includes travel, wait, purchase submission, wait transaction, and post-purchase use/equip/carry intents.

Merchant proposal path includes bounded restock, return-home travel, wait materialization, Home Market request, Listing proposal, open-market proposal, and wait.

The AI must not fabricate Reservation, Listing truth, market truth, wallet balance, item ownership, arrival evidence, or transaction result.

### #178 compatibility repair required before integration

At exact head `8c6c4ff...`, Customer AI source/tests still consume:

    listing.listingId
    listing.createdTick / listing.snapshotVersion

and construct purchase identity/snapshots from those legacy fields.

Repaired #179 canonical Listing source uses:

    listing.id
    listing.revision

Therefore #178 is currently **VIOL** against the repaired Listing contract.

Required donor repair, owned by #178:

- consume the approved canonical Listing identity/vocabulary from #179;
- bind purchase intent identity to the canonical Listing revision, not legacy createdTick/snapshotVersion;
- carry enough current Listing revision evidence for the Command Router to request/create the canonical Reservation;
- continue to stop before Reservation creation and Trade commit;
- retain proposal-only `authoritative:false` behavior;
- rerun exact-head verification after repair.

The Integration Lead must not solve this by projecting `id -> listingId` or `revision -> snapshotVersion` in an undocumented/hidden compatibility adapter.

## 3.11 UI read model — #180 concept only

Production read model should expose accepted canonical projections for:

- market/home/owner/status;
- listings;
- buy offers;
- canonical stock availability;
- Merchant profession and non-monetary transaction count;
- Ledger Revenue / COGS / Realized Profit;
- current Merchant proposal;
- latest canonical VERIFIED transaction.

Presentation mappings such as #176 "open" -> UI "OPEN" are allowed only as an explicit read-only display mapping. They do not rewrite the domain vocabulary.

---

# 4. State Transitions

## 4.1 Home Market

Canonical #176 lifecycle:

    create
    → closed
    → open
    → closed
    → archive
    → remove

Reconciliation may force:

    open/closed
    → invalid

when home/ownership/owner truth becomes invalid.

A previously invalid record may reconcile back to closed only when the same canonical market becomes valid again according to #176.

An open market must close before archive.

No transition may create a building or alter housing capacity.

## 4.2 Listing

Canonical repaired #179 behavior:

    create
    → OPEN revision 1

Authoritative OPEN mutation:

    OPEN
    → OPEN with changed quantity or price
    → revision + 1

Lifecycle:

    OPEN → CLOSED      revision + 1
    OPEN → CANCELED    revision + 1
    OPEN → FILLED      revision + 1
    CLOSED → OPEN      revision + 1, only through canonical collection and uniqueness checks

CANCELED and FILLED have no approved reopen path on the audited source.

Duplicate/no-op:

    same state / same quantity / same price
    → no revision change

Uniqueness:

    one physical itemInstanceId
    → at most one OPEN Listing globally inside the canonical Listing collection

## 4.3 Buy Offer

Current #179 behavior:

    create → OPEN
    OPEN → CLOSED
    OPEN → CANCELED
    OPEN → FILLED

No current approved reopen path.

BuyOffer has no reservation or wallet ownership.

## 4.4 Reservation

Known current state:

    ACTIVE

Only ACTIVE is recognized by #177 settlement validation.

Requested terminal concepts such as:

    ACTIVE → COMMITTED
    ACTIVE → RELEASED
    ACTIVE → CANCELED
    ACTIVE → EXPIRED

are NOT yet defined by an audited canonical reservation authority.

Therefore they remain UNKNOWN and MUST NOT be implemented by the Integrator until the reservation owner publishes the exact state machine, idempotency rules, revision behavior, release conditions, persistence, and replay behavior.

## 4.5 Post-trade Listing/Reservation consumption

#177 currently validates Listing and Reservation but does not mutate either domain during settlement.

The following are therefore still UNKNOWN:

- whether a full sale transitions Listing to FILLED in the same staged root;
- how a partial sale changes Listing quantity and revision;
- when Reservation becomes COMMITTED;
- whether market reference lists change;
- how failure after a kernel staged result but before final root replacement is handled.

These rules must be resolved before canonical Trade Commit can be SAT.

---

# 5. Trade Commit Boundary

## 5.1 Proven #177 kernel boundary

The current #177 atomic kernel contract is:

    validate current state
    → build immutable SettlementProposal
    → structuredClone(authoritative state)
    → canonical wallet debit facade on staged state
    → canonical wallet credit facade on staged state
    → exact Rust item transfer on staged state
    → append canonical tradeReplay receipt on staged state
    → verify wallet postconditions
    → verify exact buyer item ownership
    → verify exactly one transaction receipt
    → return next staged state

The input state is never mutated.

If any step fails, throws, or violates a postcondition:

    source authoritative state = unchanged

No compensating rollback chain is allowed.

## 5.2 Required outer integration boundary

The production Integration Lead must preserve one outer root replacement.

The target contract is:

    Command/AI intent validation
    → fresh authoritative root snapshot
    → Navigation/arrival gate
    → fresh market/listing/reservation gate
    → build TradeProposal
    → #177 settleTradeAtomic
    → obtain staged root + canonical receipt
    → apply ONLY approved canonical post-settlement Listing/Reservation transitions to that staged root
    → validate all wallet/item/replay/market/listing/reservation postconditions
    → one authoritative root replacement
    → downstream Ledger/Career/UI processing

However, the Listing/Reservation post-settlement rules are currently UNKNOWN. Therefore the outer boundary cannot yet be implemented as SAT.

It is forbidden to:

- root-commit wallet/items first and then repair market state later;
- mutate Listing/Reservation before settlement and roll them back on failure;
- put market mutation inside a hidden adapter;
- treat a kernel success receipt as permission to invent missing reservation lifecycle rules.

## 5.3 Downstream accounting boundary

Merchant Ledger is downstream of the canonical committed receipt. It is not allowed to veto or roll back an already committed trade.

If Ledger cannot establish seller cost basis:

    trade stays committed
    Ledger result remains UNKNOWN / unchanged

The committed Trade Receipt remains transaction truth.

For purchased stock, the Merchant buyer's acquisition cost is the committed purchase unit price per exact item ID.

Career progression and UI success must use the canonical receipt assessment only. Realized-profit display must remain UNKNOWN until the Ledger itself is valid.

---

# 6. Producer → Merchant Procurement Contract

Actors:

- Producer A;
- Merchant B.

Known accepted sequence:

1. Producer A creates the physical item through existing production/Rust authority.
2. Merchant B may create a #179 BuyOffer as demand intent.
3. A must physically travel or already be within the approved trade range.
4. Current position/arrival must be revalidated.
5. A canonical Reservation must freeze exact trade facts.
6. #177 validates current state.
7. #181 transfers money B -> A.
8. Rust transfers exact item IDs A -> B.
9. #177 emits canonical Trade Receipt.
10. After root commit, B's #179 Ledger records the purchase and acquisition cost basis from the exact receipt.
11. #175 may increment Merchant B non-monetary progression only because B is an actual canonical transaction party and the commit is non-duplicate.

### Procurement blocker

#177 does not accept offerId and does not settle against a BuyOffer. It requires listingId plus an authoritative OPEN Listing.

No audited donor currently defines:

    BuyOffer
    → Producer acceptance/matching
    → canonical seller Listing
    → Reservation
    → TradeProposal

Therefore "Merchant creates BuyOffer and Producer accepts it" is UNKNOWN beyond the BuyOffer intent itself.

The Integrator MUST NOT:

- convert a BuyOffer into a Listing silently;
- create a temporary hidden Listing;
- omit listingId from TradeProposal;
- treat BuyOffer as reservation authority.

Resolution must come from the owning donor contract(s), then be re-audited.

---

# 7. Merchant → Customer Sale Contract

Actors:

- Merchant B;
- Customer C.

Known intended sequence:

    B owns exact Rust item
    → B creates canonical #179 Listing
    → Listing referenced by B's valid #176 Home Market
    → C has a need
    → #178 uses C's known market/listing only
    → C selects destination deterministically
    → canonical Navigation travel goal
    → physical movement
    → Navigation-derived verified arrival
    → refresh current local market/listing
    → canonical Reservation freezes listing revision + exact item IDs
    → TradeProposal
    → #177 validation
    → #181 C -> B transfer
    → Rust B -> C transfer
    → canonical Trade Receipt
    → one root replacement
    → #179 Ledger: Revenue / COGS / Realized Profit
    → #175 canonical transaction progression
    → UI renders committed read model

Listing binding before reservation must include:

    id
    revision
    marketId
    sellerId
    itemInstanceId
    quantity
    unitPrice

Stale reservation:

    reservation.listingRevision !== listing.revision
    → settlement rejected

Current blockers for this full flow:

- Home Market has no approved Listing-reference mutation API;
- market tradeRange source is undefined;
- canonical Navigation arrival-evidence producer is undefined;
- Reservation authority/lifecycle is undefined;
- post-settlement Listing quantity/FILLED semantics are undefined;
- all donors require post-RC3.2 compatibility re-audit.

---

# 8. Persistence Boundary

Persistence must preserve all authority state required to prevent replay, drift, or identity loss.

## 8.1 Must persist

- Home Market component state;
- canonical Listing collection including revision and status;
- canonical BuyOffer state/collection;
- canonical Reservation state;
- currencyWallet accounts;
- currencyWallet replay receipts and bootstrap metadata;
- tradeReplay receipts;
- Merchant Ledger purchases, sales, cost-basis identity, Revenue, COGS, Realized Profit;
- Merchant Career non-monetary progression;
- AI intent journal only if/when an approved canonical journal owner is defined;
- existing Rust possessions/items;
- existing production/material state, including RC3.2 metals;
- existing agents/life/profession/housing/navigation state required by current save contract.

## 8.2 Must NOT persist as duplicate truth

- agent.merchantRealizedProfit;
- merchantWallet/shopWallet/customerWallet;
- merchantInventory/shopInventory;
- UI-local optimistic stock;
- UI-local "verified transaction";
- AI-created reservation truth;
- duplicate position/arrival truth;
- a second transaction replay list owned by Career or UI.

## 8.3 Load invariants

After restore:

- wallet replay still blocks old monetary transaction replay;
- tradeReplay still blocks old TradeProposal replay;
- Listing revision is unchanged;
- exact item identities are unchanged;
- consumed cost basis is not restored;
- Merchant Career duplicate replay remains a no-op;
- no missing replay state may be silently normalized to "fresh" if doing so would make an old transaction spendable again;
- UNKNOWN/corrupt state fails closed.

## 8.4 Existing donor migration facts

Home Market:

    missing component
    → #176 can normalize to empty RC4-HM-0.1 component

Wallet:

    missing wallet
    → #181 defines deterministic one-time V1 bootstrap
    → repeated migration no-op

Unknown production persistence contracts still needing an owner:

- root key/container for Listing collection in production;
- canonical persistent BuyOffer collection;
- Reservation persistence + migration;
- tradeReplay old-save migration/root wiring;
- collection/root shape for all Merchant Ledgers;
- AI intent-journal persistence and boundedness.

The Integrator must not design those stores ad hoc while implementing another gate.

---

# 9. Integration Order and Gate Locks

The Integration Lead MUST follow this sequence. No later step may begin if a required earlier dependency is UNKNOWN or VIOL.

| Step | Gate | Required evidence before proceeding | Current planning state |
| ---: | --- | --- | --- |
| 1 | Trade vocabulary | #177 + repaired #179 canonical Repair override/source agree; #178 consumers must use the same Listing identity/revision | VIOL: #178 still consumes legacy Listing vocabulary |
| 2 | Trade validator bindings | explicit wallet/item/market interfaces; no hidden mapping | UNKNOWN: market tradeRange missing |
| 3 | Home Market | post-RC3.2 compatible #176; lifecycle + refs authority usable | UNKNOWN: donor stale; ref mutation API missing |
| 4 | Listings | #179 RC3.2-synced exact-head Verify #1979 SUCCESS + canonical Repair override/source retained | SAT donor; integration proceeds only after Steps 1–3 dependencies are SAT |
| 5 | Buy Offers | canonical persistence + reference ownership | UNKNOWN |
| 6 | Reservation authority/binding | owner, schema, ID, lifecycle, persistence, global active view | UNKNOWN — HARD STOP |
| 7 | Merchant Career | post-RC3.2 #175 compatibility + canonical evidence path | UNKNOWN post-RC3.2 |
| 8 | Pricing | #179 exact-head Verify #1979 SUCCESS; deterministic pure pricing retained | SAT donor; runtime inputs still depend on accepted evidence sources |
| 9 | Merchant Ledger | #179 exact-head receipt validation SAT; production ledger container/persistence binding still required | UNKNOWN integrated |
| 10 | Merchant AI | accepted authority snapshots only; #178 exact-head cross-donor repair complete | VIOL until #178 is repaired/reverified |
| 11 | Customer AI | canonical #179 Listing id+revision + local knowledge/current Wallet + verified arrival | VIOL until #178 is repaired/reverified |
| 12 | Navigation / arrival | real Navigation-derived evidence producer + final current position check | UNKNOWN — HARD STOP |
| 13 | Wallet adapter | post-RC3.2 accepted #181 + #177 combined atomic proof | UNKNOWN |
| 14 | Rust item adapter | post-RC3.2 Rust compatibility; exact IDs/provenance/tradability | UNKNOWN |
| 15 | Canonical Trade Commit | outer staged boundary including approved post-settlement market state | UNKNOWN — HARD STOP |
| 16 | Persistence | all canonical components survive restore with replay safety | UNKNOWN |
| 17 | UI read model | explicit display projections only | UNKNOWN production |
| 18 | UI command binding | intents only; no direct domain write | UNKNOWN production |
| 19 | Browser proof | real path, real trade, save/load, replay, mobile/desktop UI | UNKNOWN |

Integration Lead may perform audits and donor re-selection while a gate is blocked. It may not bypass the blocked dependency by implementing a local substitute.

---

# 10. Donor Dependency Graph

## #175 Merchant Career

Depends on:

- existing adoptProfession;
- authoritative home/capital/trade-knowledge projections for qualification;
- #179 assessTradeKernelResult-compatible canonical transaction assessment;
- #177 canonical committed receipt;
- #179 Merchant Ledger for realized-profit read projection.

Writes only:

- Merchant profession through adoptProfession;
- non-monetary Merchant progression.

## #176 Home Market

Depends on:

- existing Housing/Individual Housing;
- existing Rust doorway/socket topology.

Owns:

- market identity/lifecycle/storefront/reference fields/reputation.

Missing for integration:

- canonical add/remove Listing/BuyOffer reference API;
- tradeRange source.

## #177 Trade Kernel

Depends on:

- #181 canonical wallet facade;
- existing Rust item authority facade;
- #176-derived canonical market projection;
- #179 canonical Listing;
- canonical Reservation authority that does not yet exist;
- current Agent/position truth.

Owns:

- trade validation;
- atomic wallet/item staged settlement;
- tradeReplay receipts.

## #178 Merchant / Customer AI

Depends on:

- canonical local knowledge;
- #176 Home Market snapshots;
- #179 Listing/BuyOffer/Pricing snapshots;
- #181 affordability snapshot;
- canonical Rust stock;
- Navigation-derived position/arrival;
- canonical transaction result.

Owns:

- intents/proposals only.

## #179 Pricing / Listing / Buy Offer / Ledger

Depends on:

- #177 receipt vocabulary for Ledger;
- exact production-cost evidence if a self-produced sale needs COGS;
- canonical item identity.

Owns:

- Listing;
- BuyOffer;
- pricing;
- Merchant Ledger.

Current exact-head state:

- head `da82d217...` is merge-forwarded onto RC3.2 main;
- the top-level Repair override declares `id + revision` canonical and current source/tests match it;
- exact-head Verify #1979 = SUCCESS;
- donor Pricing/Listing/Ledger scope is SAT;
- lower historical text still contains a stale sibling-Career observation about an older #175 candidate, but the explicit Repair override/current source precedence prevents that historical paragraph from becoming canonical. Current #175 exact head/contract wins.

## #180 UI Prototype

Exact audited head:

    0aa5a824d7da70172a267dbf1f440e69d44ef271

Verify #1990 = SUCCESS.

Changed files remain docs/prototype only; no production `src/**` authority is introduced.

Depends on:

- accepted read models from all canonical authorities.

Owns:

- no production authority.

Canonical presentation repair on this head:

- purchasable Listing status is `OPEN`, not UI-invented `ACTIVE`;
- read model retains canonical Listing `revision`;
- display/read-model field `listingId` is an explicit presentation alias of canonical `Listing.id`, not a domain writer;
- purchase intent includes current `listingRevision`;
- transaction success requires `state:'SAT'` + `verification:'VERIFIED'` + `commitStatus:'COMMITTED'` + `duplicate:false`;
- UNKNOWN, failure, replay, and intent submission cannot render success.

Use as visual/interaction donor only. Production command/read-model wiring remains Integration Lead work after domain dependencies are SAT.

## #181 Wallet

Depends on:

- canonical Agent IDs/life truth;
- #177 transaction-bound adapter contract.

Owns:

- currency accounts, balances, monetary replay receipts, transfers, explicit bootstrap/mint/burn rules.

Contract explicitly requires post-RC3.2 re-audit/rebuild before production integration.

---

# 11. Known UNKNOWN / VIOL Register

| ID | Finding | State | Required owner/action |
| --- | --- | --- | --- |
| U1 | #175–#178 and #180–#181 still diverge from RC3.2 main; #179 is the current RC3.2-synced RC4 donor | UNKNOWN | Compatibility Auditor / each stale-base runtime donor rebuilds or proves post-RC3.2 compatibility; #180 is docs-only and does not claim runtime compatibility |
| V2 | #178 head 8c6c4ff Customer AI still consumes legacy listingId + createdTick/snapshotVersion and does not bind purchase intent to canonical #179 revision | VIOL | #178 owner aligns to repaired #179 canonical Listing vocabulary/revision and reruns exact-head Verify |
| U3 | #176 owns listingIds/buyOfferIds but exposes no canonical attach/detach reference mutation API | UNKNOWN | #176 owner |
| U4 | No canonical Reservation writer/lifecycle/persistence/ID rule is supplied | UNKNOWN | market/reservation owner + #177 contract |
| U5 | #176 does not define #177-required tradeRange source | UNKNOWN | market/trade contract owner |
| U6 | #178 defines consumer validation for positionEvidence/arrivalEvidence, but current main has no audited Navigation/task producer authorized to set verified:true for those records | UNKNOWN | Navigation / #178 integration owner defines/proves evidence producer |
| U7 | BuyOffer is not consumed by #177; BuyOffer -> producer acceptance -> Listing/Reservation mapping is undefined | UNKNOWN | #179 + #177 owner |
| U8 | post-settlement Listing decrement/FILLED/revision and Reservation COMMITTED/release behavior is undefined | UNKNOWN | #179 + Reservation/#177 owner |
| U9 | canonical persistent BuyOffer collection is not defined by current source | UNKNOWN | #179 owner |
| U10 | production root collection shape for Merchant Ledgers is not defined | UNKNOWN | #179 / persistence owner |
| U11 | tradeReplay old-save migration/root wiring is not integrated | UNKNOWN | #177 / persistence owner |
| U12 | #178 consumes an intent journal but does not define canonical persistence ownership for it | UNKNOWN | #178 / persistence owner |
| U13 | authoritative monetary production-cost evidence for final self-produced items is absent on current main | UNKNOWN | production-cost authority owner; direct self-produced Merchant sales remain accounting-UNKNOWN |
| L1 | #177 tradeReplay caps at 512 and fails closed when full | SAT design limitation | Integration/browser proof must demonstrate fail-closed behavior; no eviction workaround |

No item in this table may be converted to SAT by an Integration Lead assumption.

---

# 12. Integration Violation Rules

If donor contracts disagree:

    SAT / VIOL / UNKNOWN

If VIOL:

    stop
    → identify exact donor owner
    → return defect with exact SHA/file/function/schema
    → donor owner repairs
    → exact-head Verify
    → independent re-audit
    → only then resume the blocked integration step

Integrator MUST NOT:

- bypass #177 validator;
- silently normalize legacy Listing vocabulary;
- accept both id and listingId through a hidden compatibility layer;
- duplicate market/listing/reservation/wallet/item/ledger/profession/position state;
- invent reservation rules;
- invent tradeRange;
- make UI mutate domain state;
- make AI commit;
- trust AI knowledge as current world truth;
- create merchant/shop wallets or inventories;
- generate VERIFIED/COMMITTED flags;
- turn UNKNOWN into a default value;
- decrement Listing or mark Reservation committed after root commit as a separate non-atomic cleanup;
- evict replay receipts merely to keep trading.

---

# 13. Stop Conditions

The Integration Lead stops the current gate immediately when any condition is true:

1. current main changes from the audited integration base and compatibility has not been re-evaluated;
2. a donor exact head changes after evidence was collected;
3. exact-head CI is missing/failing;
4. Success Contract and source/schema disagree;
5. donor is still based on pre-RC3.2 behavior that conflicts with current main;
6. AI/market/read-model vocabulary does not match the accepted canonical Listing id+revision contract;
7. more than one writer exists for a domain;
8. a required current snapshot is absent or UNKNOWN;
9. market position/tradeRange has no canonical source;
10. arrival evidence is fabricated or unavailable;
11. Reservation authority/lifecycle is absent;
12. Listing revision is missing/stale;
13. global active reservation projection is incomplete;
14. item identity overlaps another active reservation;
15. wallet or Rust adapter would require a parallel state copy;
16. a staged settlement cannot keep source state byte-stable on failure;
17. root replacement would occur before all commit-boundary postconditions;
18. transaction success would be shown before canonical receipt validation;
19. save/load would drop replay receipts or cost-basis identity;
20. Browser proof cannot reproduce the intended physical travel/trade path;
21. an attempt is made to solve a blocker by lowering acceptance.

---

# 14. Acceptance Handoff to RC4 Integration Lead

## 14.1 Planner handoff state

This planning document is usable as the canonical integration wiring plan.

Production RC4 integration itself is NOT SAT.

Current overall state:

    HOLD / UNKNOWN

with one explicit cross-donor VIOL at the audited heads: #178 legacy Listing vocabulary versus repaired #179. #179 is now SAT as the RC3.2-synced Pricing/Listing/Ledger donor after exact-head Verify #1979 SUCCESS. #180 is SAT as a docs-only UI prototype donor after Verify #1990 SUCCESS.

## 14.2 Preconditions before Integration Step 1 may be closed

Integration Lead must re-audit:

- current main exact SHA;
- RC3.2 retained regressions;
- exact donor heads;
- exact Success Contracts;
- exact-head Verify status;
- changed files;
- post-RC3.2 compatibility.

Required donor-side repairs before progression:

1. #178 owner must replace legacy `listingId + createdTick/snapshotVersion` consumption with the accepted canonical #179 Listing identity/revision contract, then exact-head Verify.
2. Home Market owner must define canonical Listing/BuyOffer reference mutation if those arrays remain authoritative.
3. Reservation authority must be defined.
4. market tradeRange source must be defined; #178 defaultTradeRange is not authority.
5. Navigation must expose/approve the producer of the position/arrival evidence consumed by #178; only that producer may assert `verified:true`.
6. BuyOffer procurement matching path must be defined.
7. post-settlement Listing/Reservation transition and partial-fill rules must be defined.
8. production persistence ownership for BuyOffers, Reservations, tradeReplay, Ledgers, and any required AI journal must be explicit.

## 14.3 Acceptance harness handoff

Use PR #182 as the acceptance harness workstream instead of recreating a weaker suite.

Do **not** hard-pin the harness from this planning document while PR #182 is still moving.

Handoff rule:

    re-read PR #182 current exact head
    → require owner-declared/factually stable head
    → require exact-head Verify SUCCESS on that same SHA
    → only then pin it as the acceptance baseline

Latest observed during this audit:

    head 9a1b6581c753613b3a14558a94ff708132375838
    Verify #2002 in progress

Required artifacts:

- `docs/RC4_MERCHANT_ECONOMY_ACCEPTANCE_SUITE.md`;
- `tests/rc4-acceptance-suite.test.mjs`;
- `verification/rc4/merchant-economy-matrix.json`;
- `verification/rc4/merchant-economy-fixture-contract.json`;
- `verification/rc4/preflight.mjs`.

Before Master Gate execution, donor SHA metadata in that harness must be re-audited against the exact selected integration donors and the final frozen #182 head.

Do not treat #182 itself as an accepted harness donor while its head is changing or while its exact-head Verify is incomplete. The preflight is expected to return UNKNOWN while required bindings are absent. Do not weaken the preflight or turn UNKNOWN into PASS.

## 14.4 Required integrated proof after all dependencies are SAT

The eventual integration candidate must prove at least:

### Authority proof

- one writer per domain;
- no hidden adapter;
- no second wallet/inventory/reservation/ledger/position authority;
- UI and AI cannot commit.

### Customer sale proof

- customer knows only allowed market/listing evidence;
- real Navigation path;
- real verified arrival;
- current Listing refresh;
- current revision-bound Reservation;
- no remote purchase;
- C -> Merchant conserved wallet transfer;
- exact Rust item IDs transfer;
- one canonical receipt;
- one root replacement;
- Ledger Revenue/COGS/Profit from receipt;
- Career counts canonical non-duplicate transaction only;
- UI success appears only from canonical verified result.

### Producer procurement proof

- Producer item exists in Rust authority;
- Merchant BuyOffer path follows a newly approved matching contract;
- real travel/range;
- canonical Listing/Reservation as required by #177;
- Merchant -> Producer money transfer;
- Producer -> Merchant exact item transfer;
- Merchant Ledger purchase/cost basis;
- Merchant Career progression if Merchant is a canonical party;
- replay no-op.

### Atomic failure proof

For every fail point:

- insufficient money;
- stale Listing;
- invalid Reservation;
- overlapping Reservation;
- dead party;
- out of range;
- wallet failure;
- item transfer failure;
- receipt/replay failure;
- market postcondition failure;

the authoritative source root must remain unchanged.

### Replay and persistence proof

- exact transaction replay before save = no-op;
- save/load;
- exact old transaction replay after load = no-op;
- conflicting reuse of transaction ID = fail closed;
- wallet replay remains intact;
- tradeReplay remains intact;
- Listing revision unchanged;
- cost basis unchanged;
- Merchant Career not double-counted.

### UI/browser proof

- existing home is still visibly a home;
- open/closed market state is read-only;
- listing price/quantity/stock from canonical read model;
- buy offers read-only/intent-only;
- Merchant inspector reads canonical profession + Ledger;
- transaction feedback only after canonical verified commit;
- desktop proof;
- Android landscape proof;
- no stale browser cache/import-map regression;
- existing RC3.2 production/material loop retained.

Only after integrated exact-head SAT may the normal release process continue to merge and exact-main public proof. This planning branch itself does not authorize any merge.

---

# 15. Immediate Repair / Donor Queue

These workstreams may run in parallel. Their outputs return to this Integration Contract for compatibility audit before Integration Step 1 can close.

## A — #178 AI canonical Listing repair — PRIORITY 1 / VIOL

Owner: Merchant / Customer AI donor.

Must repair:

- consume canonical #179 `Listing.id`;
- consume/retain canonical `Listing.revision`;
- bind purchase identity to current revision instead of legacy `createdTick/snapshotVersion`;
- carry current Listing revision in purchase-intent evidence;
- keep AI proposal-only and `authoritative:false`;
- do not create Reservation or commit Trade;
- retain local-knowledge, affordability, real-travel and arrival gates;
- re-audit/sync against RC3.2 main;
- exact-head Verify required.

Exit:

    source + tests + Success Contract aligned
    → exact-head Verify SUCCESS
    → independent compatibility audit against #179/#177

## B — #176 Home Market reference authority — PRIORITY 1 / UNKNOWN

Current state has `listingIds` / `buyOfferIds` but no canonical attach/detach writer.

Required contract:

- owner-controlled reference mutation;
- deterministic idempotent add/remove;
- no duplicate refs;
- Home Market owns references only, never Listing/BuyOffer payload;
- no item, money or housing mutation;
- invalid/archived market behavior explicit;
- save/load/reference replay proof;
- post-RC3.2 compatibility proof.

Integrator must never mutate those arrays directly.

## C — Canonical Reservation authority — PRIORITY 1 / HARD STOP

An owner must be explicitly assigned before implementation. The contract must satisfy #177 rather than create a competing reservation model.

Minimum requirements:

- deterministic reservation ID;
- exact Listing id + listingRevision;
- buyer/seller/market/item/quantity/unitPrice binding;
- frozen exact `itemIds[]`;
- complete global ACTIVE projection;
- overlap prevention across markets;
- idempotent create/replay;
- terminal/release lifecycle;
- persistence + old-save behavior;
- cleanup/reconciliation;
- no wallet/item ownership;
- no wall-clock expiry rule.

## D — Market binding + Navigation evidence — PRIORITY 1 / HARD STOP

Market binding must source from named authorities:

    id
    open
    x
    y
    tradeRange

#178's defaultTradeRange is not authority.

Navigation/task authority must be the only producer allowed to assert:

    positionEvidence.verified = true
    arrivalEvidence.verified = true

Evidence must bind actual agent, coordinates, target/market, simulation tick/evidence identity and real Navigation/task outcome.

#177 still revalidates current distance at settlement.

## E — #179 BuyOffer persistence/procurement bridge — PRIORITY 2 / UNKNOWN

On current SAT #179 head `da82d217...`, Listing has a canonical collection + serialize/restore path, but BuyOffer remains row-level only.

Owner must define:

- canonical BuyOffer collection;
- create/replay/conflict behavior;
- serialization/restore/corrupt-state validation;
- Home Market reference through the #176 API;
- Producer acceptance/matching path.

Because #177 settles Listing + Reservation, BuyOffer procurement must explicitly reach a canonical seller Listing/Reservation without hidden temporary state.

## F — Post-settlement market state + persistence root — PRIORITY 2 / HARD STOP

Owners: Listing / Reservation / Persistence.

Must freeze:

- full-fill Listing transition;
- partial-fill quantity/revision;
- Reservation terminal state;
- reference cleanup/reconciliation;
- all required market-state transitions inside the accepted staged outer boundary;
- production root keys/collections for Home Market, Listings, BuyOffers, Reservations, tradeReplay and Merchant Ledgers;
- old-save defaults without replay loss.

No compensating live-state rollback is accepted.

## Queue close rule

Every workstream closes only through:

    Success Contract
    → exact candidate
    → exact-head Verify
    → SAT / VIOL / UNKNOWN
    → independent compatibility audit

Focused/local tests alone never close a workstream.

---

# 16. Execution Rule Summary

The RC4 Integration Lead is an orchestrator, not a new economic authority.

The safe pattern is:

    read current truth
    → validate current truth
    → call only canonical writers
    → keep changes staged
    → prove all postconditions
    → replace authoritative root once
    → derive accounting/career/UI from canonical receipt

The unsafe pattern is:

    accept intent
    → mutate several live objects
    → patch failures with rollback
    → fabricate missing evidence
    → normalize incompatible donor schemas
    → declare PASS because the UI looks correct

UNKNOWN never passes.

---

## Audit anchors

- Current main / RC3.2 merge: https://github.com/nustanakritwithai/Simclone/commit/1b60b13394c11bd7b03d10227919f4bb509b02df
- PR #175: https://github.com/nustanakritwithai/Simclone/pull/175
- PR #176: https://github.com/nustanakritwithai/Simclone/pull/176
- PR #177: https://github.com/nustanakritwithai/Simclone/pull/177
- PR #178: https://github.com/nustanakritwithai/Simclone/pull/178
- PR #179: https://github.com/nustanakritwithai/Simclone/pull/179
- PR #180: https://github.com/nustanakritwithai/Simclone/pull/180
- PR #181: https://github.com/nustanakritwithai/Simclone/pull/181
