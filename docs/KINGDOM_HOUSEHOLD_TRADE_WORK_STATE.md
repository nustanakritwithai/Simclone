# Kingdom Household Trade Work State

Status: PREPARED / STACKED AFTER ORGANIZATION SHADOW  
Branch: `feature/kingdom-household-trade-shadow-prep`  
Base dependency: `feature/kingdom-organization-shadow-prep` / PR #97  
Contract: `docs/KINGDOM_HOUSEHOLD_TRADE_SUCCESS_CONTRACT.md`

## Goal

Adapt Kingdom MarketTradeSystem / Logistics trade-contract semantics to household scope without enabling stock mutation yet.

## Prepared

- `src/kingdom-household-trade.mjs`
  - `householdTradeOpportunities()`
  - `bestHouseholdTradeOpportunity()`
- sources:
  - K2 household demand/scarcity;
  - K6 household shadow prices;
  - completed house physical positions;
- opportunity requires:
  - source stock above current household demand;
  - destination shortage below current demand;
  - source scarcity < 1;
  - destination scarcity > 1.2;
- quantity bounded by source surplus, destination deficit and 12-unit shadow cap;
- distance is a deterministic ranking penalty;
- no stock/currency/cargo/relationship write.

## Authored proof

`tests/kingdom-household-trade.test.mjs` covers:
- real surplus → scarcity opportunity;
- no surplus/no deficit suppression;
- quantity conservation bounds;
- distance ranking;
- byte-read-only evaluation;
- save/load deterministic ordering;
- no settlement/market/trade-contract state created.

## Future activation

After #95 + #97 SAT:

```text
opportunity
→ participant decision
→ explicit contract
→ reserve cargo atomically
→ physical movement
→ delivery
→ conservation proof
→ relationship / debt evidence
```

No disappearing cargo and no central settlement market authority.

UNKNOWN is not PASS.
