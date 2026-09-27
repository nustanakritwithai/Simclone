---
type: success-contract
project: Simclone
domain: same-world-adventure
feature: SWA0 Core Preservation Contract
status: baseline-candidate
canonical: true
owner: Project Brain + Integration Lead
validation: UNKNOWN
last_reviewed: 2026-09-27
---

# SWA0 — Same-World Adventure Core Preservation Contract

## Source of truth at contract freeze

Released main and prepared branch both point to:

`a97fcfdec4c9bcd5586eafe479f6ac618cf70fc3`

Prepared branch:

`feature/adventure-same-world`

SWA0 is contract/proof work only. It must not add Same-World production behavior, monsters, rendering, combat binding or save mutation.

## Goal

Prepare one physical 84×52 world made from:

- Core World: x=0..59, y=0..51
- Adventure Annex: x=60..83, y=0..51

while preserving the released Core World behavior of the current 60×52 large world.

The Annex must extend the existing coordinate system. It is not a second map, scene, teleport destination or encounter-only overlay.

## Evidence from released code

The released 60×52 profile is strict:

- `LARGE_WORLD_BOUNDS = {profile:'large',w:60,h:52}`
- saved explicit `worldBounds` must exactly match the canonical profile or validation rejects the save
- Survival/path indexing uses `worldBounds(state).w/h`
- `worldRegionAt()` normalizes x/y by `bounds.w/h`
- `regionalRiverCenter()` derives the river from the supplied bounds
- WorldSim map/climate/soil/hydrology/vegetation/resource shadows consume the runtime map dimensions
- WM4.7 regeneration indexes ecology potentials by the shadow width

Therefore changing the canonical `large` profile from 60×52 to 84×52 is forbidden. It changes Core regional evidence and invalidates existing explicit 60×52 saves.

## Architecture lock

### Compatibility profiles

Keep these existing contracts immutable:

- legacy = 30×26
- large = 60×52

`large` is the released Core reference profile and the compatibility profile for current public saves.

A future implementation may add a distinct full-world profile, recommended name:

`same-world = 84×52`

Do not repurpose `large`.

### Two meanings of bounds, one physical map

Future runtime needs two pure concepts:

1. **Physical world bounds**
   - full playable/path/render/save grid
   - 84×52 for Same-World
   - authoritative through `worldBounds(state)`

2. **Core reference bounds**
   - fixed 60×52
   - used whenever released Core generation/WorldSim normalization must remain equivalent
   - must not create a second mutable map

The Core reference is only a deterministic coordinate/evidence domain inside the one physical map.

### Core preservation rule

For the same seed and equivalent pre-Annex state, every Core coordinate x=0..59, y=0..51 must preserve:

- gameplay tile meaning
- river/road/bridge/camp topology
- resource-node identity/type/coordinate/amount/max
- building coordinates/state
- Clone coordinates/state
- Rust station/item coordinates/state
- Household/Settlement/Governor state
- task/path coordinates already inside Core
- WorldSim Core regional evidence
- WorldSim Core terrain/elevation/moisture evidence
- WM4.7 food/wood regeneration result for existing Core nodes

Allowed Same-World additions must be explicitly bounded to Annex authority, such as:

- full-world bounds/profile
- Annex tiles x=60..83
- Annex metadata
- future wild-monster state
- future monster respawn state

No unrelated Core mutation is allowed merely because Annex exists.

## Row-major migration lock

Released Core tiles are stored as a flat row-major 60×52 array.

Migration to 84×52 must rebuild rows:

```text
for each y=0..51:
  copy old row x=0..59 to new row x=0..59
  append/generate Annex x=60..83
```

Forbidden:

`oldTiles.concat(annexTiles)`

because changing row width from 60 to 84 would remap old coordinates after the first row.

Existing entity x/y values must not be scaled or shifted.

## WorldSim lock

Core WorldSim evidence must continue to use the released 60×52 Core reference normalization.

In particular, do not call released Core regional generation with 84×52 bounds and assume x<60 is unchanged.

Adventure Annex terrain may use a separate pure Annex terrain rule, but it must be composed into the same physical `state.tiles` and the same renderer/path authority.

Baseline SWA1 should not add ordinary WorldSim resource nodes to the Annex. This avoids accidentally extending K6/WM4.7 resource authority before an explicit resource-expansion contract.

## Save migration contract

A current public save with:

`worldBounds = {version:'MX0-0.1',profile:'large',w:60,h:52}`

must remain valid input.

Future migration to Same-World must:

1. validate/read the released Core save shape
2. preserve all existing Core coordinates and domain state
3. rebuild the tile array row-by-row into width 84
4. generate only Annex cells deterministically
5. add only explicitly approved Annex state
6. serialize as the new full-world profile
7. load again without adding a second Annex or duplicating state
8. continue deterministically from the same simulation tick

Migration must be idempotent.

## Core reference proof strategy

SWA0 establishes the released `large` world as a permanent behavioral reference.

Future SWA1 candidate proof must create, for each proof seed:

- Reference = fresh/replayed released-shape `large` 60×52 world
- Candidate = Same-World 84×52 world/migrated save

Then compare a canonical Core projection that:

- takes tiles x=0..59 from each physical row
- excludes only explicitly approved Annex-only fields
- otherwise deep-compares existing simulation/domain state

WorldSim proof must compare Core cells using fixed 60×52 regional normalization.

Required proof seeds at minimum:

- 230926
- 42
- 2026

## SWA0 acceptance

SWA0 is SAT only when all are true:

1. branch started from released main `a97fcfdec...`
2. `large` remains exactly 60×52
3. tests demonstrate that naive 84-wide normalization changes Core regional/river evidence
4. tests demonstrate that mutating a released `large` save to w=84 is rejected by current bounds validation
5. Core projection helper is deterministic across save/load for released 60×52 worlds
6. WorldSim Core map/ecology evidence is anchored to 60×52 reference behavior
7. no production runtime source is changed by SWA0
8. exact-head CI is SUCCESS
9. UNKNOWN is never PASS

## Gates after SWA0

- SWA1 — Annex terrain + safe 60→84 migration
- SWA2 — Wild Monster World Authority
- SWA3 — Visible/tappable monsters
- SWA4 — Monster-target real-path expedition
- SWA5 — worldMonsterId combat binding
- SWA6 — defeat/despawn/respawn lifecycle
- SWA7 — browser/mobile/public proof

Rendering must not begin before SWA1/SWA2 world authority is SAT.
