---
type: success-contract
project: Simclone
domain: same-world-adventure
feature: SWA5 World-Monster Combat Binding
status: implementation-candidate
canonical: true
owner: Project Brain + Integration Lead
validation: UNKNOWN
last_reviewed: 2026-09-27
---

# SWA5 — Bind Combat to worldMonsterId + ENGAGED lifecycle

## Goal

Make combat started from a physical SWA4 hunt operate on that exact Wild Monster world entity.

Canonical flow:

`READY encounter(worldMonsterId) → ENGAGED → combat turns → terminal combat`

## Authority locks

- Human HP writer: existing `agent.hp`
- Monster identity/position/HP writer: `state.wildMonsters.entities[]`
- Combat math: existing pure Adventure resolver
- Adventure XP: existing Adventure skill + provenance
- Loot: existing Rust authority
- UI: projection + validated commands only

A world-bound combat session MUST NOT own a second `monsterHpCurrent` field.

Legacy non-world encounter sessions may keep the old field for save/test compatibility.

## Start combat

For a READY encounter carrying `worldMonsterId`:

1. resolve that exact entity
2. verify species/zone/level/rank identity
3. verify cardinal engagement range
4. require Monster status `IDLE` and HP > 0
5. create combat session containing the same `worldMonsterId`
6. transition entity `IDLE → ENGAGED`
7. set `engagedByAgentId`
8. clear READY encounter

No replacement Monster may be selected.

## Combat turn

The resolver reads current Monster HP from the world entity.

Commit order:

`pure proposal → expected HP check → world HP commit → terminal reward → agent/session commit`

World HP commit requires:
- exact engaged Monster
- exact owning Adventurer
- exact expected-before HP
- hpAfter between 0 and expectedBefore

Stale HP evidence fails atomically.

## Terminal behavior in SWA5

### Victory

SWA5 stops at:

- combat session = `VICTORY`
- world Monster = `ENGAGED`
- world Monster HP = 0
- engaged owner remains the winning Adventurer

SWA6 owns the next transition:

`ENGAGED/0 → DEFEATED → despawn → respawn`

### Adventurer defeat

The Monster survives:
- world HP remains the committed positive HP
- Monster releases `ENGAGED → IDLE`
- `engagedByAgentId → null`
- no automatic heal

The existing Clone defeat result remains the combat terminal evidence.

## Validation

For world-bound sessions:

- session.worldMonsterId must exist
- session must not contain `monsterHpCurrent`
- identity must match world entity
- ACTIVE requires ENGAGED by same agent and HP > 0
- VICTORY requires ENGAGED by same agent and HP = 0
- DEFEATED requires Monster IDLE, owner cleared and HP > 0
- lastTurn HP evidence must match committed world HP

## UI

Combat HUD reads Monster HP from world entity when `worldMonsterId` exists.

Monster context:
- still shows ENGAGED Monster
- does not offer another Hunt action while ENGAGED

No permanent new dashboard.

## Compatibility

Legacy encounters without `worldMonsterId` retain the existing session-local HP behavior so old saves/tests remain compatible.

The public visible-monster path uses the world-bound flow.

## Acceptance

1. Hunt READY encounter starts combat against exact worldMonsterId.
2. Monster transitions IDLE → ENGAGED.
3. engagedByAgentId is exact combat agent.
4. World-bound session contains no monsterHpCurrent field.
5. BASIC_ATTACK reads canonical world HP.
6. BASIC_ATTACK commits canonical world HP exactly once.
7. stale expected-before HP is rejected without mutation.
8. ACTIVE save/load is byte-identical.
9. second Adventurer cannot hunt an ENGAGED Monster.
10. Combat HUD reads world HP.
11. Victory ends with world HP 0 and remains ENGAGED pending SWA6.
12. Adventurer defeat releases surviving Monster to IDLE without healing.
13. XP/reward/loot evidence remains compatible.
14. Browser smoke proves visible Monster → Hunt → READY → Combat → world HP commit.
15. Existing legacy combat regressions remain SAT.
16. Exact-head Verify must be SUCCESS.
17. UNKNOWN is never PASS.
