# V0.3.6 — Historical Identity Archive

Status: implementation candidate. This contract is part of the broader V0.3.5 save/history hardening roadmap and is not proof of completion.

## Why a new runtime patch

V0.3.5 made death facts trustworthy but retained dead and living people in the same `agents` array. That made the old 200-record safety limit double as a birth stop. V0.3.6 separates active simulation entities from retained historical identity and uses a new module pin so browsers cannot reuse the V0.3.5 runtime from cache.

```text
Engine/UI: 0.3.6
World save schema: 0.2.0
Historical lifecycle schema: historyVersion 0.2.0
Storage key: simclone:world:v1
```

## Measured basis

Using the retained real V0.3.3 save fixture, the average full agent JSON record is about 1,314 UTF-8 bytes. A proposed historical identity projection retaining lineage, appearance, skills, memory, lifecycle and death evidence is about 433 bytes, roughly 67% smaller.

At that observed density, 1,000 compact records are about 433 KB before world overhead, compared with the existing 2,000,000-byte import guard. This is evidence for a bounded 1,000-identity prototype, not a claim that arbitrary user-edited strings can never approach the import limit.

## Data contract

### Active simulation

`state.agents` contains active simulation records. Valid persisted V0.3.6 state must not retain dead workers in this collection.

The gameplay population cap remains 36. The legacy-compatible structural validator may accept a higher active count up to its existing safety bound, but birth/manual CLONE never use that safety bound as the growth target.

### Historical identity

`state.historyAgents` contains compact records for deceased people. A historical record retains:

- id, name, parentId, generation
- last x/y and needs values needed by the existing inspector
- `alive:false` and stable death record
- permanent appearance and preference
- skills, source, memory and workDone
- bornTick and lifecycle anchor

It must not retain active execution state such as `task`, `trace` or `moveTick`.

`people(state)` is the authoritative read helper for identity/history lookup. `personById(state,id)` resolves either an active or archived person. Simulation loops still use active agents only.

## Archive transition

A death transition still records death evidence and the death event first. Before the same tick proceeds to reservation/decision work, every newly dead record moves from `agents` to `historyAgents`.

This guarantees:

- dead people cannot execute or reserve work
- event/memory evidence is retained before compaction
- identity and lineage remain resolvable
- active iteration cost does not grow with every historical death

## Reproduction / limits

`maxPopulation=36` remains the living gameplay cap.

A separate retained-identity limit is introduced:

```text
maxRetainedAgents = 1000
```

Birth and manual CLONE stop before creating identity 1001 and report history capacity as the reason. Death never deletes identity to make room; it only moves an existing identity from active to archive.

Autonomous-birth pacing and parent selection must read both active and archived autonomous children, so archiving cannot reset global birth gap, parent history or deterministic selection.

## Migration

### From historyVersion 0.1.0

- preserve existing death records exactly
- create `historyAgents`
- move all dead records from `agents` into compact historical records
- keep living agent records active
- preserve IDs, parent links, generation, appearance, skills, bornTick, lifecycle and death evidence

### From old 0.2.0 saves without historyVersion

First perform the V0.3.5 evidence-based death migration, then archive dead records. Missing evidence remains `legacy-unknown`.

### From legacy world schema 0.1.0

Keep the existing load-time lifecycle adoption rule, perform evidence-based death migration, then archive. The load-time age-18 anchor remains non-evidence for a historical death age.

## Definition of Done

1. New deaths leave no dead worker record in `agents` after the tick and create exactly one compact historical identity.
2. Archived identity/death facts remain stable across later ticks and save/load.
3. Parent links resolve across active/archive boundaries; autonomous-child history still contributes to reproduction history.
4. Phase-1 saves with `historyVersion=0.1.0` migrate explicitly without identity/lineage/skill drift.
5. Old no-history and world-schema-0.1.0 fixtures retain the V0.3.5 evidence/UNKNOWN rules.
6. Active gameplay cap and retained-history cap have distinct reasons and tests.
7. A 1,000-identity synthetic boundary remains below the 2 MB import guard in the tested fixture and rejects identity 1001 without deleting ancestry.
8. Existing Survival, Birth, Death, Continuity and Chromium gates pass without weakened criteria.
9. Native HTTP storage and physical Android performance remain separately UNKNOWN.

## Verification

```text
npm test
npm run test:survival
npm run test:lifecycle
npm run test:death
npm run test:continuity
python tests/ui-smoke.py
python tests/navigation-smoke.py
python tests/survival-smoke.py
```
