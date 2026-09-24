# V0.3.5 — Death History + Save Hardening

Status: implementation candidate. This document is a success contract, not proof of completion.

## Scope

V0.3.5 freezes the historical facts of a death without changing survival balance, birth pacing, lineage semantics, skill inheritance, or the existing `version: 0.2.0` world save schema identifier.

A new explicit historical-lifecycle sub-schema is introduced:

```text
historyVersion = 0.1.0
```

This is intentionally separate from `SAVE_VERSION`. Existing 0.1.0 and 0.2.0 worlds must pass an explicit migration before validation; the migration may add historical metadata but must not invent facts that cannot be supported by retained evidence.

## Death record contract

Living agents carry:

```js
death: null
```

A death created by V0.3.5 records exactly once:

```js
death: {
  status: "recorded",
  tick: <integer simulation tick>,
  cause: "age" | "starvation",
  ageYears: <integer biological age at that tick>
}
```

Historical saves may instead contain:

```js
death: {
  status: "legacy-evidence" | "legacy-unknown",
  tick: <integer | null>,
  cause: "age" | "starvation" | "unknown",
  ageYears: <integer | null>
}
```

`legacy-evidence` means at least one field was reconstructed from retained death event/memory plus lifecycle data that already existed in that save. `legacy-unknown` means the repository does not have enough retained evidence. Null is required instead of guessing.

## Stable-age rule

For a living agent, age is derived from lifecycle anchor + current simulation tick as before.

For a dead agent:

- return recorded/migrated `death.ageYears` when known;
- return UNKNOWN/null when age-at-death is not evidenced;
- never let displayed death age increase as the world clock advances;
- never substitute deterministic lifespan for age-at-death.

## Migration rules

### From save 0.2.0

1. Preserve world clock, identity, lineage, appearance, skills, resources, tasks for living agents, and all retained events/memory.
2. Add `historyVersion=0.1.0`.
3. Living agents receive `death:null`.
4. Dead agents search retained global death events first, then their retained memory.
5. When a death tick is evidenced and lifecycle data already exists, age-at-death may be derived at that historical tick.
6. If evidence is incomplete, store the known subset and leave the rest null/unknown.

### From legacy save 0.1.0

The existing lifecycle adoption rule remains: living legacy agents start lifecycle at age 18 at the load tick. Death history is migrated separately.

For agents already dead in a 0.1.0 save, the new lifecycle anchor created at load is NOT evidence of their historical age-at-death. A retained death event/memory may establish tick/cause, but age remains null unless the historical text itself explicitly contains a trustworthy age.

## Invariants

- Death record is written once; later ticks do not rewrite it.
- Starvation and age death share cleanup: `alive=false`, `hp=0`, `task=null`, `moveTick=0`.
- Dead agents hold no task-derived reservation.
- Identity, parent link, generation, appearance, bornTick, skill XP and autonomous-birth origin semantics remain unchanged.
- Birth pacing/cooldown stays derived from retained lineage + bornTick.
- No resurrection, age reset, demographic repair, resource injection, or balance change is part of this milestone.
- Corrupt/unreadable browser saves remain protected exactly as before.

## Definition of Done

1. Regression proves age death stores tick/cause/age once and age does not drift after additional years.
2. Regression proves starvation death stores tick/cause/age once and cleanup remains intact.
3. Real retained V0.3.3 / save-0.2.0 fixture migrates without identity/lineage/skill drift.
4. Legacy 0.1.0 migration does not invent death age.
5. Missing historical evidence is represented as `legacy-unknown`, not a guessed value.
6. Save/load continuation is deterministic after migration.
7. Existing Survival, Birth, Death and 120-year Continuity gates are not weakened.
8. Browser inspector distinguishes recorded age-at-death from unknown historical age.
9. Native HTTP localStorage and physical Android performance remain UNKNOWN until separately exercised.

## Verification plan

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

Candidate evidence must be tied to the exact branch SHA. V0.3.5 is not a release until the exact candidate and exact main deployment gates pass.
