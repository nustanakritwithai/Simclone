# ER3 — Demand-driven Crafter Success Contract

Status: **ACTIVE CANDIDATE CONTRACT / NOT PRODUCTION SAT**

Date: 2026-09-30  
Production baseline: `c91677d1ae1e08f078fe27a49c20cd6a6dabd087`  
Branch: `feature/er3-demand-driven-crafter-20260930`

UNKNOWN is never PASS. Candidate evidence never substitutes for production evidence.

## Goal

ER3 makes an existing canonical Crafter autonomously manufacture a real physical item because of demand that actor can legally observe.

```text
projectActorObservedDemand()
→ deterministic supported item demand
→ recipe known by this Crafter
→ Crafter/tier permission
→ station/material/reserve/survival gates
→ ordinary CRAFT_ITEM command
→ canonical Rust craft order
→ normal scheduler/work execution
→ physical Rust item instance
```

ER3 ends at production. It does **not** sell output and does **not** buy missing materials. Material procurement is ER4.

## Authority map

### Demand evidence
Owner: `src/economic-demand.mjs` via `projectActorObservedDemand(world, actor)`.

ER3 may consume only a projection with:
- `status === 'SAT'`
- `scope === 'ACTOR_OBSERVED'`
- current validated market knowledge and authority roots.

Hidden, stale, forged or corrupt evidence must not become production pressure.

If demand projection is not SAT, ER3 returns `UNKNOWN`; it must not reinterpret UNKNOWN as zero demand or idle success.

### Recipe knowledge
Owner: `src/craft-recipe-knowledge.mjs`.

Canonical checks are retained through `craftPreview()` / `checkCraft()`, which call:
- `validateRecipeKnowledge()`
- `knowsCraftRecipe()`

ER3 may use recipe metadata to enumerate candidates, but may never grant knowledge.

### Tier qualification
Owner: `src/crafter-tier-policy.mjs` + `src/crafter-career.mjs`.

`craftPreview()` delegates to `crafterTierPermission()`.
Demand never overrides tier evidence.

### Station sufficiency
Owner: Rust station authority through `craftPreview()` / `stationForRecipe()`.

ER3 does not create or teleport stations. A missing station is BLOCKED.

### Material sufficiency
Owners:
- ordinary wood/stone: canonical personal/household resource account reached by `resourceStock()`
- processed materials: `material-economy.mjs`
- physical ingredient items: Rust possession authority.

`craftPreview()` is the canonical read-only sufficiency gate.
`queueCraft()` performs the canonical escrow/consumption.

ER3 must not add/remove materials directly.

### Material reserve
ER3 may retain only already released reserve rules. It may not invent a second reserve ledger or arbitrary floor.

The released Crafter reserve behavior is the existing `CRAFT_TRAINING_RULES` food/wood/stone floors used by current Crafter autonomy. If a demanded recipe would violate those released floors, ER3 returns BLOCKED/NEEDS_MATERIALS and does not dispatch.

### Item creation
Owner: `src/rust-possessions.mjs`.

ER3 never mutates `rustPossessions.items`.
The output item may appear only when canonical `advanceCraft()` completes.

Required output evidence:
- canonical item id
- canonical item kind
- `createdBy === crafter.id`
- `createdTick`
- canonical physical location
- canonical craft/quality provenance.

### Quality
Owner: `craft-outcome.mjs` snapshot captured by `queueCraft()`.

Demand selects **what recipe to attempt**.
ER3 cannot select Masterwork/Exceptional or write stats/quality.

### Task ownership
Owner: existing engine scheduler + Rust pending-order projection.

`queueCraft()` creates the canonical Rust order. `pendingRustWork()` projects that order into the existing scheduler; `decide()` owns task selection and `execute()` owns work progression.

ER3 must not assign `agent.task` directly.

### CRAFT_ITEM commit
Only existing `command(world, 'CRAFT_ITEM', {agentId, recipeId})`
→ `rustCommand()`
→ `queueCraft()`
may commit the craft order/material escrow.

The ER3 policy returns a read-only intent only.

## Legal demand → product mapping

Eligible demand rows must be:
- actor-observed projection rows;
- `unit === 'item'`;
- physical/tradable item demand;
- positive unmet pressure;
- mapped to one or more real `CRAFT_RECIPE_CATALOG` recipes.

Demand ordering is deterministic:
1. `stockShortageQuantity` descending;
2. `shortageQuantity` descending;
3. `liveDemandQuantity` descending;
4. `historicalDemandQuantity` descending;
5. `verifiedTradeCount` descending;
6. `itemKind` ascending.

