---
type: success-contract
project: Simclone
domain: simulation-performance
feature: MX3 Route Cache + Smart Home Site
status: implementation-candidate
canonical: true
owner: Project Brain
validation: candidate
last_reviewed: 2026-09-26
---

# MX3 — Route Cache + Knowledge-Bounded Smart Home Site

## Goal

Make the 60×52 Regional World cheaper to navigate and make first-home placement respond to meaningful local evidence without giving Clones hidden-world omniscience.

## MX3A — Route Cache

The current Survival router remains the path authority and still uses the same cardinal BFS.

MX3A only caches completed route fields by:

- state identity;
- tile-array identity;
- world bounds;
- start cell.

The cache:

- lives in an external WeakMap;
- is never serialized;
- is capped at 64 route fields per world;
- uses deterministic LRU-style eviction;
- returns the exact same distance/parent arrays that uncached BFS would produce.

Runtime terrain topology is currently immutable after world creation. A future terrain-mutation authority must explicitly invalidate this cache.

## MX3B — Smart Home Site

Only new/unfinished home selection in the **Large World** uses scoring.

Legacy 30×26 home-site behavior remains the historical first-legal-site scan.

A Clone may score candidate sites from:

1. travel distance from its current position;
2. resource locations already present in its personal knowledge/beliefs;
3. resources currently visible within the existing observation range;
4. locally observable regional terrain;
5. locally observable adjacent water risk.

It must not use:

- remote node amounts the Clone has never observed;
- global WM4.8 zone membership as secret knowledge;
- hidden Household/relationship locations;
- IC7 recruitment/trade state;
- future flood/weather facts not locally evidenced.

### Initial scoring

- shorter travel is preferred;
- known Food access has the strongest resource weight;
- known Wood is second;
- known Stone is lower;
- grassland is mildly favorable;
- woodland is mildly favorable;
- wetland/riverlands receive local water-risk penalties;
- adjacent water receives an explicit penalty.

Once `homePlan` exists, it remains sticky while legal. MX3B does not continuously move the planned home.

## Authority boundary

MX3 does not:

- change path topology;
- change resource ownership;
- change WorldSim resource regeneration;
- mutate knowledge to justify a decision;
- create a hidden map-memory system;
- touch IC7 recruitment/trade authority.

## Acceptance

1. Cached route fields equal uncached BFS exactly.
2. Repeated same-start routing produces cache hits.
3. Cache stays within 64 entries.
4. Cache use does not change serialized state.
5. Hidden remote resource nodes do not change home-site evidence.
6. An existing belief/visible resource may change home-site evidence.
7. Smart site selection is deterministic and read-only.
8. Existing legal `homePlan` remains sticky.
9. Legacy 30×26 selection semantics remain unchanged.
10. Full unit/browser/120-year continuity must remain SAT.
11. UNKNOWN is never PASS.

## Deferred

- IC7 relationship-aware neighborhood preference;
- global resource-zone awareness learned through exploration/maps;
- flood/weather-aware home relocation;
- hierarchical routing beyond the bounded BFS cache;
- dynamic terrain mutation cache invalidation.
