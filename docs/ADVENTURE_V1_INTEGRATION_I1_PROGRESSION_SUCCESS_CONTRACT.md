# Adventure V1 Integration I1 — Adventure Progression Authority

Status: CANDIDATE. MERGE NOT APPROVED.  
Parent: I0 exact head `83cdc135b160472d7aa7785d5a77fc1c9c5ba0bb` with Verify SUCCESS #1433.

## Goal

Add one canonical Adventure progression skill to Simclone without creating a parallel XP ledger.

Authority:
```text
agent.skills.ADVENTURE
+ agent.skillProvenance.bySkill.ADVENTURE
→ derived Adventure Level 1..60
```

There is no `adventureXP`, `khetXP`, character-side XP, or UI-owned progression.

## Level curve

Adventure uses the same square-root family as the existing Simclone skill curve, extended to Lv.60:

```text
XP floor for level L = 20 × (L − 1)^2
Level(XP) = min(60, 1 + floor(sqrt(XP / 20)))
```

Lv.1 begins at XP 0. Lv.60 begins at XP 69,620.

## Scope

I1 may:
- add `ADVENTURE` as a non-productive skill authority,
- add its provenance bucket,
- derive Level 1–60 read-only,
- initialize fresh Independent Clones at XP 0,
- inherit 35% from the parent using the existing Clone inheritance policy,
- migrate existing Independent saves missing this new skill to XP 0 without guessing historical Adventure work,
- validate exact XP/provenance equality.

I1 must not:
- add ADVENTURE to the four productive `SKILLS` list or job preferences,
- award XP from EXPLORE qualification,
- award combat XP,
- infer XP from career/history/old Khet saves,
- create reward replay state,
- change CombatStats,
- write HP, inventory, loot, zone, position, or UI state.

## Why no reward yet

ADV0 qualification evidence answers “has this Clone completed enough real exploration to become an Adventurer?”

Adventure XP answers “what verified Adventure outcomes has this Clone earned progression from?”

They are intentionally separate. I1 establishes the progression authority only. I4 will admit VERIFIED reward writes with explicit replay/idempotency evidence. UNKNOWN grants nothing.

## Save/migration

- Fresh Independent agents always contain `skills.ADVENTURE`.
- Existing Independent saves that predate I1 and have no Adventure skill gain XP 0 plus a zero-valued provenance bucket.
- Existing values are never guessed from EXPLORE, profession, career, Khet, or monster state.
- A save whose Adventure XP conflicts with provenance is corrupt and must be rejected, not silently repaired.

## Acceptance

1. Productive `SKILLS` remains exactly FORAGE/WOODCUT/MINE/BUILD.
2. Fresh Independent Original has Adventure XP 0 / Lv.1 with provenance total 0.
3. A new Clone inherits floor(parent Adventure XP × 0.35) through existing provenance.
4. Old Independent save migration is deterministic and does not invent XP.
5. XP/provenance mismatch is rejected.
6. ADV0 EXPLORE completion still grants no Adventure XP.
7. Existing I0 and project regressions remain SAT.
8. Exact-head Verify must succeed. UNKNOWN is not PASS.
