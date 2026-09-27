---
type: success-contract
project: Simclone
domain: display-system
feature: D3 Adventure Journey Visualization
status: implementation-candidate
canonical: true
owner: Project Brain + Display Integration
validation: UNKNOWN
last_reviewed: 2026-09-27
---

# Display D3 — Adventure Journey Visualization

## Baseline

D2 is released on `main@b7983c1334a55b70a94d2ee46fcb9ffd9217e950`.

Exact-main Pages #98 = SUCCESS.

D3 reads the already released SWA4–SWA6 lifecycle and must not create a second Adventure state machine.

## Goal

Make the Same-World Adventure loop visually traceable on the physical map:

```text
Monster
→ Hunt
→ READY
→ ENGAGED
→ Damage
→ Victory
→ DEFEATED/hidden
→ Respawn
```

## Authority lock

D3 may read:
- agent.task.adventureHunt
- agent.adventureEncounter
- agent.adventureCombat
- combat.lastTurn
- state.wildMonsters identity / position / status / HP
- spawnEpoch / spawnedTick / defeatedTick / respawnTick

D3 must not write any of those fields.

No fake:
- HP
- combat timer
- defeat flag
- respawn timer
- worldMonsterId
- path
- encounter state

## D3A read model

`src/read-models/adventure-journey-visuals.mjs`

Phases:
- HUNT
- READY
- ENGAGED
- VICTORY
- DEFEATED

Lifecycle cues:
- DEFEAT — short presentation cue derived from defeatedTick
- RESPAWN — short presentation cue derived from new spawnEpoch + spawnedTick

Cue windows use simulation ticks, not wall clock.

## D3B canvas overlay

Planned visual language:
- HUNT: thin route + target ring + engagement marker
- READY: compact READY badge between actor and physical Monster
- ENGAGED: combat ring / crossed-swords cue + canonical Monster HP feedback
- Damage: last verified hero/counter damage from combat.lastTurn
- VICTORY: victory cue at defeated Monster's authoritative last position
- Clone DEFEATED: retreat/defeat cue by Clone
- Monster DEFEAT: non-interactive fade/smoke at last authoritative position
- RESPAWN: short pulse around new physical incarnation

All overlays are presentation-only and never create a hit target.

## D3C browser proof

Actual deterministic browser flow must prove:
1. select physical Monster
2. Hunt
3. route cue visible
4. READY cue visible
5. start combat
6. ENGAGED cue visible
7. attack changes verified damage/HP cue
8. Victory cue visible
9. defeated Monster remains absent from hit target
10. Continue
11. deterministic respawn produces RESPAWN cue on new worldMonsterId
12. screenshots captured for desktop and mobile

## Acceptance

- pure projection leaves serialized gameplay state byte-identical
- phase always derives from authoritative SWA state
- defeat/respawn cue windows use simulation ticks
- canvas overlay writes no simulation state
- defeated/respawning Monster remains absent from normal entity hit targets
- standard Verify SAT
- dedicated D3 browser visual proof SAT
- exact-head screenshots inspected
- merge then exact-main Pages SAT
- UNKNOWN is never PASS
