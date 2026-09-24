# WM2 — WorldSim Path Authority Gate 1

WM1 put the WorldSim-inspired physical map on the live page while K6 still owned gameplay.

WM2 moves exactly one authority boundary:

```
walkable / path topology
Simclone K6 -> WorldSim WM2
```

## Deliberate no-drift rule

Gate 1 preserves the existing topology exactly:
- gameplay water -> blocked
- bridge -> walkable
- path -> walkable
- grass/visual forest/rock/sand -> walkable

No movement-cost differences are introduced yet.

This lets WorldSim become the owner of path walkability without changing birth pacing, survival economics, archive timing, resource placement, saves, or task scoring.

## Still owned by K6
- resource placement and regeneration
- stock/economy
- BUILD placement rules
- movement speed/cost
- save schema

## Next gate
WM2.1 may add shadow movement costs for forest/rock/sand first. Only after parity/performance evidence should weighted routing become authoritative.
