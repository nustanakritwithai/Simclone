# ADV4 — Wild Monster Data Success Contract

Status: CANDIDATE / DRAFT PR ONLY. MERGE NOT APPROVED.

## Scope

ADV4 owns only deterministic Wild Enemy definitions and Pocket-compatible level stat projection for Adventure Mode.

Owned files:

- src/adventure-monsters.mjs
- src/adventure-monster-stats.mjs
- tests/adventure-monsters.test.mjs
- docs/ADV4_WILD_MONSTER_SUCCESS_CONTRACT.md

Forbidden in this gate:

- src/engine.mjs
- index.html
- combat resolver
- zone or encounter writer
- loot writer
- Simclone agent state
- capture / throw / ranch / bond / breeding / egg / party / owned-monster / monster-inventory / monster-save-instance / genes progression

No Math.random or wall-clock Date may be a gameplay rule.

## Verified source inputs

Simclone branch base:

- main@5ddb4e00062100f025847ad0cbd0d14e01c421ff

Pocket Monster donor:

- repo nustanakritwithai/PocketMonster
- main@f7f243d21906d9fa26127529313b441b4b938ce0
- monster-stat-contract.mjs
- monster-stat-catalog.mjs
- monster-stat-formula.mjs
- type-catalog.mjs
- combat-v91-contract.mjs
- combat-v91-stat-projection.mjs
- docs/combat-v91-client-handoff.md

Grok/Khet donor:

- Simclone PR #123, feat(khet): add separated adventurer rules
- read-only donor for separated wild-enemy/adventure concepts
- no merge or cherry-pick of Khet character architecture

## Canonical data contract

The catalog is exactly:

- 18 species families
- 2 stages per family
- 36 Wild Enemy forms
- canonical Pocket runtime types; donor source LIGHT is represented as runtime Fairy
- Pocket Core6 base stats: hp, atk, def, spAtk, spDef, spd
- Pocket baseExpYield
- Pocket rarity: Common, Uncommon, or Rare

Each exported definition has exactly these fields:

- monsterId
- speciesId
- formId
- stage
- types
- baseStats
- baseExpYield
- rarity

monsterId and formId intentionally use the same canonical Pocket form id (MON_001 through MON_036) so Simclone does not invent a second form identity. speciesId is the Pocket runtime family id shared by its two stages.

The data model intentionally does not copy donor capture rate, bond, evolution requirement, growth ownership, party, ranch, breeding, genes, instance-save, or inventory fields.

## Level-stat contract

monsterStatsAtLevel(id, level) supports integer level 1..60 only.

ADV4 preserves Pocket Monster stat formula v1 with Wild Enemy fixed defaults:

potential = 15
training = 0

Stat value:

floor(((2 * base + potential + training / 4) * level) / 100)
+ (HP ? level + 10 : 5)

This gate does not create Wild Enemy training, genes, ownership, or persistent progression state. Same definition + same level must always produce the same result.

## Required API

- monsterDefinition(id)
- monsterStatsAtLevel(id, level)
- validateMonsterCatalog()
- allWildMonsterForms()

Unknown ids and invalid levels fail closed; they do not invent a monster or clamp silently.

## Acceptance / proof

ADV4 is SAT only when the exact branch candidate proves all of the following:

1. catalog has exactly 36 rows, 18 family ids, and stages 1+2 for every family;
2. all monsterId and formId values are unique;
3. all definitions contain valid positive safe-integer Core6 base stats;
4. all 18 canonical runtime types are represented and LIGHT does not leak as a runtime type;
5. exact donor base stats, rarity, and base EXP are covered by an explicit expected-row test;
6. all 36 forms calculate deterministic valid stats at every integer level 1 through 60;
7. same input produces deep-equal output;
8. no ownership/capture progression fields are exported;
9. no Math.random, Date.now, or new Date exists in the owned gameplay modules;
10. only the four owned files change against the branch base;
11. PR remains Draft and is not merged.

Verification states are SAT, VIOL, UNKNOWN. UNKNOWN is never PASS.
