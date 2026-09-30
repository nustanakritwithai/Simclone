# ER6 — Four-Role Autonomous Economy Closure Success Contract

Status: **ACTIVE CANDIDATE CONTRACT / NOT PRODUCTION SAT**

Date: 2026-09-30  
Branch: `feature/er6-autonomous-economy-closure-20260930`  
Audited production baseline: `a635b9a0614ee264929f91e4bbb88422881cdd4b`

ER5 was released at `94af1ed79fa80eecdbbc3912c89d745e436db5f5`. Production then advanced by eight commits through merged Pose Studio PR #223. The compare `94af1ed...main` is ahead by 8 / behind by 0 and changes only Pose Studio/render/import-map files; no Career Economy authority is replaced.

Open overlap warning at contract creation:
- PR #224 — playtest repair, draft, based on old `94af1ed...`; files overlap UI/workflow, not ER6 economy authority.
- PR #221 — Pose Studio action motions, draft, based on older `33f7b748...`; presentation only.
- Older #207/#212/#213 are historical/stacked economy lines and are not merge sources.

UNKNOWN is never PASS. Candidate evidence never substitutes for production evidence.

## Goal

ER6 closes Career Economy V1 by proving that already-released authorities can sustain and repeat this autonomous loop:

```text
Raw Producer
→ canonical raw-resource production
→ protected reserve
→ canonical sale / BuyOffer response

Crafter
→ actor-observed demand
→ canonical material procurement
→ canonical craft
→ real physical product

Merchant
→ actor-observed commercial opportunity
→ canonical sourcing / funded BuyOffer
→ canonical Navigation + Trade
→ canonical stock + Ledger basis
→ deterministic canonical Listing

Consumer / Adventurer
→ legitimate simulation need
→ legal market observation
→ canonical Navigation + purchase
→ exact acquired item
→ actual equip/use/consumption

use / depletion / shortage
→ new actor-observed demand
→ next cycle
```

A single trade is not ER6. A valid proof requires at least one repeated economic cycle after the first fulfilled demand.

## Existing released gates

ER6 reuses and must retain:
- ER0 Resource Ownership / Representation
- ER1 Actor-Observed Local Demand
- ER0B Canonical Bulk Resource Settlement
- ER2 Raw Producer
- ER3 Demand-driven Crafter
- ER4 Material Procurement
- ER5 Merchant Full Autonomy
- RC4 Merchant Economy
- Adventure
- RC2
- RC3.1
- RC3.2

ER6 does not reimplement them.

## Current integration gap at audited baseline

At `main@a635b9a...`:
- engine tick already executes released Merchant autonomy;
- engine tick already executes Crafter material procurement;
- normal agent loop already executes demand-driven Crafter craft intents;
- normal agent loop already executes Raw Producer autonomy;
- `rc4-customer-market-policy.mjs` already provides deterministic customer market intents including travel, purchase, and post-purchase carry/equip/use proposals;
- however, the normal world `step()` does not yet wire a canonical autonomous consumer pass from legitimate world need through that customer policy.

Therefore ER6 may add bounded **consumer policy wiring / projection**, but must not add a new customer inventory, Wallet, Trade Kernel, Listing, Navigation, profession, item or demand mutation authority.

If a legitimate released need cannot be projected for the chosen item, the proof is UNKNOWN/BLOCKED. ER6 must not manufacture demand merely to make the loop pass.

## Authority map

Canonical owners remain:

- profession: existing profession / `adoptProfession` authority
- actor-observed demand: `economic-demand.mjs`
- actor market knowledge: `rc4-market-observation.mjs`
- customer market proposal policy: `rc4-customer-market-policy.mjs`
- Home Market: `home-market.mjs`
- Listing: `merchant-listing.mjs`
- BuyOffer: `merchant-buy-offer.mjs`
- Reservation: `merchant-reservation.mjs`
- settlement/replay: `trade-kernel.mjs`
- Wallet: `currency-wallet.mjs`
- Merchant accounting: `merchant-ledger.mjs`
- Rust physical item ownership/equipment: Rust possession authority
- bulk resources/materials: existing resource/material authorities
- crafting/recipe/mastery/quality: released crafting authorities
- Navigation/path/position/arrival: released Navigation authority
- survival/lifecycle: released survival/lifecycle authority
- Adventure use/equipment/combat: released Adventure authorities
- save/load: existing world serialization/migration authority

UI is never source of truth.

## Forbidden authorities

