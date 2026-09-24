# WM2.2 — Shadow Weighted Route Comparator

This is the final observation gate before weighted routing can be considered for authority.

It computes a deterministic cardinal Dijkstra candidate using integer cost units:
- cost multiplier × 1000
- priority order: (totalCost, nodeId)
- fixed neighbor order
- no diagonal movement
- water remains blocked

The authoritative route is still the existing BFS route. WM2.2 only compares it against the candidate and reports potential terrain-cost savings.

No task, score, path, position, resource, save or history state is mutated.

Promotion rule:
Weighted routing must not become authoritative until WM2 path parity, WM2.1 shadow costs, WM2.2 determinism, Survival Core, lifecycle/history continuity and browser gates all remain SAT.
