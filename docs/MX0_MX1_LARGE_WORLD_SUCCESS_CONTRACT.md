---
type: success-contract
project: Simclone
domain: simulation
feature: MX0 Dynamic Bounds + MX1 Large World
status: implementation-candidate
canonical: true
owner: Project Brain
validation: candidate
last_reviewed: 2026-09-26
---

# MX0 / MX1 — Dynamic World Bounds + Large World 60×52

## Goal

Expand new Simclone worlds from 30×26 (780 cells) to 60×52 (3,120 cells) without silently resizing historical saves or creating separate map authorities.

## Profiles

### Legacy

- 30×26
- old saves omit `worldBounds`
- omission always resolves to the historical 30×26 contract
- generation and serialization remain backward compatible

### Large

- 60×52
- explicit persisted `worldBounds`
- new public fresh worlds select this profile
- 4× the cell area of the legacy grid

## One bounds authority

Runtime dimensions must flow from `src/world-bounds.mjs`.

Consumers include:

- engine validation/generation
- survival BFS/path indexing
- WorldSim map + climate + resource ecology
- WM4.7 regeneration indexing
- WM4.8 resource zones
- Rust placement/socket bounds
- Independent spawn/home search
- renderer
- minimap/navigation

Legacy constants remain only as compatibility defaults for old fixtures/APIs.

## Generation

Large-world generation scales the historical river/camp/road landmarks in normalized space.

Resource density is intentionally not multiplied 4×. Large profile uses a lower per-cell spawn rate so map area can grow before node count/AI search cost grows at the same rate.

## Save rule

No old save is stretched, relocated or upgraded to 60×52 implicitly.

```
missing worldBounds
→ legacy 30×26

explicit MX0 large worldBounds
→ 60×52
```

## Acceptance

1. Legacy fresh state stays 780 cells and omits `worldBounds`.
2. Legacy save/load is byte-stable.
3. Large fresh state has exactly 3,120 cells.
4. Large independent start creates all six initial Clones legally.
5. Large same-seed generation is byte-deterministic.
6. Large save/load + continuation is byte-deterministic.
7. WorldSim view and WM4.8 zones use 60×52 dimensions.
8. Survival route field allocates 3,120 cells.
9. Rust placement can validate legal cells beyond x=29.
10. Renderer/minimap use runtime dimensions.
11. No Math.random, Date/wall-clock simulation or second map authority.
12. Exact candidate CI must be SAT before merge.
13. Exact-main Pages/public proof remains a separate gate.
14. UNKNOWN is never PASS.

## Deferred

- increasing Clone population cap;
- 90×78;
- chunks/streaming;
- hierarchical pathfinding;
- resource-node placement authority from WM4.8 zones;
- settlement generation.

Those are separate scale gates after 60×52 runtime and browser performance are proven.
