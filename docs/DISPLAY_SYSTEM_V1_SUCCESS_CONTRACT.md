---
type: success-contract
project: Simclone
domain: display-system
feature: Display System V1
status: implementation-candidate
canonical: true
owner: Project Brain + Display Integration
validation: UNKNOWN
last_reviewed: 2026-09-27
---

# Display System V1 — D0 / DSP1 foundation

## Goal

Build a display architecture that can scale with Same-World Adventure without becoming a second simulation authority.

Canonical direction:

Simulation State → Presentation Read Model → Viewport / LOD → Render Registry → Canvas → Hit Resolver → Selection → Context UI

The current candidate implements only D0 source synchronization and DSP1, the pure Presentation Read Model.

## Baseline

Branch base:

main@1f704dcb4df0bc1b5aae7dc718321facac54bb59

At this baseline SWA0–SWA5 are merged.

Gameplay ownership remains:
- SWA6: DEFEATED / despawn / deterministic respawn
- SWA7: browser/mobile/public closeout

PR #139 remains an asset donor and is not runtime authority.

## Authority lock

Simulation owns:
- Clone identity, position, life, needs and task state
- Wild Monster identity, position, status and HP
- buildings and Rust stations
- Rust item instances and drops
- Adventure encounter/combat/progression state

Presentation may read those authorities and derive immutable view records.

Presentation must not:
- spawn or move gameplay entities
- write HP
- create encounters or combat sessions
- grant loot or XP
- change profession
- create inventory/equipment state
- use DOM, wall-clock time or random values as gameplay truth

## DSP1 contract

src/read-models/world-presentation.mjs exposes:
- worldPresentationRegions(state)
- worldPresentationEntities(state, {selection})
- worldPresentationSnapshot(state, {selection})

Entity vocabulary:
- resource
- building
- station
- drop
- monster
- agent

Every projected entity has:
- kind
- id
- x / y
- depth
- visualKey
- selected

Domain-specific fields may be added only as read-only projection of an existing authority.

Monster projection must use state.wildMonsters.entities as identity, coordinate, lifecycle and HP truth.

## D1 readability contract

The next visual gate must make the existing world readable before adding more HUD.

With normal panels closed, a player should be able to distinguish:
- Core Settlement
- Adventure Annex
- z1 through z4 progression
- Clone
- Wild Monster
- resource
- building / production station
- dropped item

The center and lower-middle playfield remain protected.

D1 may consume DSP1 records but may not invent gameplay state.

## Milestone order

D0 — source truth synchronization
DSP1 — pure world presentation read model
D1 — world readability
D2 — unified {kind,id} selection and deterministic hit resolution
D3 — authority-driven Adventure journey feedback
D4 — render registry, viewport culling and LOD
D5 — visualKey asset resolver and sprite adoption
D6 — desktop/mobile/public visual proof

Defeat/despawn/respawn presentation is blocked until SWA6 truth exists.

## Current acceptance

1. AGENTS, STATUS and NEXT_STEPS top overrides name the exact SWA5-merged source main.
2. Current gameplay next gate is SWA6; current parallel display gate is D0/DSP1.
3. DSP1 covers every world-object family currently admitted to the canvas depth list.
4. Legacy Shelter remains excluded because the released renderer excludes it.
5. Monster worldMonsterId, x/y, status, HP, rank, level and zone come only from world authority.
6. ENGAGED Monster HP is projected from the world entity; no duplicate HP ledger exists.
7. Selection is a read-only {kind,id} projection.
8. Same-World region projection exposes Core plus z1-z4; legacy worlds expose no Adventure zones.
9. Output ordering is deterministic and output records are immutable.
10. Creating a presentation snapshot leaves serialized simulation state byte-identical.
11. The read model contains no DOM, Math.random, Date/time or gameplay command writer.
12. npm test must include the DSP1 contract tests.
13. Exact-head Verify must be SUCCESS before this candidate is SAT.
14. UNKNOWN is never PASS.

## Explicitly deferred from this PR

- replacing the current app.mjs render loop
- unified runtime hit testing / selection migration
- camera or input refactor
- viewport culling / LOD
- sprite integration from PR #139
- combat particles / damage FX
- SWA6 defeat/despawn/respawn visuals
