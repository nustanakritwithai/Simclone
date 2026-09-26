# IC7B — Household Trade Authority Work State

Status: IMPLEMENTATION CANDIDATE / STACKED ON IC7A  
Branch: `feature/ic7b-household-trade-authority`  
Base dependency: `feature/ic7a-household-recruitment-authority` / PR #101  
Contract: `docs/IC7B_HOUSEHOLD_TRADE_AUTHORITY_SUCCESS_CONTRACT.md`

## Implemented

- bounded `householdTrade` extension for Independent worlds;
- relationship-backed start gate using current Household Trade shadow;
- atomic source reservation into real in-transit cargo;
- cargo counted by `materialTotals()` so world conservation remains exact;
- `TRADE_DELIVERY` uses normal path/task movement;
- delivery writes destination household stock exactly once;
- completed contract cannot redeliver;
- successful delivery writes reciprocal Trust and destination Debt evidence;
- carrier death changes cargo to `stranded` at death coordinates instead of deleting resources;
- automatic trade planning runs every 120 ticks, max one new usable contract per cycle;
- Personal Planning ignores trade delivery as a long-term goal;
- legacy mode remains outside this authority.

## Visible gameplay

House UI shows:
- current best Household trade opportunity; or
- active in-transit cargo between house ids.

## Authored proof

- no relationship → no contract;
- atomic source subtraction + equal cargo;
- aggregate conservation while cargo is in transit;
- physical path movement and destination delivery;
- no double delivery;
- Trust/Affinity/Debt evidence;
- carrier-death stranded cargo conservation;
- save/load deterministic active cargo;
- bounded automatic planner cadence;
- legacy isolation;
- browser trade-opportunity fixture.

## Deferred

- stranded cargo recovery;
- debt repayment / barter settlement;
- money/currency;
- route danger/escort;
- persistent market hubs;
- faction/settlement trade authority.

UNKNOWN is not PASS.
