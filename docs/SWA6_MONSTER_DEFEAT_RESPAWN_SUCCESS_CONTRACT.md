---
type: success-contract
project: Simclone
domain: same-world-adventure
feature: SWA6 Monster Defeat + Despawn + Deterministic Respawn
status: implementation-candidate
canonical: true
owner: Project Brain + Integration Lead
validation: UNKNOWN
last_reviewed: 2026-09-27
---

# SWA6 — Monster Defeat, Despawn, Result Closeout and Respawn

## Goal

Close the physical Wild Monster lifecycle after SWA5 world-bound combat:

`ENGAGED → DEFEATED → hidden → RESPAWNING → IDLE(new incarnation)`

and let the Adventurer leave a terminal combat result so the next hunt can begin.

## Authority locks

- Monster lifecycle/HP/identity = `state.wildMonsters.entities[]`
- Human HP/life = existing Simclone authority
- Adventure XP = existing progression + provenance
- Loot = existing Rust authority
- Renderer/UI = projection only
- Time = simulation tick only

No wall-clock time, no Math.random and no second respawn ledger.

## Victory transition

After world-bound combat reaches VERIFIED VICTORY and reward commit succeeds:

- Monster HP is already 0 in world state
- Monster transitions `ENGAGED → DEFEATED`
- `engagedByAgentId → null`
- `defeatedTick = current simulation tick`
- `respawnTick = defeatedTick + 90`

The entity is hidden by the existing renderer because DEFEATED/RESPAWNING are not renderable states.

## Tile semantics

DEFEATED and RESPAWNING monsters are despawned.

They do not reserve/occupy their old tile for collision validation.

Only IDLE and ENGAGED monsters physically occupy a map tile.

## Terminal combat closeout

New command:

`FINISH_ADVENTURE_RESULT`

Allowed only for terminal VICTORY or DEFEATED sessions.

It clears the terminal `agent.adventureCombat` session but does not roll back:
- Adventure XP
- skill provenance
- Rust loot already claimed
- world Monster defeat state
- history/event evidence

A player may explicitly continue before claiming supported loot; this is treated as skipping that loot.

## Respawn

Respawn uses only simulation ticks.

At/after `respawnTick`:
1. DEFEATED enters RESPAWNING
2. respawn waits while any task/encounter/combat still references the old `worldMonsterId`
3. when references are clear, choose a deterministic valid spawn cell using:
   `seed + zone + spawnSlot + next spawnEpoch`
4. increment `spawnEpoch`
5. assign new `worldMonsterId = wm:<zone>:<slot>:<spawnEpoch>`
6. restore HP to hpMax
7. clear defeated/respawn timestamps
8. set status IDLE

The species/form, level, rank and zone stay the same in SWA6.

## Old-incarnation protection

Once respawned:
- old worldMonsterId no longer resolves
- stale hunt requests using old ID must fail
- old combat/reward evidence remains unique through its existing combat/outcome IDs

## SWA5 migration

Released SWA5 saves can contain:
- world Monster `ENGAGED`
- HP 0
- matching terminal VICTORY combat

On restore this state is migrated deterministically into SWA6 DEFEATED/RESPAWNING lifecycle using the committed reward tick when available.

## Owner death

If an Adventurer dies from Simclone life rules during ACTIVE combat:
- surviving ENGAGED Monster is released back to IDLE
- HP is preserved
- stale engagement ownership is removed before the agent combat session is cleared

## UI

VICTORY HUD:
- Receive Loot when supported
- Continue
- if continuing before loot claim, clearly indicate loot is skipped

DEFEATED HUD:
- End combat / continue

No new permanent dashboard.

## Acceptance

1. VERIFIED world-bound Victory transitions Monster to DEFEATED.
2. DEFEATED Monster HP = 0 and owner is cleared.
3. DEFEATED/RESPAWNING Monster is absent from render/hit targets.
4. Defeated Monster does not occupy its old map tile.
5. respawnTick = defeatedTick + 90.
6. Respawn uses simulation tick only.
7. Old terminal reference blocks replacement incarnation until cleared.
8. FINISH_ADVENTURE_RESULT clears only terminal session state.
9. XP/provenance/Rust commits survive result closeout.
10. Respawn increments spawnEpoch exactly once.
11. Respawn creates a new worldMonsterId.
12. Respawn position is deterministic and valid.
13. Respawn restores HP exactly to hpMax.
14. Old worldMonsterId cannot be hunted after respawn.
15. DEFEATED save/load is byte-stable.
16. SWA5 terminal Victory migrates to SWA6 lifecycle.
17. Active-combat owner death releases Monster safely.
18. Browser smoke proves Victory → hidden → Continue → new incarnation respawn.
19. Exact-head Verify must be SUCCESS.
20. UNKNOWN is never PASS.
