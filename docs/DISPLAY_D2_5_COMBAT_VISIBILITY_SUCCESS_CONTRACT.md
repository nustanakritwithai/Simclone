---
type: success-contract
project: Simclone
domain: display-system
feature: D2.5 Adventure Combat Visibility Hotfix
status: released
canonical: true
owner: Project Brain + Display Integration
validation: SAT
last_reviewed: 2026-09-28
---

# D2.5 — Adventure Combat Visibility Hotfix

## Goal

Fix the player-visible gap after D2: Adventure combat already resolves authoritatively, but the world canvas does not visibly communicate that an Adventurer is fighting a Wild Monster.

This hotfix adds presentation feedback only. D3 remains the later full Adventure Journey Visualization gate.

## Authority locks

D2.5 reads only:
- agent.adventureCombat
- combat.worldMonsterId
- combat.lastTurn
- state.wildMonsters
- agent/world coordinates

D2.5 must not:
- start combat
- advance a combat turn
- write HP
- move an Agent or Monster
- write selection/gameplay state
- create damage values
- create encounter/result/respawn state
- change Autonomous Adventure policy

No engine.mjs change is permitted in this hotfix.

## Visible feedback

For an ACTIVE world-bound combat:
- draw a visible ENGAGED connection between the exact Adventurer and Monster
- draw rings around both combatants
- draw a sword marker between them

When combat.lastTurn changes:
- show a short hero strike/slash toward the Monster
- show the authoritative heroDamage, or MISS
- when counterDamage > 0, show a reverse strike and the authoritative counter damage on the Adventurer

Animation timing is renderer-local requestAnimationFrame time only.
It is not simulation truth and is never serialized.

## Read-only proof hook

simclone.combatFeedback() may expose copies of the projection for browser verification.
Calling it must leave serialized simulation state byte-identical.

## Compatibility

The visual layer must work with:
- manual BASIC_ATTACK actions
- future autonomous Adventure actions, because both use the same adventureCombat/lastTurn authority

It must not depend on how the combat command was triggered.

## Deferred to D3

D3 still owns the full journey visualization:
- Hunt target/path treatment
- READY transition presentation
- richer ENGAGED staging
- defeat/respawn cues
- broader combat particles/status presentation
- animation architecture cleanup

## Acceptance

1. Exact ACTIVE combat projects one exact agentId/worldMonsterId pair.
2. Reading combat feedback does not mutate simulation state.
3. ACTIVE combat is visibly marked on the canvas even before another Attack is pressed.
4. A new lastTurn produces visible attack feedback.
5. Displayed hero damage comes only from combat.lastTurn.heroDamage.
6. Displayed counter damage comes only from combat.lastTurn.counterDamage.
7. No second HP/damage/combat ledger is added.
8. No engine gameplay source changes.
9. Mobile Chromium smoke captures ENGAGED and post-Attack screenshots.
10. Existing D2 selection behavior remains SAT.
11. Existing SWA4-SWA7 lifecycle regressions remain SAT.
12. Exact-head Verify must be SUCCESS.
13. UNKNOWN is never PASS.


## Release evidence

D2.5 merged through PR #156 on `main@da08ab1131548f8276c40b7188ab6a40ff2a055b`.
Exact-main Pages #99 / run `36340979453` was SUCCESS. D2.5 remains the single strike/counter/damage-number presentation owner for D3.