ER6 must not introduce:
- `economyInventory`
- `producerInventory`
- `crafterInventory`
- `merchantInventory`
- `shopInventory`
- `consumerInventory`
- `economyWallet`
- `merchantWallet`
- `shopWallet`
- second Ledger
- second Trade Kernel
- private transaction store
- global demand oracle
- global price oracle
- direct item/resource transfer by policy
- direct Wallet/Ledger writes by policy
- direct task/path/position writes by economy policy
- teleport
- `Math.random()` economic/gameplay rules
- wall-clock `Date` economic/gameplay rules

## Legal observations

A policy may act only from evidence already legal to that actor:
- own canonical profession and needs;
- own canonical possessions/equipment/resources;
- own Wallet and Ledger where applicable;
- actor-observed market/demand knowledge;
- current canonical state resolved from an observed ID only at command authorization;
- canonical path/arrival evidence.

Hidden world truth may be used by acceptance assertions to verify conservation, but not by the autonomous decision policy.

## Consumer need contract

ER6 consumer demand must derive from real released state.

Allowed examples include:
- profession-required tool absent from canonical bag/equipment;
- existing equipment need already represented by released customer policy;
- released Adventure gear/equipment need;
- existing consumable need where actual consumption authority exists;
- released recipe/production need when the consumer is legitimately that role.

A valid ER6 consumer need must define:
- why the need exists;
- which released state proves it;
- which item kind satisfies it;
- whether fulfillment is `carry`, `equip`, or `use`;
- how fulfillment clears or changes the need;
- how later use/depletion can create renewed demand.

A fixture-only `needs:[...]` array that has no world-derived source is insufficient for the final closed-loop proof.

## Policy/mutation boundary

ER6 policy may only propose bounded actions.

Canonical commands must remain the mutation boundary for:
- market travel;
- purchase;
- item equip/use;
- Listing/BuyOffer creation;
- craft;
- producer offer acceptance;
- any other economic transfer.

When a proposal becomes stale between observation and commit, the command must fail closed and the policy must re-plan.

## Four-role proof

A required candidate proof uses four distinct actors:

### Producer A
- owns/gathers a canonical raw resource;
- preserves protected reserve;
- sees legal demand/BuyOffer;
- sells only tradable surplus through canonical settlement.

### Crafter B
- is the released Crafter profession;
- sees legitimate product demand;
- lacks at least one canonical input;
- procures that input from A or a legal canonical route;
- crafts one exact physical item through `CRAFT_ITEM`;
- does not mint ingredients/output.

### Merchant C
- is the released Merchant profession;
- sees legal demand/opportunity;
- sources B's exact physical item;
- travels canonically;
- settles through Wallet/Reservation/Trade;
- acquires Ledger cost basis;
- creates deterministic resale Listing.

### Consumer / Adventurer D
- remains its existing profession;
- develops a legitimate released need;
- observes C's market legally;
- travels canonically;
- buys C's exact item;
- receives the same physical item instance;
- equips/uses/consumes it through released authority;
- the fulfilled need changes canonical state.

Then the simulation must reach a later state in which a new shortage/demand signal is generated and at least a second economic cycle begins without player trade commands.

## Conservation

For every closed-cycle acceptance fixture record before/after totals where applicable.

Required invariants:
- total canonical currency conserved except for an explicitly released money source/sink;
- no physical item duplication;
- no bulk-resource duplication;
- no phantom stock;
- one committed trade has one replay identity;
- buyer charged once;
- seller paid once;
- Merchant Ledger ingests each transaction once;
- protected Producer reserve remains protected;
- open Listing/Reservation/BuyOffer commitments never exceed owned/funded capacity.

## Market adaptation / stability

ER6 must prove bounded policy response:

### Shortage
When actor-observed demand exceeds known supply:
- Crafter may produce;
- Merchant may source;
- funded BuyOffer may appear.

### Adequate stock
When demand is covered:
- no endless Crafter production;
- no duplicate BuyOffer;
- no duplicate Listing.

### Oversupply
When observed stock exceeds current demand:
- new procurement/production is reduced or stops;
- Merchant does not accumulate unusable stock forever.

### Funding shortage
Merchant cannot create or maintain commitments beyond canonical funded capacity.

### Missing material
Crafter procures or BLOCKS; it never mints the material.

## Long-horizon proof

Run deterministic unattended simulation for multiple economic cycles / simulated days with:
- no player trade command;
- no fixture stock injection after the loop starts;
- no hidden demand injection after the loop starts;
- no repair mutation after the loop starts.

Observe at minimum:
- Producer reserve and surplus;
- bulk-resource movement;
- Crafter procurement and craft cadence;
- Merchant stock;
- BuyOffers;
- Listings;
- customer purchases;
- post-purchase item use/equip;
- Wallet balances;
- Ledger revenue/COGS/realized profit;
- stale commitments;
- duplicate IDs;
- save/load continuity;
- second demand cycle.

