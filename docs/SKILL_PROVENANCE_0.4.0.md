# V0.4.0 — Skill Provenance

Status: implementation contract. This document is not release proof.

## Donor pattern

This milestone borrows the **provenance/evidence discipline** from AstraLife structured memory/belief work, not its provider/LLM runtime. Simclone remains deterministic and engine-authoritative.

The rule is:

```text
Current Skill XP
= Initial XP
+ Inherited XP
+ Earned XP
+ Legacy-unattributed XP
```

Every newly created XP source must be attributable to evidence. Old saves are never reverse-engineered into a fictional history.

## Scope

Keep the existing four skill families only:

- FORAGE
- WOODCUT
- MINE
- BUILD

No mentor teaching, cultural knowledge, new skill families, faction system or LLM is part of this release.

Runtime target:

```text
Engine/UI: 0.4.0
Save schema: 0.4.0
Skill provenance schema: 0.4.0
Archive/history semantics: retained from 0.3.6
Storage key: simclone:world:v1
```

## Per-skill provenance

Each person carries:

```js
skillProvenance: {
  version: "0.4.0",
  bySkill: {
    FORAGE: {
      initialXP,
      inheritedXP,
      earnedXP,
      legacyUnattributedXP,
      evidence: [...]
    },
    WOODCUT: {...},
    MINE: {...},
    BUILD: {...}
  }
}
```

For every skill:

```text
initialXP + inheritedXP + earnedXP + legacyUnattributedXP === skills[skill]
```

### Evidence

Evidence entries are bounded and explain structural origin plus the latest productive outcome. The authoritative XP counters remain exact even when older work evidence is compacted:

```js
{
  id,
  kind: "initial" | "inheritance" | "work",
  xp,
  tick,
  sourceAgentId,
  action,
  targetId
}
```

The summary counters are authoritative. Each skill keeps at most 2 evidence records: one structural `initial`/`inheritance` record when applicable, plus the latest `work` record. Trimming older work evidence must never change XP totals. This bound is required because provenance is retained across historical identities.

## New-world rules

### Original

The Original's starting XP is `initialXP` with `kind:"initial"` evidence at its birth tick.

### Manual Clone / Autonomous Birth / initial descendants

The child still receives exactly:

```text
floor(parentSkillXP × 0.35)
```

That amount is recorded as `inheritedXP` with:

- sourceAgentId = parent.id
- tick = child bornTick
- kind = inheritance

This remains inheritance, not teaching.

## Earned XP

Existing balance remains unchanged: successful productive work awards +5 XP.

The +5 is recorded only when the existing engine already awards XP from a real outcome.

- zero-output gather: no XP and no work evidence
- completed BUILD: +5 BUILD XP with work evidence
- successful gather: +5 matching skill XP with work evidence

Evidence records the simulation tick, action and target when available.

## Legacy migration

### From save 0.3.0

Existing XP has no exact historical split between inherited and earned XP. Therefore every existing skill XP becomes:

```text
legacyUnattributedXP = current XP
```

All other buckets start at zero.

Do **not** infer inherited XP from the parent's current XP. Parent XP may have changed after the child was born.

### From save 0.2.0 / 0.1.0

Run the existing lifecycle/death/archive migration first, then assign current XP to `legacyUnattributedXP`.

The migration must preserve identity, lineage, appearance, lifecycle, death evidence, archive membership and current skill values.

## Historical Identity

Archive compaction must preserve `skillProvenance` exactly.

A dead/archived parent remains resolvable as the sourceAgentId of inheritance evidence.

## Inspector

The Skills tab must expose, per skill:

- current XP / level
- inherited XP
- earned XP
- initial XP or legacy-unattributed XP when non-zero
- latest provenance evidence in bounded form

The UI must not call inheritance "teaching".

## Definition of Done

1. Original starting skills are attributed to initial evidence.
2. Manual and autonomous children record exact inherited XP from the parent at creation.
3. Successful work adds +5 to both skill XP and earnedXP exactly once.
4. Zero-output work adds neither XP nor evidence.
5. For every person and skill, provenance bucket sum equals current XP.
6. Save 0.3.0 migration marks existing XP legacy-unattributed instead of guessing.
7. Legacy 0.2.0/0.1.0 migrations still preserve lifecycle/death/history contracts.
8. Provenance survives parent death, archive compaction and save/load.
9. Inspector explains skill origin without claiming mentor teaching.
10. Existing Survival/Birth/Death/Continuity/History and browser gates remain green.

## Verification

```text
npm test
npm run test:survival
npm run test:lifecycle
npm run test:death
npm run test:continuity
npm run test:history
python tests/ui-smoke.py
python tests/navigation-smoke.py
python tests/survival-smoke.py
```


## Storage budget note

Historical Identity 0.3.6 used a 1,000,000-character archive budget before per-skill provenance existed. V0.4 raises the archive-only character budget to 1,800,000 while keeping the whole-save guard at 2,000,000 characters. The evidence ring is reduced to two records per skill so provenance cannot grow linearly with every successful work action. The retained-identity count remains 1024 and may still be blocked earlier by the finite archive/save budget; no unlimited-history claim is made.
