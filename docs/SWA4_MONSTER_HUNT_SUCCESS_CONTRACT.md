---
type: success-contract
project: Simclone
domain: same-world-adventure
feature: SWA4 Monster-Target Hunt Path
status: implementation-candidate
canonical: true
owner: Project Brain + Integration Lead
validation: UNKNOWN
last_reviewed: 2026-09-27
---

# SWA4 — Real-Path Monster Hunt

## Goal

Replace zone-only/random encounter targeting for the visible-monster path with an explicit physical target:

`worldMonsterId → engagement cell → existing Simclone path authority → READY encounter bound to that same entity`

The legacy zone expedition command remains available for compatibility, but the new visible-monster UX must use `START_ADVENTURE_HUNT`.

## Authority locks

- Clone position/path = existing Simclone navigation/task authority
- Monster identity/position = `state.wildMonsters`
- Profession = existing Adventurer profession
- Progression/zone gate = existing Adventure progression
- UI only dispatches validated engine command

No teleport, no new position writer, no second reservation ledger.

## Hunt task

A hunt task stores:
- `worldMonsterId`
- `zoneId`
- Adventure level snapshot
- authoritative Monster x/y snapshot
- engagement target x/y

The target cell must:
- be cardinally adjacent to the Monster
- be inside the Monster's zone
- be walkable
- not overlap node/building/station/drop/other living Clone/other active Monster
- be reachable through the existing route field

## Reservation

One physical Monster may have one hunter/encounter owner at a time.

Reservation is derived from existing task/encounter state, not a second mutable lock table.

If corrupted save state contains duplicate hunt tasks, deterministic priority is:
1. earlier task.started
2. lower agent ID

## Completion

Arriving beside the Monster creates a READY Adventure encounter directly from that entity:
- same `worldMonsterId`
- same `monsterId`
- same level
- same rank
- same zone

No `resolveAdventureEncounter()` RNG is used for a hunt completion.

The hunt does not count as another generic EXPLORE qualification completion.

## Stale target

If the target Monster disappears, changes identity/position, becomes unavailable, or is claimed by another authoritative encounter, the hunt task becomes invalid and must be cancelled rather than spawning a replacement.

## Deferred

SWA5:
- set Monster ENGAGED
- bind combat session to `worldMonsterId`
- single HP writer during combat

SWA6:
- DEFEATED
- despawn
- respawn

## Acceptance

1. Visible Monster context offers a hunt action when an Adventurer exists.
2. Command is `START_ADVENTURE_HUNT`.
3. Starting hunt never changes Clone x/y.
4. Target is one cardinal engagement cell beside selected Monster.
5. Existing path authority supplies the path.
6. Zone level gate is enforced before task assignment.
7. A second Adventurer cannot claim the same Monster.
8. Save/load during travel reaches the same physical Monster deterministically.
9. READY encounter carries exact `worldMonsterId`.
10. Encounter species/level/rank match the entity.
11. Hunt completion does not create generic EXPLORE qualification evidence.
12. Stale target invalidates task; no replacement encounter is generated.
13. Legacy zone expedition remains compatible.
14. Browser smoke proves Monster card → hunt command → no teleport.
15. Exact-head Verify must be SUCCESS.
16. UNKNOWN is never PASS.
