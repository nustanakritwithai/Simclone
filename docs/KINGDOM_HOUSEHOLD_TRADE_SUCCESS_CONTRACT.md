---
type: success-contract
project: Simclone
domain: simulation
feature: Kingdom Household Trade Shadow
status: active
canonical: true
owner: Project Brain
validation: preparation-candidate
last_reviewed: 2026-09-26
---

# Kingdom Household Trade Shadow

Donor: `nustanakritwithai/Kingdom-sandbox`

## Goal

Adapt Kingdom MarketTradeSystem / Logistics semantics to independent household economies before enabling any trade mutation.

Trade must emerge from real household conditions:

```text
Household A surplus
+ Household B scarcity
+ price/scarcity gap
+ physical distance
→ trade opportunity
```

No central market authority exists yet.

## Donor semantics reused

Kingdom trade contracts require:
- an origin with available/exportable stock;
- a destination with real demand;
- quantity;
- reward/value signal;
- route/risk context;
- explicit contract acceptance before stock moves.

Simclone shadow adapts those semantics to houses.

## Household trade opportunity

For each pair of completed household economies and each good in:
- food
- wood
- stone

derive:

- originHouseId / destinationHouseId
- originOwnerId / destinationOwnerId
- good
- exportableSurplus
- destinationDeficit
- quantity
- source/destination scarcity
- source/destination shadow price
- priceGap
- Manhattan house distance
- score
- authoritative: false

### Shadow surplus/deficit policy

This is a **proposal formula**, not final balance authority.

- origin exportable surplus = stock above one current K2 household demand unit;
- destination deficit = demand minus current stock;
- opportunity requires source scarcity < 1 and destination scarcity > 1.2;
- quantity is bounded by source surplus, destination deficit and a 12-unit shadow cap;
- shorter distance and larger scarcity/price gaps rank higher.

No resource is reserved or removed.

## Explicit exclusions

The shadow does not:
- move Food/Wood/Stone;
- create currency;
- create cargo;
- assign a trader;
- change relationship/debt;
- create roads/routes;
- create a persistent contract id;
- create a market/settlement entity.

## Future authoritative gate

After household economy + recruitment/cooperation are SAT:

```text
trade opportunity
→ participant decision
→ atomic transfer contract
→ cargo / movement
→ delivery
→ conservation proof
→ relationship/debt evidence
```

A failed/abandoned contract must have an explicit material state; no disappearing stock.

## Acceptance

1. Surplus household can produce an opportunity for a scarce household.
2. No source surplus means no opportunity.
3. No destination shortage means no opportunity.
4. Quantity never exceeds source surplus, destination deficit or cap.
5. Distance affects ranking deterministically.
6. Shadow evaluation never mutates stock/state.
7. Save/load recomputes identical opportunity ordering.
8. No world/settlement market state is created.

UNKNOWN is never PASS.