Recipe ordering for the same item kind is deterministic:
1. known and canonically previewable recipes only;
2. lowest eligible tier first unless demand later gains an explicit tier/quality contract;
3. lower work;
4. recipe id ascending.

A generic item-kind demand must not silently burn high-tier inputs merely because the Crafter can make them.

## Survival and work priority

ER3 is blocked when:
- actor is not a living `crafter`;
- lifecycle cannot perform productive work;
- manual craft training is active;
- Adventure encounter/combat is active;
- an accepted `agent.task` exists;
- a Rust craft/process order already exists;
- complete home/work precondition is absent;
- HP/satiety/energy is below released Crafter work thresholds;
- station/path constraints fail;
- materials or retained reserve rules fail.

Demand never steals protected/current work and never overrides survival emergencies.

## Output stock / duplicate prevention

ER3 must not create another unit when the Crafter already owns sufficient tradable physical stock for the same observed demand.

At minimum, own canonical tradable stock is compared with the actor-observed demand row before a new intent is emitted.

A pending craft order also blocks another craft intent through canonical craft-busy evidence.

Replay of the same state therefore cannot enqueue duplicate production.

## ER4 boundary

If a valid known/eligible recipe exists but real inputs are insufficient, ER3 returns a deterministic `NEEDS_MATERIALS` state containing available canonical missing evidence when exposed by `craftPreview()`.

ER3 does not:
- purchase inputs;
- accept material BuyOffers/Listings;
- mint resources;
- remote-fetch materials;
- create procurement tasks.

That boundary belongs to ER4 Material Procurement.

## UNKNOWN

ER3 returns UNKNOWN rather than PASS/IDLE when authoritative evidence is malformed or cannot be validated, including:
- ER1 demand authority invalid;
- market knowledge invalid;
- recipe evidence corrupt;
- Crafter tier evidence corrupt;
- canonical craft preview returns an authority-evidence failure.

Ordinary legitimate absence of demand is IDLE, not UNKNOWN.

## Replay / save-load continuity

No ER3-owned persistent ledger is introduced.

Replay safety comes from canonical structures:
- one Rust craft order per actor;
- material/item escrow in `queueCraft()`;
- deterministic order/craftSpec;
- canonical completion receipt / recipe mastery;
- output item linked to the completed order.

Acceptance must prove:
- identical state replay does not enqueue a second order;
- save/load with completed output does not duplicate output;
- save/load mid-craft resumes one order and produces one output.

## No second authority proof

Static and runtime tests must prove the ER3 policy contains no:
- item push/write;
- material add/remove;
- Wallet write;
- market Listing/BuyOffer write;
- Trade/Reservation/Ledger commit;
- profession write;
- task assignment;
- recipe knowledge write;
- quality write;
- `Math.random`;
- wall-clock `Date`.

## Required attacks

1. hidden BuyOffer/Listing does not trigger crafting
2. stale observation does not trigger crafting
3. corrupt demand authority returns UNKNOWN
4. unknown recipe cannot craft
5. above-tier recipe cannot craft
6. missing station blocks
7. missing materials returns NEEDS_MATERIALS/BLOCKED without minting
8. retained reserve floor is protected
9. hunger blocks
10. exhaustion blocks
11. current protected work is not stolen
12. policy cannot mint physical item
13. item appears only after real craft completion
14. output has `createdBy = Crafter`
15. quality/provenance comes from canonical craft outcome
16. replay cannot duplicate order/output
17. save/load completed item does not duplicate
18. save/load mid-craft does not duplicate
19. Merchant profession is never overwritten
20. Adventurer profession is never overwritten
21. no Wallet mutation
22. no market mutation
23. no second inventory/material authority
24. no `Math.random`
25. no wall-clock `Date`
26. malformed authority remains UNKNOWN
27. RC4 retained
28. ER2 retained
29. Adventure retained
30. RC2 / RC3.1 / RC3.2 retained

## Candidate SAT gate

ER3 can be **CANDIDATE SAT** only on one exact head with:
- full `npm test` PASS;
- autonomous observed-demand → CRAFT_ITEM → real completed physical item E2E PASS;
- import-map/cache invariant PASS;
- ER2 Raw Producer regression PASS;
- RC4 desktop/mobile PASS;
- Active Observation UI PASS;
- Adventure retained PASS;
- independent browser smoke PASS;
- RC2 Crafting desktop/mobile PASS;
- RC3.1 Blueprint desktop/mobile PASS;
- RC3.2 Iron/Steel desktop/mobile PASS;
- no browser runtime errors.

Then re-check main, merge only the exact verified head, capture merged-main SHA, require exact-main Verify + Pages + HTTP + exact deployed bytes + retained public browser gates before declaring **ER3 = PRODUCTION SAT**.
