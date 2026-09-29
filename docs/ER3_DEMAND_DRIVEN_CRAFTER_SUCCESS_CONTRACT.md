# ER3 — Demand-driven Crafter Success Contract

Status: **STACKED DRAFT / NOT MERGEABLE TO MAIN YET**.

Parent dependency: PR #211 current repaired ER0/ER1 head.
UNKNOWN never passes.

## Goal

Move Crafter autonomy from progression-only behavior toward real economic production:

```text
ER1 actor-observed demand
→ choose supported product
→ use existing recipe / knowledge / tier permission
→ verify real materials + station + reserve
→ ordinary CRAFT_ITEM intent
→ physical quality item
→ existing Merchant procurement when an observed BuyOffer exists
```

This slice does not implement ER4 material acquisition and does not create a new Merchant path.

## Demand authority

ER3 consumes only `projectActorObservedDemand()`.

It must not rescan global demand with a private definition.

Supported demand includes what ER1 can actually evidence:
- nearby productive tool need;
- nearby supported Adventurer Weapon/Armor need;
- observed funded BuyOffer;
- bounded recent verified-trade demand.

Distant/unobserved demand remains hidden.

## Product selection

Demand rows are ordered deterministically by:
1. actor stock shortage;
2. visible market shortage;
3. live demand;
4. recent historical demand;
5. verified trade count;
6. item kind.

A generic item-kind demand deliberately selects the **lowest valid known recipe tier** that satisfies the item kind.

Reason: current BuyOffer/Need contracts do not express required quality/tier. Generic demand must not silently burn T5 Steel.

Future quality-aware demand requires a new explicit contract.

## Stock-before-production

If the Crafter already owns tradable physical stock for the demanded kind:
- a current observed BuyOffer may produce `RC4_ACCEPT_BUY_OFFER`;
- otherwise ER3 waits with `stock-awaiting-procurement`;
- it does not craft another copy merely because demand remains visible.

An existing open Producer procurement Listing also blocks additional supply.

## ER4 handoff

When the selected recipe is legitimate but real inputs are missing, ER3 returns:

- `status: NEEDS_MATERIALS`
- exact `recipeId`
- known missing material/item quantities where the canonical craft preview exposes them
- `procurementRequired: true`

ER3 itself does not buy, gather or mint those inputs.

That status is the contract boundary for ER4.

## Authority locks

ER3 may:
- read ER1;
- read recipe knowledge and Crafter tier permission through existing craft preview;
- read real Rust possessions;
- read observed BuyOffers/Home Markets;
- propose `CRAFT_ITEM`;
- propose `RC4_ACCEPT_BUY_OFFER`.

ER3 may not:
- mutate resources during evaluation;
- create/move item instances;
- create Listing/BuyOffer directly;
- choose or write Merchant price;
- debit/credit Wallet;
- commit Trade/Reservation/Ledger;
- change profession/mastery;
- assign a movement/task directly;
- bypass survival/housing/current-work constraints.

## Acceptance

The stacked tests must prove:
- nearby ER1 demand can create a read-only CRAFT_ITEM intent;
- intent uses ordinary craft authority;
- real completed craft creates exact physical stock;
- that stock stops duplicate production;
- observed BuyOffer causes stock-first sell intent;
- sell intent contains no Producer-controlled price;
- dispatch remains existing RC4 procurement Listing path;
- missing inputs become explicit ER4 handoff;
- generic demand selects lowest valid tier;
- non-Crafter/survival/manual/adventure/current work blocks;
- policy source has no economic writer.

## Integration rule

Do not merge this branch before parent PR #211 exact-head SAT.

After the parent is accepted, rebuild/promote this policy on the then-current main, pin any production `src/**` module, wire it through the existing command dispatcher, and run retained RC2/RC3/RC4/RC5/Adventure/public gates.

UNKNOWN is never PASS.
