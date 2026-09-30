# ER4 — Crafter Material Procurement Success Contract

Status: **ACTIVE CANDIDATE CONTRACT / NOT PRODUCTION SAT**

Date: 2026-09-30  
Production baseline: `bbff378107b571c3e09c80b3431a9323bc1e4a21`  
Branch: `feature/er4-material-procurement-20260930`

UNKNOWN is never PASS. Candidate evidence never substitutes for production evidence.

## Goal

ER4 lets an existing canonical Crafter satisfy an ER3 material shortage by purchasing only supply that the Crafter has actually observed.

```text
ER3 NEEDS_MATERIALS
→ actor-observed ER1/RC4 Listing supply
→ deterministic listing selection
→ canonical market travel
→ canonical RC4_BUY_LISTING
→ Reservation
→ Trade Kernel
→ Wallet debit / seller credit
→ canonical bulk material transfer OR Rust item transfer
→ ER3 re-evaluation
→ canonical CRAFT_ITEM
→ physical crafted output
```

ER4 owns no inventory, money, market, trade, material, profession or task authority.

## Scope boundary

ER4 may autonomously **buy** missing inputs from an already-existing, already-observed open Listing.

ER4 does not:
- create a Home Market;
- create a BuyOffer;
- create a Merchant Listing;
- promote Crafter to Merchant;
- choose or write Merchant prices;
- create money;
- remote-buy;
- teleport;
- gather or mint missing resources;
- create the final crafted item itself.

Merchant inventory/restocking/listing autonomy remains ER5.

## Material-need authority

ER4 consumes ER3 `demandDrivenCrafterSnapshot()`.

Only `NEEDS_MATERIALS` may authorize procurement.

The selected ER3 recipe remains the product authority. ER4 must not change recipe/product merely because a cheaper material Listing exists.

ER4 may inspect ER3 while a genuine canonical market-travel task is active, but normal ER3 crafting intent remains blocked by that task. No craft order may be queued concurrently with market travel.

Supported missing inputs are exactly those exposed by canonical ER3/craft validation:
- wood / stone reserve or recipe shortage;
- charcoal / ironOre / ironIngot / steelIngot processed-material shortage;
- physical recipe ingredient items such as HIDE / FIRE_CORE / prior crafted items.

No private `crafterMaterials` ledger is allowed.

## Supply knowledge authority

Supply must come through actor-observed RC4 knowledge already validated by ER1:

`projectActorObservedDemand(world, crafter)`

A usable supply source must be a current `LISTING` source in that actor-scoped projection.

Therefore:
- hidden Listings do not count;
- stale observations do not count;
- closed/filled/changed Listings do not count;
- hidden market truth cannot refresh actor knowledge;
- corrupt demand/market authority returns UNKNOWN.

ER4 may resolve the observed Listing ID against the current canonical Listing only after ER1 has validated the observation.

## Deterministic procurement ordering

For one current missing material:
1. missing material key ascending;
2. observed open Listing only;
3. correct asset representation;
4. seller is not buyer;
5. BuyOffer-bound Listing must be legally bound to this buyer or is ignored;
6. affordable requested quantity;
7. unit price ascending;
8. total price ascending;
9. market distance ascending;
10. market ID ascending;
11. Listing ID ascending.

For bulk Listings, ER4 requests only:

`min(current missing quantity, current Listing quantity)`

The canonical RC4 buy command may fill that exact quantity and leave a partial Listing open.

For physical ingredient Listings, quantity is one canonical item instance per purchase.

ER4 never buys more than the currently proven missing quantity.

## Wallet authority

Canonical Currency Wallet remains the only money authority.

ER4 may read `getBalance()`.

ER4 never writes balance directly.

Insufficient money returns deterministic `NEEDS_FUNDS` / BLOCKED state. It must not invent credit or income.

## Travel / arrival authority

ER4 may propose:
- `TRAVEL_TO_MARKET`
- `WAIT_TRAVEL`
- `CANCEL_TRAVEL`
- `BUY_LISTING`

The engine routes travel through existing:
- `RC4_TRAVEL_TO_MARKET`
- canonical Navigation task/path/cadence;
- `verifyCanonicalMarketArrival()`.

ER4 never assigns `agent.task`, position or path directly.

A stale/mismatched procurement journey is canceled through the canonical RC4 cancel command, never rewritten in place.

## Purchase authority

Only:

