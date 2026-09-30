# ER5 — Merchant Full Autonomy Success Contract

Status: **ACTIVE CANDIDATE CONTRACT / NOT PRODUCTION SAT**

Date: 2026-09-30  
Production baseline: `9fdf3d9d2b9cfae24b78c880cc8122efbffabcad`  
Branch: `feature/er5-merchant-full-autonomy-20260930`

UNKNOWN is never PASS. Candidate evidence never substitutes for production evidence.

## Goal

ER5 turns the already-released RC4 Merchant into an autonomous business operator without adding a second economic authority.

The intended loop is:

```text
actor-observed demand
→ Merchant derives bounded stock shortage
→ use owned canonical stock, or source stock
→ observed Listing purchase OR canonical BuyOffer
→ canonical Navigation when purchasing remotely
→ Reservation / Trade Kernel / Wallet / item-or-resource transfer
→ Merchant owns real stock
→ deterministic canonical pricing
→ canonical Listing at own Home Market
→ verified customer/producer trade
→ Merchant Ledger Revenue / COGS / Realized Profit
→ next deterministic commercial decision
```

ER5 owns policy only. Every mutation remains behind an existing canonical command/authority.

Runtime activation is scoped to the Independent/Career Economy world line used by ER2–ER5. Legacy RC4 command-driven fixtures remain command-driven and must not gain surprise Merchant actions merely because ER5 policy exists.

## Existing authority map

ER5 reuses, and does not replace:

- actor-observed demand: `economic-demand.mjs`
- actor market knowledge: `rc4-market-observation.mjs`
- Home Market: `home-market.mjs`
- Listing: `merchant-listing.mjs`
- BuyOffer: `merchant-buy-offer.mjs`
- Reservation: `merchant-reservation.mjs`
- pricing arithmetic: `merchant-pricing.mjs`
- Merchant accounting: `merchant-ledger.mjs`
- Merchant profession/progression: `merchant-career.mjs`
- trade validation/atomic commit/replay: `trade-kernel.mjs`
- currency: `currency-wallet.mjs`
- physical item ownership: Rust Item Authority
- bulk-resource ownership: canonical material/resource authority
- path/task/position/arrival: canonical Navigation
- engine scheduler and survival rules: existing engine/lifecycle/survival authority.

No ER5 persistent save root is introduced.

## Merchant demand knowledge

The legal demand source is:

`projectActorObservedDemand(world, merchant)`

A usable projection must be:

- `status === 'SAT'`
- `scope === 'ACTOR_OBSERVED'`
- backed by current validated RC4 roots and actor market knowledge.

ER5 may use only demand, supply and verified-trade evidence present in that actor-scoped projection, plus the Merchant's own canonical Ledger and own Home Market.

ER5 must never read hidden/global market truth as commercial knowledge.

Hidden, stale, changed, closed or corrupt market evidence must not authorize a commercial action.

If the demand/market authority cannot be validated, ER5 returns `UNKNOWN`; it must not reinterpret corruption as zero demand, zero supply, success or idle.

## Stock knowledge

Merchant stock is derived only from canonical ownership:

- physical items: tradable Rust item instances actually in the Merchant bag;
- bulk resources: canonical material/resource balance;
- purchased acquisition basis: Merchant Ledger purchases.

Open Listings and active Reservations are commitments, not extra stock.

A physical item already in an OPEN Listing cannot be listed again.

Bulk quantity already committed by the Merchant's OPEN Listings or ACTIVE Reservations must be subtracted before any new autonomous Listing is proposed.

ER5 creates no `merchantInventory`, `shopInventory` or private stock ledger.

## Deterministic demand priority

Eligible demand is actor-observed, tradable demand with a positive Merchant stock shortage.

Rows are ordered deterministically by:

1. `stockShortageQuantity` descending;
2. `shortageQuantity` descending;
3. `liveDemandQuantity` descending;
4. `historicalDemandQuantity` descending;
5. `verifiedTradeCount` descending;
6. `itemKind` ascending.

ER5 V1 keeps each autonomous sourcing/listing action bounded to one physical instance or one bulk unit per commercial cycle. This bounds funding, stock commitment and replay behavior while preserving repeated deterministic operation across ticks.

## Survival and work priority

Merchant autonomy yields to hard simulation priorities.

ER5 is BLOCKED when the Merchant is not in a productive lifecycle stage, is hungry/exhausted below released work thresholds, is in active Adventure/combat, or has protected non-market work.

A genuine canonical market-travel task may continue while the policy revalidates its commercial target.

ER5 never assigns `agent.task`, path, coordinates or arrival state directly.

## Autonomous sourcing from observed Listings

A Merchant may buy an observed Listing only when all of the following remain true at decision time:

- the demand projection is SAT and actor-scoped;
- the Listing appears as legal observed supply for the demanded item/resource;
- current canonical Listing identity, quantity, price and revision still match the observation;
- the market is still OPEN;
- seller is not the Merchant;
- BuyOffer-bound stock is either unbound or bound to this Merchant;
- canonical path exists;
- the bounded purchase is affordable after current canonical Wallet evidence;
- no protected work/survival gate blocks the action.

