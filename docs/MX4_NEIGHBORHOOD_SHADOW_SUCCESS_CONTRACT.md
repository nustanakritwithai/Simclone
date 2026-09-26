---
type: success-contract
project: Simclone
domain: emergent-society
feature: MX4 Neighborhood Emergence Shadow
status: implementation-candidate
canonical: true
owner: Project Brain
validation: candidate
last_reviewed: 2026-09-26
---

# MX4 — Neighborhood Emergence Shadow

## Goal

Detect when independent completed Household homes have formed a spatial neighborhood without prematurely creating a Settlement, faction, market or governance authority.

MX4 is observation only.

## Inputs

MX4 reads existing authorities:

- completed personal/household homes;
- Household membership;
- active residents;
- owner-to-owner relationship evidence;
- MX2 region identity;
- physical world coordinates.

It does not create new evidence.

## Spatial rule

Completed Household homes are connected when their Manhattan distance is at most 12 cells.

Connected components with at least two households are projected as Neighborhoods.

Connectivity is transitive:

```
A near B
B near C
→ A/B/C may form one spatial neighborhood
```

even when A and C are farther than the direct link threshold.

## Social evidence

Spatial membership and social cohesion are deliberately separate.

A Neighborhood may physically exist before owners trust each other.

Owner pairs expose social-link evidence only when an existing directional relationship has at least:

- trust >= 2
- affinity >= 1

in either direction.

MX4 reports social density and relationship evidence counts but never mutates those relationships.

## Authority boundary

MX4 must not:

- write Household membership;
- recruit followers;
- perform trade;
- transfer resources;
- create a Settlement;
- create a market;
- create leadership;
- mutate relationship scores;
- create save fields.

This keeps MX4 compatible with the in-flight IC7 recruitment/trade work.

## Acceptance

1. Projection is deterministic and read-only.
2. No save fields are added.
3. Only completed Household homes participate.
4. Two nearby Household homes form one neighborhood.
5. Distant homes remain isolated.
6. Connectivity is transitive.
7. Relationship evidence changes cohesion but not spatial membership.
8. No social relationship is invented from proximity.
9. No Settlement/faction/market authority is created.
10. UNKNOWN is never PASS.

## Promotion path

After MX4 is SAT and IC7 recruitment/trade is released, a later gate may derive Community evidence from:

```
Neighborhood
+ repeated cooperation
+ physical trade
+ relationship continuity
+ multi-household persistence
```

Settlement authority must remain a later explicit promotion gate.
