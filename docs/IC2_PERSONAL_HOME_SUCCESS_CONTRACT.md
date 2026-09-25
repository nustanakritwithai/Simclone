---
type: success-contract
project: Simclone
domain: simulation
feature: Independent Clone World IC2
status: active
canonical: true
owner: Project Brain
validation: implementation-candidate
last_reviewed: 2026-09-26
---

# IC2 — Personal Autonomous Home Planning

## Objective

A homeless productive adult must be able to derive a deterministic personal-home plan for **their own** house without reading settlement housing pressure and without introducing a second crafting, material, item, or placement authority.

IC2 keeps **decision intent** separate from **execution**. The pure planner remains read-only; a bounded coordinator may consume one intent and delegate mutations only to existing Rust/engine authorities.

```text
Personal state
→ pure home-plan intent
→ existing Rust command authority
→ existing scheduler/task execution
→ existing PLACE_STATION
→ IC1 evidence-derived ownership
```

## Scope

The IC2 planner owns only the question:

> "What is the next valid step for this person toward their own home?"

The planner does not mutate world state.

The IC2 coordinator is a separate consumer:
- active only when full RP1 is explicitly enabled;
- selects one unresolved productive person deterministically;
- may issue existing `CRAFT_ITEM` / `EQUIP_ITEM` commands for that person;
- never places a structure directly;
- `PLACE_PIECE` becomes an existing engine BUILD task and reaches the existing `PLACE_STATION` executor;
- default housing-only autonomy remains the legacy settlement-pressure path until IC3.

### Planned intent states

| Intent | Meaning | Future executor |
|---|---|---|
| `HOME_COMPLETE` | Person already owns a complete home | none |
| `NO_SITE` | No legal personal site is currently available | none / re-evaluate |
| `NEED_HAMMER` | Person has no Hammer | existing craft chain |
| `EQUIP_HAMMER` | Hammer is in personal bag but not equipped | `EQUIP_ITEM` |
| `NEED_MATERIALS` | Next house piece cannot currently be afforded | existing survival/resource work |
| `CRAFT_PIECE` | Person can order the next required piece | `CRAFT_ITEM` |
| `PLACE_PIECE` | Required piece is in that person's bag | existing BUILD task → `PLACE_STATION` |

## Normative rules

1. The subject is exactly one living productive person.
2. Home identity and site come from IC1 `homeOf` / `personalHomeSite`.
3. A person's plan must never choose another person's house as their own.
4. A piece in another person's bag does not satisfy this person's `PLACE_PIECE`.
5. Hammer ownership/equipment is personal.
6. The planner may read current authoritative shared stock in IC2 because personal material economy is a later milestone; it must not create a new material ledger.
7. The planner must not use:
   - `housingCapacity(world)`
   - settlement population pressure
   - Camp distance
   - RP1 global `goal` as the person's home identity
8. The planner is pure: serialize-before == serialize-after.
9. Children/stage-ineligible people return no executable home plan.
10. Existing Rust validation remains final authority. A planner intent is never proof that execution will succeed.

## Dependency boundary

IC2 depends on IC1:
- derived owner identity
- personal site selection
- next personal home piece

IC2 reuses:
- `ITEM_CATALOG`
- `RECIPE_CATALOG`
- Rust personal bag/equipment
- existing shared stock (temporary migration compatibility)
- lifecycle productive-work eligibility

## Explicit exclusions

IC2 does not:
- change default housing-only autonomy;
- alter birth rules;
- remove Camp;
- remove global stock;
- add household/resident state;
- change save version;
- add a second crafting/material/item/build executor;
- add UI;
- add Game Studio adapter software.

## Acceptance

### Deterministic unit evidence

- A homeless adult with no Hammer → `NEED_HAMMER`.
- Hammer in own bag but not equipped → `EQUIP_HAMMER`.
- Equipped Hammer + enough materials → `CRAFT_PIECE`.
- Required piece in own bag → `PLACE_PIECE`.
- Same piece only in another person's bag does not count.
- Completed owned home → `HOME_COMPLETE`.
- Planner call performs zero world mutation.
- Two people at different locations resolve independent sites/home intents.
- Stage-ineligible person produces no executable plan.

### Future runtime evidence

Game Studio scenario `IC_SC04_PERSONAL_HOME_LOOP`:

```text
homeless adult
→ personal plan
→ Hammer
→ Foundation
→ Walls
→ Doorway
→ Roof
→ complete owned home
```

Required correlation:
- planner subject agentId
- Rust order agentId
- item location agentId
- placement `placedBy`
- derived IC1 `ownerId`

All must refer to the expected person except explicitly logged helpers.

## Gate

IC1 is SAT and merged.

IC2 is a candidate only until:
- pure planner tests pass;
- coordinator-to-Rust command tests pass;
- personal placement ownership tests pass;
- existing regressions remain green;
- exact candidate CI is SAT.

Game Studio runtime/pixel evidence remains UNKNOWN while `game-dev` is unavailable.

UNKNOWN is never PASS.
