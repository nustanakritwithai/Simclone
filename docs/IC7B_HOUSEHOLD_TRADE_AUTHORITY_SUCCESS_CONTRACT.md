---
type: success-contract
project: Simclone
domain: simulation
feature: IC7B Household Trade Authority
status: active
canonical: true
owner: Project Brain
validation: implementation-candidate
last_reviewed: 2026-09-26
---

# IC7B — Household Trade Authority

## Goal

Turn Household Trade shadow opportunities into real, conserved, physical delivery without a central market or currency.

```text
source household surplus
→ relationship-backed trade acceptance
→ atomic cargo reservation
→ carrier travels through normal navigation
→ delivery into destination household store
→ conservation proof
→ trust/debt evidence
```

## Reused authorities

- opportunity: `householdTradeOpportunities()`
- household membership: existing Household projection
- resource writer: `resourceStock()`
- movement/pathing: existing agent task/path system
- relationship writer: `recordRelationshipEvidence()`

## Contract state

Independent worlds gain one bounded trade extension:

`householdTrade.contracts[]`

A contract stores:
- origin/destination house + owner ids
- carrier id
- good
- quantity
- cargoQuantity
- status: `in-transit | completed | stranded`
- created/completed ticks
- stranded location when carrier dies

Cargo is **real material in transit**, not duplicated metadata.

## Acceptance gate

A contract may start only when:
- a current read-only trade opportunity exists;
- origin and destination owners have reciprocal social evidence:
  each direction must have Trust >= 2 or Affinity >= 2;
- origin has a living productive carrier from its household;
- carrier has no other in-transit trade;
- origin stock still has the proposed quantity.

Start is atomic:
- subtract quantity once from source Household store;
- create one in-transit cargo contract;
- never subtract again at delivery.

## Delivery

Carrier uses `TRADE_DELIVERY` task through the normal path system.
At destination:
- destination store receives cargo once;
- cargoQuantity becomes zero;
- contract becomes completed;
- origin → destination Trust +1;
- destination → origin Trust +1, Affinity +1, Debt + bounded quantity signal.

## Carrier death

Cargo never disappears.
If carrier dies before delivery:
- contract becomes `stranded`;
- cargo quantity remains conserved;
- death x/y are retained for future recovery.
IC7B does not yet implement recovery.

## Aggregate totals

`materialTotals()` must include in-transit and stranded cargo so world totals remain conserved while goods are outside a house.

## Automatic planning

Every 120 ticks, at most one relationship-backed trade opportunity may start automatically.

No randomness.

## Explicit exclusions

- no money/currency;
- no central market;
- no teleport delivery;
- no faction/settlement market;
- no stranded-cargo recovery yet;
- no debt settlement yet.

## Acceptance

1. No relationship → no contract.
2. Surplus + reciprocal relationship → contract can start.
3. Start subtracts source once and creates equal cargo.
4. Aggregate world total is unchanged at contract start.
5. Carrier uses normal path movement toward destination home.
6. Delivery adds destination once and empties cargo.
7. Completed contract cannot deliver twice.
8. Successful delivery writes bounded Trust/Affinity/Debt evidence.
9. Carrier death strands cargo without losing world total.
10. Save/load preserves active and stranded cargo deterministically.
11. At most one automatic contract starts per 120-tick cycle.
12. Legacy mode unchanged.
13. Existing WM4.8, IC6C and IC7A regressions remain SAT.

UNKNOWN is never PASS.
