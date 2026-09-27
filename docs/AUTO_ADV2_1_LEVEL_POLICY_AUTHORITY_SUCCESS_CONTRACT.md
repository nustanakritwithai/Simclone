---
type: success-contract
project: Simclone
domain: adventure-autonomy
feature: AUTO-ADV2.1 Level Policy Authority Lock
status: implementation-candidate
validation: UNKNOWN
last_reviewed: 2026-09-28
---

# AUTO-ADV2.1 — Level Policy Authority Lock

## Goal

Make level-grinding target selection authoritative. Autonomous Adventurers must not be able to start a Hunt for a merely nearer Monster when the canonical level-grinding selector chooses a different safe target.

## Canonical autonomous target policy

For current Adventure level L:
1. physical Monster must be IDLE, alive and reachable
2. Monster level must be <= L
3. Monster claimed by another Adventurer is excluded
4. prefer smallest level gap (L - Monster level)
5. then shortest route distance
6. then stable zone/id ordering

## Engine gate

For control='autonomous', START_ADVENTURE_HUNT must recompute the canonical target at the command boundary.
If the requested worldMonsterId is not the canonical target, reject with target-policy and leave state unchanged.

Manual Hunt is not subject to this AI policy gate.

## Execution state migration

New autonomous Hunt tasks carry:
targetPolicy='level-grinding/v1'

The marker is propagated to the READY encounter.
Old autonomous Hunt/READY execution state without the marker is discarded on restore so the AI can reselect under the current policy.
Historical identity, XP, HP, items and world state are not rewritten.

## Acceptance

- A nearer weak Monster cannot override a farther stronger safe target.
- Engine rejects a non-canonical autonomous Hunt target.
- Canonical autonomous Hunt is accepted and carries the policy marker.
- Old pre-policy autonomous Hunt task restores as idle and is reselected.
- Manual Adventure behavior remains compatible.
- Combat math, reward, Monster lifecycle and renderer are unchanged.
- Exact-head Verify and autonomous browser smoke must be SUCCESS.
- UNKNOWN is not PASS.
