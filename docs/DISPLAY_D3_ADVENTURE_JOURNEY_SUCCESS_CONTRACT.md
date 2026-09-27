---
type: success-contract
project: Simclone
domain: display-system
feature: D3 Adventure Journey Visualization
status: implementation-candidate
canonical: true
owner: Project Brain + Display Integration
validation: UNKNOWN
last_reviewed: 2026-09-28
---

# Display D3 — Adventure Journey Visualization

## Baseline

D2 and D2.5 Combat Visibility are released on `main@da08ab1131548f8276c40b7188ab6a40ff2a055b`; exact-main Pages #99 / run `36340979453` is SUCCESS.

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

No fake HP, combat timer, defeat flag, respawn timer, worldMonsterId, path or encounter state.

## Ownership after D2.5

D2.5 remains the single owner of:
- strike slash
- hero damage number / MISS
- Monster counter strike
- counter damage number

D3 must not render a second copy of those effects.

D3 owns:
- Hunt route / target / engagement marker
- READY transition cue
- ENGAGED phase + canonical Monster HP context
- VICTORY / Clone DEFEATED phase cue
- Monster DEFEAT non-interactive lifecycle cue
- RESPAWN cue on the new physical incarnation

## D3A read model

`src/read-models/adventure-journey-visuals.mjs`

Phases:
- HUNT
- READY
- ENGAGED
- VICTORY
- DEFEATED

Lifecycle:
- DEFEAT derived from defeatedTick
- RESPAWN derived from spawnEpoch + spawnedTick

Cue windows use simulation ticks, not wall clock.

## D3B canvas overlay

All overlays are presentation-only and never create a hit target.

DEFEATED and RESPAWNING Monsters remain absent from ordinary render/hit projections.

## D3C browser proof

Actual deterministic browser flow must prove on desktop and mobile:
1. real physical Monster selection
2. Hunt
3. route cue
4. READY cue
5. start combat
6. ENGAGED cue
7. real attack provides verified lastTurn evidence while D2.5 owns strike feedback
8. Victory + defeat cue
9. defeated Monster absent from hit target
10. Continue
11. deterministic new-incarnation respawn + RESPAWN cue
12. screenshots for all phases

## Acceptance

- projection leaves serialized gameplay state byte-identical
- phase derives from authoritative SWA state
- defeat/respawn windows use simulation ticks
- D3 overlay helper writes no simulation state
- D3 does not participate in D2 hit candidate collection
- D2.5 remains single strike/damage animation owner
- standard exact-head Verify SAT (no false-positive from Canvas `c.save()`)
- dedicated D3 browser visual proof SAT
- merge then exact-main Pages SAT
- UNKNOWN is never PASS