Selection is deterministic:

1. demanded item priority;
2. unit price ascending;
3. total price ascending;
4. path distance ascending;
5. market ID ascending;
6. Listing ID ascending.

Remote purchase is forbidden.

The action sequence is only:

```text
RC4_TRAVEL_TO_MARKET
→ canonical arrival evidence
→ RC4_BUY_LISTING
```

The `RC4_BUY_LISTING` boundary must independently recompute ER5 Merchant purchase authorization from current canonical state. Caller-supplied Merchant-need flags are never trusted.

## Autonomous BuyOffers

When demanded stock is short and there is no currently legal/affordable observed Listing, ER5 may propose a canonical BuyOffer only if legal pricing evidence exists.

A new autonomous BuyOffer must be:

- on the Merchant's own Home Market;
- for exactly the current bounded shortage;
- deterministic;
- canonical through `RC4_CREATE_BUY_OFFER`;
- funded by current Wallet capacity;
- bounded by existing OPEN BuyOffer commitments;
- not a duplicate open commitment for the same Merchant/item/asset type;
- saveable/replay-safe through the existing BuyOffer collection.

The Merchant policy does not reserve or debit money. Funding is a creation gate, not a shadow wallet.

For funding capacity:

```text
available funding
= canonical Wallet balance
- sum(total value of Merchant's other OPEN BuyOffers)
```

Malformed or unsafe totals are `UNKNOWN` / fail-closed.

A BuyOffer cannot exceed the remaining funded capacity.

## Pricing authority

`merchant-pricing.mjs` remains the pricing arithmetic authority.

ER5 policy supplies only legal evidence and bounded policy parameters.

### Resale ask

For stock bought by this Merchant:

- acquisition cost comes from the Merchant Ledger's unconsumed purchase basis;
- no caller-supplied cost is trusted;
- deterministic ask pricing uses `quoteAskPrice()`;
- scarcity input may use only actor-observed demand and Merchant-local stock.

If canonical acquisition cost cannot be established, ER5 must not autonomously list the stock as a profitable resale. The result is UNKNOWN/BLOCKED rather than guessed zero cost.

### BuyOffer bid

A BuyOffer price must be derived deterministically from legal Merchant-known price evidence by the existing pricing module.

Legal reference evidence may include:

- current actor-observed Listing prices;
- verified Merchant-owned purchase/sale history in the canonical Ledger;
- verified trade evidence already present in the actor-scoped demand projection.

No global price oracle, random price, wall-clock time or guaranteed-profit rule is allowed.

If no legal reference price exists, ER5 does not fabricate one and cannot create the BuyOffer.

## Autonomous Listings

Merchant-owned stock may be listed only through `RC4_CREATE_LISTING`.

Physical Listing requirements:

- exact canonical Rust item instance;
- Merchant currently owns/tradably holds it;
- item is not already OPEN-listed;
- canonical Ledger acquisition basis exists for autonomous resale pricing.

Bulk Listing requirements:

- canonical bulk quantity exists;
- committed OPEN Listing/ACTIVE Reservation quantity is deducted first;
- bounded listed quantity does not overcommit stock;
- canonical Ledger purchase basis covers the autonomous resale quantity.

Demand never mints stock.

ER5 may create/open its own Home Market only through the already-released RC4 commands and ownership checks.

## Trade, Wallet and Ledger

ER5 never directly writes:

- Wallet balances or receipts;
- Rust item ownership;
- bulk material/resource balances;
- Reservation state;
- Trade replay receipts;
- Listing settlement;
- BuyOffer settlement;
- Merchant Ledger purchases/sales/totals;
- Merchant profession progression.

Purchase/resale settlement remains the released RC4 atomic path.

Revenue, COGS and Realized Profit remain derived only from canonical verified Trade executions ingested by Merchant Ledger.

## Replay and save/load

ER5 adds no autonomous journal and no persistent private cycle state.

Replay/idempotency must come from canonical structures:

- deterministic BuyOffer IDs;
- immutable Listing creation receipts and item listing lock;
- Listing revision;
- Reservation identity/lifecycle;
- Wallet transfer receipts;
- Trade Kernel replay receipts;
- Merchant Ledger transaction IDs;
- canonical item/resource ownership.

After a successful purchase, canonical stock/Ledger state changes the next policy result; the same pre-purchase intent cannot double-charge or duplicate stock.

After save/load:

- canonical BuyOffer/Listings/Ledger/Wallet/Trade replay remain authoritative;
- no completed purchase is repeated;
- no Listing/BuyOffer is duplicated;
- ephemeral Navigation provenance is not reconstructed or serialized as authority;
- an in-flight market journey without valid runtime provenance is safely replanned.

## Profession separation

ER5 never changes profession.

Merchant remains separate from:

- Raw Producer;
- Crafter;
- Adventurer.

Existing Merchant/Crafter and Merchant/Adventurer locks remain mandatory.

