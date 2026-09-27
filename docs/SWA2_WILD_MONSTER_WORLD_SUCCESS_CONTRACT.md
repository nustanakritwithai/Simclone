---
type: success-contract
project: Simclone
domain: same-world-adventure
feature: SWA2 Wild Monster World Authority
status: implementation-candidate
canonical: true
owner: Project Brain + Integration Lead
validation: UNKNOWN
last_reviewed: 2026-09-27
---

# SWA2 — Wild Monster World Authority

## Goal

Create the first authoritative physical Wild Monster population in the Same-World Adventure Annex.

SWA2 owns world-state identity and spawn only. It does not render monsters, accept taps, start hunts, bind combat, defeat monsters or respawn them.

## Authority

State owner:

`state.wildMonsters`

Initial policy:

- 12 total entities
- z1 = 3
- z2 = 3
- z3 = 3
- z4 = 3
- status = `IDLE`
- spawnEpoch = 0

Every entity has:

- `worldMonsterId`
- `monsterId`
- `zoneId`
- `level`
- `rank`
- `x/y`
- `hpMax/hpCurrent`
- `status`
- `spawnSlot/spawnEpoch`
- `spawnedTick`
- lifecycle placeholders for later gates

`monsterId` identifies the Adventure/Pocket-derived form.
`worldMonsterId` identifies one physical monster in Simclone world state.

## Spawn rule

Spawn is deterministic from:

`world seed + zone + slot`

No `Math.random` or wall-clock time.

Candidates must:

- be inside the entity's Annex zone
- use a walkable grass cell
- not overlap resource nodes
- not overlap buildings
- not overlap Rust stations
- not overlap living Clones
- not overlap dropped Rust items
- not overlap another Wild Monster

The existing z1-z4 rosters remain authoritative for allowed `monsterId` values.

## Stats

Monster HP is projected through the existing `monsterStatsAtLevel()` authority.

No second combat-stat formula is introduced.

## Save migration

- Fresh Same-World creates the 12 entities.
- A released Large save loaded through the public Same-World migration gains the 12 entities after Annex migration.
- A SWA1 Same-World save with no monster ledger gains the ledger once.
- Once present, save/load is byte-stable and does not respawn/reseed monsters.
- Large/legacy profiles do not receive a monster ledger.

## Deferred

SWA3:
- renderer
- hit targets
- selected marker / level / type cue

SWA4:
- monster-target path task

SWA5:
- ENGAGED lifecycle
- combat session binding to `worldMonsterId`

SWA6:
- DEFEATED
- despawn
- deterministic respawn

## Acceptance

1. Exactly 12 world monster entities.
2. Exactly 3 in each z1-z4.
3. All `worldMonsterId` values are unique and stable.
4. Initial `monsterId` forms are unique and valid for their zone rosters.
5. Same seed/state creates byte-identical monster population.
6. Every spawn is on valid walkable Annex terrain.
7. No spawn overlaps resource/building/station/Clone/drop/monster.
8. HP exactly matches existing monster level projection.
9. Large/legacy state has no Wild Monster authority.
10. Same-World save/load is byte-stable.
11. SWA1 save migration adds the ledger exactly once.
12. Invalid duplicate ID / wrong zone / overlap / HP mismatch is rejected.
13. No renderer/UI production change in SWA2.
14. No `Math.random` or wall-clock gameplay rule.
15. Exact-head Verify must be SUCCESS.
16. UNKNOWN is never PASS.
