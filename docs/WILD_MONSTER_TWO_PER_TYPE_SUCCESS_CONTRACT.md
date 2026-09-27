---
type: success-contract
project: Simclone
domain: adventure-world-monsters
feature: two instances per existing type
status: implementation-candidate
validation: UNKNOWN
last_reviewed: 2026-09-28
---

# Wild Monster Two-Per-Type

## Goal

Increase Wild Monster availability without adding new monster species/forms.

Released baseline selects three existing monster types per zone. This feature keeps those same three types and creates two physical world instances of each type.

Expected population:
- 3 existing types per zone
- 2 instances per type
- 6 instances per zone
- 4 zones
- 24 total world instances
- 12 distinct existing monster types total

## Authority

Wild Monster world state remains the single authority in `src/adventure-world-monsters.mjs`.

No new species, form, combat, XP, inventory, pathfinding or renderer authority is introduced.

## Identity / migration

Legacy slots 0-2 remain unchanged.
New paired instances use slots 3-5.
Legacy 12-monster saves migrate deterministically to 24 instances without changing original worldMonsterId values or current original lifecycle state.

Each type pair keeps the same monsterId, level and rank. Each physical instance has its own worldMonsterId, position, HP lifecycle, spawnEpoch and 5-tick respawn lifecycle.

## Acceptance

- Fresh Same-World has exactly 24 physical instances.
- Exactly 12 distinct existing monsterIds remain.
- Each zone has exactly 3 distinct monsterIds and exactly 2 instances of each.
- Positions and worldMonsterIds are unique.
- Legacy 12-monster saves migrate once and remain byte-stable afterward.
- Original slots/IDs are preserved through migration.
- Respawn remains deterministic at 5 simulation ticks.
- No Math.random / wall-clock / DOM gameplay rule.
- Exact-head Verify must be SUCCESS.
- UNKNOWN is not PASS.