## States

### SAT

Policy evidence is valid and the returned action is a bounded proposal that can be routed to an existing canonical command.

### IDLE

Evidence is valid but there is no current commercial action, for example no actor-observed demand or demand is already covered.

### BLOCKED

The opportunity is understood but cannot act now, for example survival, protected work, insufficient funds, no path, existing commitment or missing legal price evidence.

### UNKNOWN

Required authority/evidence is malformed, missing where it must exist, contradictory, corrupt, unsafe or unverifiable.

UNKNOWN is never converted into IDLE, BLOCKED success or PASS.

## No second authority proof

Static/runtime tests must prove ER5 policy contains no direct:

- Wallet mutation;
- Rust item push/transfer;
- material/resource balance mutation;
- Listing/BuyOffer/Reservation collection mutation;
- Ledger mutation;
- profession write;
- task/path/position write;
- recipe/quality write;
- `Math.random`;
- wall-clock `Date`.

## Required attacks

At minimum prove:

1. hidden Listing does not cause Merchant purchase;
2. stale Listing does not cause purchase;
3. hidden demand does not create BuyOffer;
4. stale demand does not create BuyOffer;
5. corrupt market knowledge returns UNKNOWN;
6. corrupt demand authority returns UNKNOWN;
7. insufficient funds blocks procurement;
8. Merchant cannot mint money;
9. Merchant cannot mint physical item;
10. Merchant cannot mint bulk resource;
11. Merchant cannot remote-buy;
12. forged arrival is rejected;
13. closed market purchase is rejected;
14. stale Listing revision is rejected;
15. replay does not double-charge;
16. replay does not double-pay seller;
17. replay does not duplicate stock;
18. the same physical item cannot be double-listed;
19. the same bulk stock cannot be overcommitted;
20. BuyOffer cannot exceed funded capacity;
21. BuyOffer-bound Listing cannot be stolen;
22. Merchant does not steal Crafter profession;
23. Merchant does not overwrite Adventurer profession;
24. Merchant AI cannot directly mutate Wallet;
25. Merchant AI cannot directly mutate Rust items;
26. Merchant AI cannot directly mutate material balance;
27. Merchant AI cannot directly mutate Ledger;
28. Merchant AI cannot directly assign task/path/position;
29. no second inventory;
30. no second wallet;
31. no second Ledger;
32. no second Trade Kernel;
33. no `Math.random`;
34. no wall-clock `Date`;
35. save/load does not duplicate BuyOffer;
36. save/load does not duplicate Listing;
37. save/load does not duplicate purchase;
38. ER4 Crafter Procurement retained;
39. ER3 Demand-driven Crafter retained;
40. ER2 Raw Producer retained;
41. RC4 retained;
42. Adventure retained;
43. RC2 / RC3.1 / RC3.2 retained.

## Candidate E2E

At minimum prove on one exact candidate head:

### Observed-supply path

```text
real actor-observed demand
→ Merchant stock shortage
→ legal observed current Listing
→ canonical RC4 travel
→ canonical arrival
→ RC4_BUY_LISTING
→ Wallet + exact stock transfer
→ Merchant Ledger purchase
→ deterministic ask price
→ RC4_CREATE_LISTING at own Home Market
→ real customer purchase
→ Revenue / COGS / Realized Profit
```

### BuyOffer path

```text
real actor-observed demand
→ no suitable observed Listing
→ legal known price evidence
→ funded canonical BuyOffer
→ real Producer response
→ canonical procurement Listing
→ canonical travel/purchase
→ exact stock ownership + Ledger purchase
→ no duplicate offer/purchase after replay or save/load
```

The fixture may prepare initial actors/homes/market observations, but stock, money, transfers, Listings, BuyOffers and trades under test must use released canonical authorities.

## Candidate SAT gate

ER5 may become **CANDIDATE SAT** only when one exact candidate head passes:

- full `npm test`;
- ER5 autonomous observed-supply sourcing E2E;
- ER5 autonomous Listing/resale/accounting E2E;
- ER5 BuyOffer path E2E;
- funded-capacity / stock-overcommit attacks;
- canonical market travel and arrival attacks;
- replay/idempotency/save-load attacks;
- import-map/cache exact pins;
- ER4 regression;
- ER3 regression;
- ER2 regression;
- RC4 desktop/mobile;
- Active Observation UI;
- Adventure;
- Independent browser smoke;
- RC2;
- RC3.1;
- RC3.2;
- no browser/runtime errors.

Then:

1. freeze exact candidate head;
2. confirm production main has not drifted;
3. confirm mergeability;
4. mark Ready only after mandatory candidate evidence is SAT;
5. merge only the exact verified head;
6. capture exact merged-main SHA;
7. run exact-main Verify;
8. require Pages SUCCESS;
9. require public HTTP PASS;
10. require exact deployed bytes;
11. require retained public browser gates;
12. only then declare **ER5 = PRODUCTION SAT**.

Do not start ER6 before ER5 is PRODUCTION SAT.
