# WM2.1 — Shadow Movement Cost

This phase does **not** change pathfinding.

It adds a read-only candidate cost model over the WorldSim presentation terrain:

- bridge 0.85
- path 0.90
- grass 1.00
- sand 1.15
- forest 1.25
- rock 1.45
- deep/shallow water blocked

These are Simclone integration candidate multipliers, not claimed as exact constants from Living World 20.9.4.

Purpose:
1. measure how existing routes cross visual terrain;
2. prove observation is read-only and deterministic;
3. estimate continuity impact before weighted routing becomes authoritative.

Authority remains:
- walkability: WorldSim WM2
- route choice/distance: existing BFS
- resource placement: K6
- movement speed: K6
- save schema: K6

Next gate may introduce deterministic weighted routing only after WM2 and WM2.1 verification stay green.
