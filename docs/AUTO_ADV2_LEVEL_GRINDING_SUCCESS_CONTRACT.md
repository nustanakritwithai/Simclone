---
type: success-contract
project: Simclone
domain: adventure-autonomy
feature: AUTO-ADV2 Level Grinding Policy
status: implementation-candidate
canonical: true
validation: UNKNOWN
last_reviewed: 2026-09-28
---

# AUTO-ADV2 — Level Grinding Policy

## Goal

Teach autonomous Adventurers to build Adventure level safely instead of selecting an over-level Wild Monster simply because it is closer.

Canonical loop:

safe Adventurer
→ inspect current Adventure progression
→ consider only reachable IDLE physical Wild Monsters
→ reject Monster level above Adventurer level
→ prefer the strongest safe Monster
→ Hunt / Combat / VERIFIED reward
→ Adventure XP increases
→ recompute level
→ unlock stronger training target

## Authority locks

AUTO-ADV2 changes policy only.

It must not create a second authority for:
- position/path
- Monster HP/lifecycle
- human HP
- Adventure XP
- reward/provenance
- inventory/equipment
- combat resolution

All writes remain through the released Autonomous Adventure commands and existing SWA authorities.

## Target rule

For current Adventure level L:

eligible Monster level <= L

The policy does not attack above-level Monsters.

Among eligible reachable physical Monsters, deterministic preference is:
1. smallest levelGap = Adventurer level - Monster level
2. shortest routeDistance
3. zoneId
4. worldMonsterId

This means the Adventurer trains on the strongest Monster it can currently handle rather than the closest arbitrary target.

If all safe Monsters are unavailable, ENGAGED, DEFEATED or waiting to respawn, the Adventurer waits. It must not escalate to an over-level target.

## Progression behavior

After VERIFIED Victory the existing Adventure reward authority grants XP.
The next idle target selection recalculates Adventure level from canonical XP.
Higher-level Monsters become eligible only after the Adventurer reaches the required level.

## Acceptance

1. No autonomous target has monsterLevel greater than adventureLevel.
2. Same-level target is preferred over a lower-level target even when the lower-level target is closer.
3. If no safe target is available, target selection returns null.
4. Increasing canonical Adventure level can unlock a stronger target.
5. Zone gates remain unchanged.
6. Real pathfinding remains unchanged.
7. Combat math remains unchanged.
8. Fast respawn remains 5 simulation ticks.
9. Manual Adventure controls remain unchanged.
10. Save/load remains deterministic.
11. Exact-head Verify must be SUCCESS.
12. UNKNOWN is never PASS.
