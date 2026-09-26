# IC7B — Household Cooperation Success Contract

Status: FROZEN FOR IMPLEMENTATION
Base: `main@e0308619c2c082de6c0a8d8a7a99ec25d92c97ab`

## Goal

A real Independent household must react to its own shared raw-resource shortages through the existing autonomous candidate scorer:

```
Household resource account
→ K2 scarcity
→ K3 production/labor gap
→ K4 labor offer
→ bounded household cooperation score
→ existing candidate ranking
→ existing task/reservation/path/execution authority
```

No second scheduler, task queue, stock ledger, profession registry, membership registry or resource writer is allowed.

## Scope

Productive members of an existing household, including the owner and explicit adult cohabitants, may receive a deterministic score bonus for:
- Food shortage → FORAGE
- Wood shortage → WOODCUT
- Stone shortage → MINE

The signal is read-only and derives from `householdEconomySnapshot()`, therefore from the existing household `resourceStock()`, K2 scarcity, K3 production and K4 labor offers.

## Safety / precedence

- Survival emergency remains stronger: hungry/exhausted actors receive zero IC7B cooperation bonus.
- Children/non-productive actors receive zero bonus.
- Homeless/non-household actors receive zero bonus.
- Legacy mode receives zero bonus.
- BUILD is not part of IC7B; construction coordination is deferred.
- IC7B never writes stock, membership, profession, relationships, tasks or reservations directly.
- The existing `candidates() → decide() → claim() → execute()` path remains the only executor.
- Existing IC7A contribution evidence remains the only IC7 social writer for productive household work.
- No randomness, Date/time, DOM, LLM or external API may affect the signal.

## Deterministic scoring

IC7B uses the matching K4 labor offer urgency:
- normal → at least +12
- high → at least +24
- critical → +36 maximum

The final bonus is bounded at 36 and cannot apply during a survival emergency.

## Acceptance

1. Food-poor household exposes active FORAGE cooperation signal.
2. Wood-poor household exposes active WOODCUT cooperation signal.
3. Stone-poor household exposes active MINE cooperation signal.
4. Adequate household stock yields no signal for that good.
5. Homeless/non-household actor yields no signal.
6. Hungry/exhausted actor yields no signal.
7. Signal call is read-only: serialized state bytes do not change.
8. Engine trace includes `factors.householdCooperation` only when active.
9. A food-poor household can make an otherwise healthy adult member select FORAGE through the existing scorer, with no direct task write from IC7B.
10. Existing score invariant remains exact: `score === sum(factors)`.
11. Save/load continuation remains byte-deterministic.
12. Legacy behavior remains unchanged.
13. IC7A recruitment/contribution, MX3 route/home, MX4 neighborhood, WM4.8 ecology, housing, lifecycle and browser smoke regressions remain SAT.

UNKNOWN is not PASS.
