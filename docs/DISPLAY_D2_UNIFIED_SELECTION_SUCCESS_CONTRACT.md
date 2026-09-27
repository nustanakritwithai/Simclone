---
type: success-contract
project: Simclone
domain: display-system
feature: D2 Unified Selection + Hit Resolver
status: released
canonical: true
owner: Project Brain + Display Integration
validation: SAT
last_reviewed: 2026-09-27
---

# Display D2 — Unified Selection + Deterministic Hit Resolver

## Baseline

D1 is released on `main@4c75a098f01c179a425e045617f849683250d13b`.

Exact-main Pages #97 is SUCCESS, including engine/unit regression, Chromium UI smoke, native HTTP/storage proof, exact public byte proof and public Same-World lifecycle proof.

D2 starts only from this baseline.

## Goal

Replace split runtime target arbitration with one deterministic presentation contract.

Persistent selection:

```js
{ kind, id }
```

Kinds:
- agent
- monster
- drop
- station
- building
- resource

Transient event feedback can participate in hit resolution but never becomes persistent selection.

## Authority lock

D2 is presentation/input routing only.

It must not write:
- Clone or Monster position
- HP
- task/path
- encounter/combat
- inventory/equipment
- resource/building state
- save schema

Selection is not simulation state and is never serialized.

## Resolver

Pure module:

`src/read-models/world-hit-resolver.mjs`

Caller supplies screen-space candidates. Resolver owns only:
1. hit-radius acceptance
2. shortest-distance choice
3. exact-distance deterministic priority
4. stable id/source tie breaks

Exact-distance priority:

```text
event → agent → monster → drop → station → building → resource
```

Distance always wins before priority.

## Runtime migration

Current split paths:
- monsterTargetAtScreen()
- structureTargetAtScreen()
- worldObjectTargetAtScreen()
- separate living-agent loop

D2 runtime must collect candidates once and call one `resolveWorldHit()`.

Legacy helper hooks may remain temporarily for regression tests, but must delegate to the unified candidate collection/resolver and must not arbitrate independently.

## Selection semantics

One generic world selection object is canonical.

Agent actor/Inspector context may be retained separately as `activeAgentId` because Hunt needs an actor while a Monster is the selected world target. It is not a second generic world selection.

Rules:
- click Agent → selection={kind:'agent',id} and activeAgentId=id
- click Monster → selection={kind:'monster',id}; activeAgentId may remain the hunter context
- click structure/drop/resource → selection points to that entity
- click empty world → selection=null
- event hit → transient action only; selection unchanged

## Browser acceptance

Viewports:
- 1440×1000
- 390×844
- 320×740
- 844×390

Must prove exact `{kind,id}` for:
- Monster + Clone exact-distance tie → Agent
- Monster + Resource exact-distance tie → Monster
- Drop + Clone exact-distance tie → Agent
- Building + Agent exact-distance tie → Agent
- Station + Building exact-distance tie → Station
- two nearby/equal Monsters → stable lower id
- real Monster near safe-playfield edge
- zoomed-out real Monster
- HUD boundary does not steal canvas interaction

## D2 acceptance

1. D1 remains visually/publicly SAT.
2. Pure resolver tests SAT.
3. Runtime pointer-up uses one unified resolver.
4. Generic selection is one `{kind,id}` object.
5. `selectedWorldMonsterId` is removed.
6. numeric Agent context is renamed `activeAgentId` and is not used as generic selection.
7. legacy hit helpers, if retained, delegate to unified candidates.
8. no gameplay state mutation is introduced.
9. standard Chromium UI smoke SAT.
10. dedicated D2 browser viewport/overlap proof SAT.
11. desktop/mobile screenshots captured.
12. exact-head Verify SAT.
13. UNKNOWN is never PASS.

## Conflict rule

PR #84 is stale relative to released Same-World + D1. Do not merge it into D2. Reimplement only behavior that is reverified on current main.


## Release evidence

D2 merged through PR #154 on `main@b7983c1334a55b70a94d2ee46fcb9ffd9217e950`.
Exact-head Verify and D2 interaction proof were SAT. Exact-main Pages #98 / run `36336936777` was SUCCESS.
