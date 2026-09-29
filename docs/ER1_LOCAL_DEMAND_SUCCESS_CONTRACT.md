# ER1 — Actor-Observed Local Demand Success Contract

Status vocabulary: **SAT / VIOL / UNKNOWN**. UNKNOWN never passes.

Baseline inspected before this candidate: `main@973a9609b58a94bb5bb634b020129267155cf12c`.

## Goal

Create one read-only demand projection that later Producer, Crafter, Merchant, Adventurer and Career policies can consume without inventing separate meanings of demand.

The projection is **actor-scoped**. It is not a new world-truth ledger and it owns no economic mutation.

## Inputs

ER1 may read:

- the actor's existing RC4 observed Home Markets;
- observed BuyOffers;
- observed Listings;
- canonical current market state only to invalidate stale observations;
- canonical physical ownership to reject ghost Listing supply;
- canonical Wallet balance to reject unfunded BuyOffer demand;
- canonical verified Trade + Wallet + Reservation evidence as bounded recent demand history;
- existing personal productive-tool needs;
- supported nearby item/equipment needs visible inside the existing knowledge share range;
- existing personal / household food/wood/stone targets and stock.

No unsupported Medicine/Food item is invented merely to make the economy look complete. Those consumption contracts remain later work.

## Knowledge lock

A market row contributes only when:

1. the actor actually observed it;
2. the observation is within deterministic TTL;
3. the current canonical record still matches the observed identity/revision/status;
4. the Home Market is currently open.

World truth may be used to reject an observation that has become stale/invalid. It may not refresh the actor with an unobserved current price, quantity or market.

A nearby person's current tool/equipment shortage may count only inside the existing `withinKnowledgeRange()` boundary. A distant person's need is hidden.

Hidden market rows never enter the projection.

## Demand semantics

Current explicit demand comes from observed funded BuyOffers and supported directly observed item needs.

Recent verified trade contributes **historical demand evidence** using the canonical Reservation terminal tick. It expires after the same deterministic TTL.

Historical trade does not add another duplicate unit on top of the same live need. Effective demand is bounded by:

`max(live demand, recent verified historical demand)`

This lets a real sale seed a restock signal without turning every receipt into permanent infinite demand.

## Supply and stock semantics

Observed Listing supply counts only while:

- the Listing is still canonical OPEN;
- the actor's observed revision/status still matches;
- its Home Market is OPEN;
- the exact physical Rust item is still tradable from the seller.

The signal also reports the observing actor's real tradable physical stock and the resulting stock shortage. It does not invent a Merchant target stock level.

## Bulk resource boundary

Food, wood and stone household shortages are projected from the existing resource authority.

Under ER0 they are intentionally emitted as:

- `unit: bulk-resource`
- `representation: resource-counter`
- `tradable: false`

This exposes real scarcity without falsely claiming that the released item-instance Trade Kernel can settle it.

## Signal fields

A signal includes:

- item/resource kind and unit;
- representation and whether it is currently tradable;
- live demand quantity;
- recent historical demand quantity;
- effective demand quantity;
- visible supply quantity;
- shortage quantity;
- observer-owned physical stock quantity;
- stock-shortage quantity;
- verified trade count/quantity;
- observed/expiry tick;
- market IDs;
- explicit source/evidence rows;
- `actionable`, true only for a currently tradable shortage.

## Authority lock

`economic-demand.mjs` may not:

- create or transfer items;
- debit/credit money;
- create/alter Listing or BuyOffer;
- reserve or commit a trade;
- change profession;
- assign tasks;
- write demand back into the world;
- expose distant or unobserved global prices/supply.

Existing resource helpers that may repair legacy household shape are invoked only on a cloned shadow state so the projection remains byte-read-only.

If any canonical root or the actor's market knowledge is corrupt, projection result is `UNKNOWN`, never an empty SAT that hides corruption.

## Acceptance

Exact-head tests must prove:

1. ER0 bulk resource counters are not silently materialized as Rust item instances;
2. household shortages are read-only and marked non-tradable;
3. nearby supported tool/equipment needs are visible while distant needs are hidden;
4. observed funded BuyOffer contributes demand;
5. observed physical Listing contributes supply;
6. hidden global offers do not leak;
7. ghost physical Listing does not count as supply;
8. expired observations disappear rather than self-refresh;
9. canonical verified trade contributes bounded historical demand without additive double counting;
10. corrupt authority root => UNKNOWN;
11. projection byte-does-not-mutate the world;
12. source contains no item/money/market/task/profession writer.

## Dependency

ER2/ER3/ER5/ER8 must consume this ER1 contract instead of implementing separate demand scoring.

Raw Producer paid market sale remains blocked by the ER0 bulk-settlement boundary until a later canonical bulk settlement extension is proven.

UNKNOWN never passes.
