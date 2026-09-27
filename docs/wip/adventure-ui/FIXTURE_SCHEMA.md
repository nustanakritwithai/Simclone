# Adventure UI Fixture / Read-Model Schema

Purpose: define the minimum presentation contract Agent H can consume when implementing production UI later.

This file defines a UI read model, not simulation authority.

## Root object

Required sections:

- meta
- adventurer
- hud
- encounter
- loot
- equipment
- regions

## meta

- fixtureVersion: string
- readOnly: boolean; prototype is true
- canonical: boolean; prototype is false
- note: string

Production must not use prototype fixture values as canonical content.

## adventurer

Required:

- id: stable clone/adventurer id
- name: display name
- profession: string
- specialization: string or null
- level: number
- exp.current: number
- exp.nextLevel: positive number
- hp.current: number
- hp.max: positive number
- stats.ATK
- stats.DEF
- stats.SPATK
- stats.SPDEF
- stats.SPD
- knownZones: array of zone ids
- currentExpedition.zoneId
- currentExpedition.label
- currentExpedition.objective
- currentExpedition.progressLabel
- currentExpedition.status

Canonical combat vocabulary is uppercase Core6-style naming where applicable: HP, ATK, DEF, SPATK, SPDEF, SPD.

## hud

skills is exactly the display snapshot for three skill buttons in this prototype.

Each skill row:

- slot: 1 | 2 | 3
- label: string
- availability: presentation state supplied by runtime

The UI must not derive cooldown, cost, legality, or success.

## encounter

Required display snapshot:

- encounterId
- cloneId
- monster.monsterId
- monster.name
- monster.types[]
- monster.level
- monster.rank
- monster.hp.current
- monster.hp.max
- feedback[]

Each feedback item:

- label
- detail
- value

Feedback is already-resolved presentation data. UI does not recalculate combat outcome.

## loot

Reward proposal/result display:

- sourceMonsterId
- outcomeId
- items[]
- canContinue

Each item:

- itemKind
- quantity
- rarity

Production inventory authority must separately accept/reject committed rewards. Rendering this object must not grant an item.

## equipment

slots must expose exactly:

- weapon
- armor
- accessory

Each equipped slot:

- itemId
- name
- levelLabel

Candidate:

- itemId
- slot
- name

Comparison:

- before.ATK / DEF / SPATK / SPDEF / SPD
- after.ATK / DEF / SPATK / SPDEF / SPD

Upgrade preview:

- itemName
- fromLabel
- toLabel
- costLabel
- statPreview

The UI may calculate a visual delta from supplied before/after values. It must not calculate authoritative equipment stats or perform an upgrade.

## regions

Exactly four baseline entries are expected for this prototype:

- z1: Lv.1–15
- z2: Lv.16–30
- z3: Lv.31–45
- z4: Lv.46–60

Each region:

- zoneId
- name: string or null
- minLevel
- maxLevel
- known: boolean
- summary: string or null

Unknown rule:

If known is false, production UI should hide name/content even if accidental extra data is present. Never convert a displayed recommendation into an unlock assertion.

## Recommended production adapter boundary

Runtime/domain authorities
→ immutable AdventureUiSnapshot
→ UI renderer

User input
→ typed intent
→ approved runtime command layer

The UI renderer is never an authority writer.

## Forbidden implementation shortcuts

Agent H should not make this prototype schema write to:

- world state
- combat HP
- profession/career
- EXP/level
- loot inventory
- equipment inventory
- upgrade ledger
- zone discovery/unlock
- save data

Do not use localStorage as substitute authority.
Do not use Math.random or Date/time to invent gameplay state.
