# V0.3.5 Phase 2 — Historical Identity / Limits

Status: measurement + success contract. This is not proof that Phase 2 is implemented.

## Problem

The current engine keeps every historical person in `state.agents` and uses `state.agents.length >= 200` as a birth/clone gate. That couples retained ancestry to active simulation capacity: after enough deaths, new life stops even when living population and housing are below their limits.

Phase 2 must separate these meanings without deleting ancestry and without solving the problem by only raising 200.

## Success contract

1. Active simulation limits and retained historical identity limits are distinct concepts.
2. Dead history may be compacted or archived only if these facts remain resolvable: id, parentId, generation, appearance, bornTick, birth-origin semantics, death history, and lineage data needed by deterministic reproduction pacing/cooldown.
3. A dead identity must never consume an active-worker slot.
4. Hitting a retained-history/storage boundary must have an explicit bounded failure mode. No silent ancestry deletion, parent relinking, resurrection, age rewrite, or hidden demographic repair.
5. Existing 0.1.0 and 0.2.0 saves must migrate explicitly. Unknown historical facts remain UNKNOWN.
6. Save/restore continuation and birth pacing stay deterministic.
7. V0.3.4 continuity and V0.3.5 death-history regressions must remain unchanged.

## Measurement gate before choosing storage structure

Run `node scripts/history-limit-baseline.mjs` against the exact candidate SHA. Record, per seed:

- first simulated year in which retained agents reach 200
- living population at the boundary
- births before and after the boundary observation window
- serialized save bytes at the boundary
- wall-clock time for the run
- `birthPlan(...).reason`

This script intentionally measures the current limitation; it is not a release proof.

## Architecture decision gate

Do not choose archive shape until the measurements exist. Candidate options must be compared on:

- deterministic lookup cost by identity id
- reproduction lineage/cooldown queries
- save size growth
- migration complexity
- browser inspector/history resolution
- bounded capacity behavior

The selected structure must have a regression that reaches the old 200-history boundary while living population remains below the active cap and proves that history alone no longer blocks a valid birth.

## Definition of Done

- old 200-history boundary regression is SAT
- ancestry across archived/retained deaths resolves correctly
- reproduction pacing/cooldown sees historical autonomous births
- save validation accepts the new structure and rejects malformed history
- save/load continuation is byte-deterministic after normalization/migration
- measured save-size/runtime evidence is committed
- existing unit, survival, birth, death, continuity and browser suites remain SAT
- native HTTP localStorage and physical Android remain separately reported, never inferred from offline tests