`command(world, 'RC4_BUY_LISTING', ...)`

may commit a purchase.

For bulk resources, ER4 may pass an exact bounded `quantity` to the existing RC4 command. Missing quantity remains the maximum legal autonomous purchase.

The existing full-Listing behavior stays backward compatible when no quantity is supplied by non-ER4 callers.

Canonical settlement remains:
- Listing revision check;
- Reservation;
- arrival evidence;
- Wallet;
- Trade Kernel;
- bulk material adapter or Rust item adapter;
- Listing lifecycle;
- Merchant Ledger when a Merchant is party;
- replay receipt.

## Partial bulk settlement

ER4 requires the existing canonical Listing/Reservation/Trade path to expose partial bulk purchase at the command boundary.

For a bulk Listing of quantity 10 when the Crafter needs 3:
- Reservation locks 3;
- Wallet transfers 3 × unitPrice;
- material authority transfers 3;
- Listing quantity becomes 7 and revision increments once;
- no fake item IDs are created.

BuyOffer-bound procurement Listings retain their existing binding semantics and may not be stolen by another Crafter.

## Survival / work priority

ER4 cannot override:
- hunger / exhaustion;
- lifecycle;
- manual craft training;
- Adventure activity;
- active Rust craft/process work;
- BUILD / CRAFT / PROCESS protected work.

Canonical market travel may use only the existing Navigation preemption contract.

No infinite purchase/travel loop may starve the actor.

## Replay / save-load

ER4 adds no persistent root.

Replay safety comes from canonical Trade/Reservation/Listing/Wallet/material/item authorities.

Acceptance must prove:
- one successful purchase creates one transaction receipt;
- same command replay does not double debit/credit/transfer;
- after procurement satisfies the missing amount, ER4 stops buying;
- save/load after purchase retains materials, money and receipt without repeat purchase;
- save/load during travel loses ephemeral arrival provenance and safely replans a fresh canonical journey instead of accepting forged arrival.

## Required attacks

1. hidden Listing cannot trigger procurement
2. stale Listing cannot trigger procurement
3. corrupt actor demand/market authority stays UNKNOWN
4. Listing for unrelated material is ignored
5. changed Listing revision cannot be bought from stale intent
6. closed/filled Listing is ignored
7. unaffordable Listing does not debit or create credit
8. own Listing cannot be bought
9. same resource account bulk trade cannot transfer
10. BuyOffer-bound Listing cannot be stolen by another buyer
11. remote purchase is rejected
12. forged/noncanonical arrival is rejected
13. canonical navigation cadence retained
14. market closing during travel blocks purchase
15. partial bulk purchase transfers exact missing quantity only
16. partial bulk purchase decrements Listing quantity/revision correctly
17. physical ingredient purchase transfers the exact canonical Rust item
18. no fake Rust item for bulk resources
19. Wallet conservation holds
20. resource/item conservation holds
21. purchase replay is idempotent
22. save/load after purchase does not repurchase
23. save/load mid-travel cannot preserve forged navigation authority
24. Crafter profession remains Crafter
25. Merchant profession remains separate
26. no second inventory/material/wallet/market/trade/task authority
27. no Math.random
28. no wall-clock Date
29. ER3 demand-driven crafting retained
30. ER2 Raw Producer retained
31. RC4 Merchant Economy retained
32. Adventure / RC2 / RC3.1 / RC3.2 retained

## Candidate E2E

At minimum prove a real loop:

```text
observed product demand
→ ER3 NEEDS_MATERIALS
→ observed Merchant bulk Listing
→ canonical travel
→ partial RC4 purchase
→ Wallet/resource transfer
→ ER3 READY_CRAFT
→ CRAFT_ITEM
→ real physical output
```

Also prove a physical ingredient procurement path where a known recipe lacks one canonical Rust ingredient item.

## Candidate SAT / production gate

Use the same exact-head and post-merge discipline as ER3:
- full npm test PASS;
- ER4 E2E and attacks PASS;
- import-map/cache pins PASS;
- RC4 desktop/mobile PASS;
- Active Observation PASS;
- Adventure PASS;
- Independent smoke PASS;
- RC2 PASS;
- RC3.1 PASS;
- RC3.2 PASS;
- no browser runtime errors.

Then re-check exact head + main drift + mergeability, merge only the verified head, and require exact-main Verify + Pages/public exact bytes and retained public browser gates before declaring **ER4 = PRODUCTION SAT**.
