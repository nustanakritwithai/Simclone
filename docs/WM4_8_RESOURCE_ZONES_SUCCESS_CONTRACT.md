---
type: success-contract
project: Simclone
domain: world-simulation
feature: WM4.8 Resource Zones
status: implementation-candidate
canonical: true
owner: Project Brain
validation: candidate
last_reviewed: 2026-09-26
---

# WM4.8 — Ecological Resource Zones

## Goal

Turn per-cell WorldSim resource suitability into stable, explainable spatial zones that later systems can use for placement and settlement reasoning without moving resource authority yet.

## Inputs

WM4.8 reads the existing WorldSim chain only:

```
terrain
→ climate
→ soil
→ hydrology
→ vegetation
→ resource suitability
→ WM4.8 zones
```

No new physical reservoir is created.

## Zone rule

For each resource family independently:

- Food
- Wood
- Stone

WM4.8 derives a deterministic threshold from the upper ecology distribution, bounded by a resource-specific absolute floor. Qualifying cells are grouped with **cardinal-4 connectivity**.

Zones of different resource types may overlap because one physical cell can support more than one ecological resource potential.

Each zone exposes:

- stable id from resource type + smallest cell index;
- member cell indices;
- anchor / centroid;
- threshold;
- average / maximum suitability;
- canonical resource node ids currently inside the zone;
- current/max amount summary;
- average depletion / harvest pressure.

## Authority boundary

WM4.8 is shadow-only.

It does not:

- create resource nodes;
- move existing nodes;
- change node amount/max;
- alter gathering decisions;
- change pathfinding;
- create save fields;
- become a second resource writer.

The active resource writer remains WM4.7.

## Acceptance

1. Same state produces byte-identical zone projection.
2. Projection does not mutate serialized world state.
3. Every member cell passes its resource threshold.
4. Every zone is cardinally contiguous.
5. A cell belongs to at most one zone of the same resource type.
6. Water cannot enter Food/Wood/Stone zones.
7. Zoned + unzoned canonical node counts equal canonical node count.
8. Zone geometry is independent of current node amount.
9. Depletion summaries react to canonical node amount.
10. No save schema, node placement or writer authority is added.
11. UNKNOWN is never PASS.

## Next promotion gate

A later authority gate may use proven zones to influence deterministic **new node placement / relocation**, but only after conservation, old-save continuity, starter-resource guarantees and node-count bounds are specified.
