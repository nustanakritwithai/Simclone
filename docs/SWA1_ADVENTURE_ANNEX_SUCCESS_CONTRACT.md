---
type: success-contract
project: Simclone
domain: same-world-adventure
feature: SWA1 Adventure Annex Terrain + Migration
status: implementation-candidate
canonical: true
owner: Project Brain + Integration Lead
validation: UNKNOWN
last_reviewed: 2026-09-27
---

# SWA1 — Adventure Annex Terrain + Safe Migration

## Goal

Turn the released 60×52 Core into one physical 84×52 world by appending a deterministic 24×52 Adventure Annex at x=60..83, while preserving the released Core state and WorldSim evidence.

## Runtime boundaries

- Physical map authority: `same-world = 84×52`
- Core compatibility/reference: `large = 60×52`
- Core cells: x=0..59, y=0..51
- Annex cells: x=60..83, y=0..51
- z1: x=60..65
- z2: x=66..71
- z3: x=72..77
- z4: x=78..83

There is one tile array, one coordinate system and one path authority.

## Core isolation

SWA1 must not make ordinary Simclone autonomy consume the Annex.

Until later Adventure gates:
- Independent spawn searches Core only.
- Autonomous generic EXPLORE waypoints search Core only.
- Autonomous personal-home search stays in Core.
- K6 resource nodes remain Core-only.
- WorldSim Core regional/ecology evidence uses the released 60×52 reference domain.

Physical pathfinding still uses all 84×52 so explicit Adventure tasks can walk into the Annex.

## Annex terrain

Terrain is pure and deterministic from:
- world seed
- x/y
- zone band

A continuous east-west path corridor crosses z1→z4. Water obstacles may exist off the corridor. No ordinary K6 nodes are generated in the Annex during SWA1.

## Migration

Released explicit `large` saves are valid input.

Migration:
1. preserves every old Core row x=0..59;
2. appends x=60..83 to that row;
3. preserves all existing entity coordinates;
4. changes only the physical bounds profile plus Annex metadata/tiles;
5. is idempotent on repeated save/load.

## Acceptance

1. `large` remains exactly 60×52.
2. `same-world` is exactly 84×52.
3. Fresh Same-World Core projection equals a fresh Large reference for the same seed.
4. Existing Large save migrates row-by-row with zero Core tile relocation.
5. Same-World save/load is byte-stable after migration.
6. Core WorldSim map/ecology cell evidence matches Large reference.
7. Core WM4.7 regeneration results match Large reference.
8. Annex has no ordinary resource nodes.
9. z1–z4 occupy x60–83 exactly.
10. Simclone path authority can reach the Annex corridor without teleport.
11. Existing Adventure zone entry resolves into Annex on Same-World.
12. Generic autonomy remains Core-bounded.
13. No Math.random / wall-clock gameplay rule.
14. Exact-head CI must be SUCCESS.
15. UNKNOWN is never PASS.
