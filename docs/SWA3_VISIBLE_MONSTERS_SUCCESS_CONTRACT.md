---
type: success-contract
project: Simclone
domain: same-world-adventure
feature: SWA3 Visible + Tappable Wild Monsters
status: implementation-candidate
canonical: true
owner: Project Brain + Integration Lead
validation: UNKNOWN
last_reviewed: 2026-09-27
---

# SWA3 — Visible + Tappable Wild Monsters

## Goal

Project the authoritative SWA2 Wild Monster entities into the existing Simclone world renderer so players can see and tap real physical monsters in the Adventure Annex.

SWA3 is a presentation/input gate only.

## Authority lock

Simulation truth remains:

`state.wildMonsters.entities`

SWA3 may read but must not create, move, damage, engage, defeat, respawn or otherwise mutate Wild Monster gameplay state.

The renderer must not become a second monster ledger.

## Render integration

Wild Monsters enter the existing depth-sorted world object list:

```text
node
building
rust-station
drop-item
wild-monster
agent
```

The renderer must use the entity's authoritative x/y coordinates.

## Visual language

Each visible Monster must expose at minimum:

- a distinct silhouette that is not confused with resource nodes
- type cue derived from the existing monster definition
- level marker
- elite cue when rank = elite
- selection ring when tapped
- HP bar only while selected in SWA3

No new sprite/asset authority is required for this gate; canvas primitives are acceptable.

## Playfield protection

Per Game Studio rules:

- no permanent Monster dashboard
- no center-screen persistent overlay
- tap opens one contextual dialog
- dialog is read-only
- mobile hit target is larger than the painted silhouette
- normal world view remains dominant

## Tap behavior

Tap resolution must return:

`{type:'monster', id:worldMonsterId}`

The contextual card reads:

- monster identity
- level
- type
- zone
- rank
- status
- HP
- `worldMonsterId`

Tapping must not mutate simulation state.

## Scope exclusions

SWA3 does not implement:

- Hunt / target commands
- path-to-monster tasks
- ENGAGED lifecycle
- combat binding
- damage commits
- defeat/despawn
- respawn

Those remain SWA4–SWA6.

## Acceptance

1. All non-defeated SWA2 entities are inserted into the existing depth list.
2. Monster screen position derives only from entity x/y.
3. Type/level cues are visible.
4. Elite entities have a distinct visual cue.
5. A tapped entity resolves its exact `worldMonsterId`.
6. Mobile hit target remains usable at current Same-World zoom.
7. Context dialog reads authoritative state and performs zero simulation mutation.
8. No sixth mobile-nav tab or persistent Monster dashboard is introduced.
9. Existing Clone/resource/building/drop hit targets still work.
10. Existing Adventure V1 UI remains intact.
11. Chromium smoke captures visible Monster evidence.
12. No DOM state is used as gameplay authority.
13. Exact-head Verify must be SUCCESS.
14. UNKNOWN is never PASS.
