---
type: success-contract
project: Simclone
domain: adventure-autonomy
feature: Autonomous Adventurer Hunt Loop V1
status: implementation-candidate
canonical: true
owner: Adventure Gameplay / Project Brain
validation: UNKNOWN
last_reviewed: 2026-09-28
---

# Autonomous Adventurer Hunt Loop V1

## Goal

A released Adventurer must be able to participate in the Same-World Monster loop without the player pressing Hunt / Start Combat / Attack every time.

Canonical autonomous loop:

```text
safe idle Adventurer
→ select deterministic reachable physical Wild Monster
→ START_ADVENTURE_HUNT
→ existing Simclone path/task authority
→ READY encounter
→ START_ADVENTURE_COMBAT
→ BASIC_ATTACK on deterministic tick cadence
→ VERIFIED terminal outcome
→ supported loot claim when available
→ FINISH_ADVENTURE_RESULT
→ survival/autonomy resumes
```

## Authority locks

This gate owns **policy/intent only**.

All writes continue through released commands:
- Hunt = START_ADVENTURE_HUNT
- Combat start = START_ADVENTURE_COMBAT
- Attack = ADVENTURE_COMBAT_ACTION
- Loot = CLAIM_ADVENTURE_LOOT
- Result closeout = FINISH_ADVENTURE_RESULT

No second writer may be introduced for:
- Clone position/path
- human HP
- Monster HP/lifecycle
- Adventure XP/provenance
- loot/items
- equipment
- encounter/combat state

## Safety gate

An Adventurer may start an autonomous Hunt only when:
- alive
- profession = adventurer
- no current task/encounter/combat
- HP >= 60
- Satiety >= 55
- Energy >= 50

If unsafe, ordinary Simclone survival planning remains authoritative.

Existing Hunt interruption rules continue to apply while travelling.

## Target selection

Target must be:
- physical state.wildMonsters entity
- status IDLE
- hpCurrent > 0
- allowed by Adventure level / zone gate
- reachable through existing route authority
- able to produce a valid adjacent engagement cell

Selection is deterministic:
1. shortest routeDistance
2. zoneId
3. worldMonsterId

No Math.random and no wall clock.

## Combat cadence

READY encounter is held for 3 simulation ticks before automatic combat start.

World-bound ACTIVE combat performs BASIC_ATTACK every 6 simulation ticks.

This cadence is intentionally slower than one attack per tick so the world/render layer can expose combat rather than resolving it invisibly in a single frame.

Terminal result is held for 12 simulation ticks before automatic closeout.

## Loot

On VICTORY the autonomous loop may call the existing CLAIM_ADVENTURE_LOOT command.

If the released monster type has no supported loot profile, that failed proposal must not mutate Rust state; the result then closes normally.

## Parallel Display D3 boundary

Parallel branch:
`feature/display-d3-adventure-journey`

D3 owns presentation only:
- target/path cue
- ENGAGED feedback
- attack/slash cue
- damage/status feedback
- defeat/respawn presentation

This autonomy gate must not implement renderer-owned combat state or visual animation.

D3 must read the gameplay truth created by this gate and existing SWA authorities.

## Acceptance

1. No UI command is required for a safe Adventurer to start Hunt.
2. Autonomous target is exact physical worldMonsterId.
3. Hunt uses released real path authority; no teleport.
4. Level gate is respected.
5. Two Adventurers cannot claim the same Monster.
6. READY world encounter starts combat automatically.
7. ACTIVE world combat attacks automatically.
8. Attack cadence is deterministic tick-based.
9. Monster HP remains canonical world HP.
10. Human HP remains agent.hp.
11. VERIFIED Victory/Defeat evidence remains unchanged.
12. Terminal result closes automatically after deterministic hold.
13. Supported loot still commits only through Rust.
14. Unsafe HP/satiety/energy prevents new Hunt.
15. Save/load mid-Hunt remains deterministic.
16. No Math.random / Date / DOM exists in autonomy policy.
17. Existing manual Adventure UI commands remain usable.
18. Existing SWA0–SWA7 and Display D0–D2 regressions remain SAT.
19. Exact-head Verify must be SUCCESS.
20. UNKNOWN is never PASS.
