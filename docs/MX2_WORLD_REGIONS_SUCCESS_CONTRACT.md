---
type: success-contract
project: Simclone
domain: world-generation
feature: MX2 World Regions
status: implementation-candidate
canonical: true
owner: Project Brain
validation: candidate
last_reviewed: 2026-09-26
---

# MX2 — World Generation 2.0 / Regional World

## Goal

Make the released 60×52 Large World spatially meaningful instead of only larger.

The world must contain deterministic ecological regions that influence both:
1. where new Food/Wood/Stone nodes are generated; and
2. how WorldSim presents terrain.

The region layer is pure derived evidence, not a second mutable world state.

## Regional families

- riverlands
- wetland
- grassland
- woodland
- uplands
- stone-ridge

Each cell's region comes from:

```
seed
+ normalized world coordinates
+ deterministic smooth noise
+ shared river corridor
→ region evidence
```

No Math.random, Date, wall clock or external service is allowed.

## Resource specialization

Each region owns a bounded generation profile.

Examples:

- woodland strongly favors Wood;
- stone-ridge strongly favors Stone;
- grassland favors Food;
- wetland favors Food/Wood;
- riverlands is low-density but food-favorable;
- uplands favors Stone.

The policy determines initial node generation only. WM4.7 remains the regeneration writer after the world exists.

## Authority

### MX2 owns

- pure region classification;
- large-world river center function;
- initial large-world regional resource decision.

### MX2 does not own

- runtime resource amount mutation;
- harvest pressure;
- household inventory;
- trade;
- Clone decisions;
- save migration;
- settlement generation.

WorldSim presentation may read the same region evidence but cannot mutate it.

## Compatibility

Legacy 30×26 worlds keep their historical generation path exactly.

MX2 applies regional resource generation only to the `large` profile.

Existing Large World saves remain valid because regions are derived from seed + bounds and no new save ledger is introduced.

## Acceptance

1. 60×52 region projection contains exactly 3,120 cells.
2. Same seed/bounds produce identical region bytes.
3. Different seeds produce different regional layouts.
4. At least four region families occur in the reference large-world proof seed.
5. Regional policies are normalized and specialized.
6. Every initial large-world resource node exactly matches the shared regional decision function.
7. Blocked water/path/bridge cells never receive an initial regional node.
8. WorldSim cell region identity exactly matches the generator's region identity.
9. WorldSim region observation is read-only.
10. Legacy 30×26 generation stays deterministic and has no new persisted bounds/region ledger.
11. WM4.7 remains the resource-regeneration writer.
12. UNKNOWN is never PASS.

## Deferred

- resource-node relocation of old saves;
- dynamic biome migration;
- fire/erosion/nutrient mutation;
- home-site scoring from regions;
- regional pathfinding cache;
- neighborhood/settlement emergence.

These are later gates after MX2 regional generation is SAT.
