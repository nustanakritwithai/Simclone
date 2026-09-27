---
type: success-contract
project: Simclone
domain: display-system
feature: D2 Unified Selection + Hit Resolver
status: foundation-candidate
canonical: true
owner: Project Brain + Display Integration
validation: UNKNOWN
last_reviewed: 2026-09-27
---

# Display D2 — Unified Selection + Hit Resolver

## Goal

Replace split world-target selection with one deterministic presentation contract.

Persistent world selection:

```text
{ kind, id }
```

Selectable kinds:
- agent
- monster
- building
- station
- drop
- resource

Transient feedback events remain hittable but never become persistent selection.

## Why

The current runtime resolves interaction through several independent paths:
- living Clone proximity
- structureTargetAtScreen()
- worldObjectTargetAtScreen()
- monsterTargetAtScreen()
- transient event hit targets

D2 makes candidate resolution explicit before changing runtime behavior.

## Authority lock

D2 is presentation only.

It must not:
- move a Clone or Monster
- change HP
- assign task/path
- create combat/encounter
- mutate buildings/items/resources
- write simulation selection into save data
- use DOM state as gameplay truth

## Foundation module

`src/read-models/world-hit-resolver.mjs`

Pure APIs:
- worldHitCandidate(...)
- resolveWorldHit(...)
- worldSelection(kind,id)
- selectionFromWorldHit(hit)

The foundation does not read world state or screen coordinates itself.

Caller owns projection and hit geometry.
Resolver only chooses among supplied candidates.

## Determinism

Primary rule:
1. shortest valid screen-space distance wins
2. exact distance tie uses explicit kind priority
3. exact kind tie uses stable id ordering
4. source string is final deterministic tie-break

Current exact-tie priority preserves the released interaction intent:
event → agent → building → station → drop → monster → resource

Event is transient and maps to no persistent selection.

## Integration gate

Do not modify app.mjs in this foundation PR.

Runtime integration starts only after D1 is merged/reverified.

Integration must:
- collect Clone / Monster / structure / resource / drop hit candidates
- call one resolver
- store persistent presentation selection as one {kind,id}
- keep transient event behavior transient
- preserve mobile hit radii
- prove overlapping targets deterministically resolve the same way across repeated runs

## Conflict awareness

PR #84 also touches app.mjs / UX interaction and is stale relative to current Same-World release.

Do not merge PR #84 into D2.
Any useful UX behavior must be re-audited and selectively reimplemented on current main.

## Foundation acceptance

1. One canonical persistent selection vocabulary exists.
2. Event cannot become persistent selection.
3. Nearest valid hit wins.
4. Exact-distance ties are deterministic and input-order independent.
5. Hit radius is explicit and enforced.
6. Invalid/malformed candidates fail closed.
7. Resolver is immutable/read-only.
8. Module contains no DOM, RNG, wall clock, engine command or state writer.
9. Existing app.mjs is untouched in foundation phase.
10. npm test must include D2 resolver tests.
11. UNKNOWN is never PASS.

## Later D2 integration acceptance

- one runtime resolver replaces split target arbitration
- selection contract becomes {kind,id}
- agent/monster/building/station/drop/resource remain tappable
- event feedback remains transient
- mobile tap target usability remains SAT
- browser screenshot/playtest evidence required
- exact-head Verify required