Pathological unbounded growth, permanent stock traps, stale authorization, or integration deadlock is VIOL unless the evidence proves the cause is a legitimate simulation condition rather than an implementation fault.

## Save/load checkpoints

Acceptance must cover save/load:
1. before material procurement;
2. after BuyOffer creation;
3. during canonical travel;
4. after resource settlement;
5. after craft completion;
6. after Merchant purchase;
7. after Listing creation;
8. after consumer purchase.

After restore:
- no duplicate trade;
- no duplicate stock;
- no duplicate Listing;
- no duplicate BuyOffer;
- no duplicate Ledger entry;
- no forged Navigation ownership;
- ephemeral journey provenance may be lost only if policy safely re-plans through canonical Navigation.

## Death/recovery

If an actor dies during an economic journey:
- no policy may keep writing economic mutations on behalf of the dead actor;
- no forged arrival may survive;
- active market/travel intent must fail closed or be reconciled by existing authorities;
- reserved/listed/owned stock remains canonical and recoverable according to existing authority rules;
- ER6 must not invent a new estate/inheritance authority.

If existing released authorities do not define required recovery semantics, classify the scenario UNKNOWN/BLOCKED rather than silently creating one.

## Required attacks

At minimum:
1. hidden demand
2. stale demand
3. hidden Listing
4. stale Listing
5. closed market
6. changed Listing revision
7. unaffordable purchase
8. unfunded BuyOffer
9. oversubscribed bulk stock
10. physical item double-list
11. remote purchase
12. forged arrival
13. buyer replay
14. seller replay
15. save/load purchase replay
16. save/load Listing duplication
17. save/load BuyOffer duplication
18. material mint
19. item mint
20. money mint
21. second inventory
22. second Wallet
23. second Ledger
24. second Trade Kernel
25. Merchant policy direct Wallet write
26. Crafter policy direct material write
27. Producer policy direct Wallet write
28. any economy policy direct path/position write
29. corrupt observed demand
30. corrupt market knowledge
31. no path
32. actor death during commercial journey
33. market closes during journey
34. stock sold before arrival
35. material unavailable before craft
36. consumer demand disappears before purchase
37. multiple Merchants compete for one Listing
38. BuyOffer-bound stock stolen by another buyer
39. profession overwrite
40. old-save migration regression
41. ER5 retained
42. ER4 retained
43. ER3 retained
44. ER2 retained
45. RC4 retained
46. Adventure retained
47. RC2 retained
48. RC3.1 retained
49. RC3.2 retained

UNKNOWN remains UNKNOWN.

## Candidate SAT gate

ER6 becomes **CANDIDATE SAT** only when one exact candidate head proves:
- full test suite PASS;
- exact four-role closed loop PASS;
- Producer → Crafter resource path PASS;
- Crafter demand → procurement → craft PASS;
- Merchant source → canonical settlement → Ledger → resale PASS;
- legitimate consumer need → observation → travel → purchase → actual use PASS;
- second economic cycle PASS;
- conservation PASS;
- no duplicate authorities PASS;
- save/load/replay attacks PASS;
- long-horizon unattended proof PASS;
- ER2/ER3/ER4/ER5/RC4/Adventure/RC2/RC3.1/RC3.2 regressions PASS;
- browser/runtime PASS;
- import-map/cache pins exact where applicable;
- no browser JavaScript errors.

Then freeze the exact candidate head.

## Production gate

After Candidate SAT:
1. re-check exact candidate head;
2. re-check current main drift;
3. re-audit overlap with open parallel PRs;
4. confirm mergeability;
5. mark Ready only after exact-head evidence is SAT;
6. merge the exact verified head only;
7. capture exact merged-main SHA;
8. run exact-main Verify;
9. require Pages SUCCESS;
10. require public HTTP PASS;
11. require exact deployed bytes;
12. require retained public gates;
13. require public four-role proof if the release workflow supports it;
14. only then declare **ER6 FOUR-ROLE AUTONOMOUS ECONOMY = PRODUCTION SAT**.

Candidate evidence is not production evidence.

## Career Economy V1 closeout

Only after ER6 production gate succeeds may the project declare:

**CAREER ECONOMY V1 = CLOSED**

Meaning the autonomous world supports:

```text
Raw Producer → Crafter → Merchant → Consumer / Adventurer → renewed demand
```

without parallel Wallet, Inventory, Trade, Ledger, Navigation, Market, item or resource authorities.

After closure, next work is a stability/balance gate before any new major economy domain.
