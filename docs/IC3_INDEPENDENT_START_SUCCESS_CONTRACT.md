---
type: success-contract
project: Simclone
domain: simulation
feature: Independent Clone World IC3
status: active
canonical: true
owner: Project Brain
validation: prepared
last_reviewed: 2026-09-26
---

# IC3 — Independent Start / No Mandatory Central Village

## Product decision

The target game is individual-first.

A Clone must not require membership in a central village to exist, survive, choose a home, or build a home.

Settlement is an emergent result of people, homes, relationships and cooperation.

## Runtime audit — current blockers

Current runtime still contains four settlement-first dependencies:

1. **Fresh world creation**
   - `createWorld()` seeds a completed Camp and legacy Shelter.
   - six starting people are placed around the shared camp area.

2. **Rest / eating destination**
   - current decision candidates derive `home` from completed `s.buildings`.
   - modular IC1 personal homes are not yet the authoritative REST/EAT destination.

3. **Autonomous birth**
   - `birthPlan()` uses global `housingCapacity(world)`.
   - population growth is therefore still gated by settlement-wide capacity.

4. **Cultural Archive**
   - archive creation, validation, publication range and reading are bound to a completed Camp building.

These are implementation dependencies, not reasons to keep the settlement-first design.

## Migration strategy

IC3 is split into four gates. Do not remove Camp in one patch.

### IC3A — Personal home becomes a real survival home

Goal:
- a complete IC1 personal modular home may be selected as that owner's REST/EAT destination;
- another person's home must not automatically become the subject's home;
- legacy Camp/Shelter may remain compatibility fallback until later gates.

Required proof:
- owner rests/eats at owned modular home;
- stranger does not inherit home ownership through proximity;
- no new home ledger;
- save/load and existing survival reservations remain valid.

### IC3B — Personal home need becomes default autonomy

Goal:
- productive homeless adults pursue their own home without waiting for global population/housing pressure;
- IC2 coordinator becomes the default personal-home path;
- legacy settlement-pressure housing is no longer the reason a new personal home starts.

Required proof:
- fresh eligible adult with no complete home produces a personal-home plan;
- two adults can independently found distinct homes;
- no `housingCapacity` value is used to decide whether an adult needs a personal home;
- existing Rust material conservation remains exact.

### IC3C — Birth no longer depends on settlement-wide housing capacity

Target rule:
- autonomous birth must not be authorized by a generic global +6 housing slot;
- birth remains paced, resource-bounded, lineage-safe and retained-history-safe;
- a child may initially reside with parent/guardian;
- independent-home execution remains stage-gated; children do not build an adult home.

This gate must define guardian/household semantics before removing the old capacity check.

Required proof:
- birth eligibility is not blocked only because global `housingCapacity` is full;
- birth still respects food, wood, cooldown, retention and max-population constraints;
- child lifecycle remains deterministic;
- no second reproduction registry.

### IC3D — Fresh independent world with no mandatory Camp

Goal:
- new-world state does not require a central Camp or legacy Shelter;
- starting people/Original use deterministic separated spawn rules rather than a camp cluster;
- no survival, building or birth rule depends on Camp existence.

Important dependency:
- Cultural Archive requires a new explicit host contract before Camp can be removed from fresh worlds.
- old saves containing Camp/Shelter remain migration-compatible; no destructive cleanup.

Required proof:
- fresh independent world boots and advances with no Camp;
- at least one adult survives and can found a personal home;
- no UI/runtime crash from missing Camp;
- Cultural Archive behavior is explicit (new host, unavailable-until-host, or migrated owner) and never silently lost;
- deterministic same-seed replay;
- save/load continuation;
- public/native browser evidence separate from offline fixture evidence.

## Source-of-truth boundaries

Reuse existing owners:
- identity/lifecycle → engine + lifecycle modules
- home ownership → IC1 evidence-derived foundation owner
- personal home intent → IC2 pure planner
- crafting/items/stations → Rust authorities
- physical placement → existing BUILD task + PLACE_STATION
- birth lineage/history → reproduction/history
- knowledge → existing personal/cultural provenance

Do not add:
- village membership registry merely to replace Camp;
- second housing ledger;
- second inventory/material ledger;
- second reproduction registry;
- UI-owned simulation rules.

## Game Studio evidence plan

Canonical scenario definitions live in:
`docs/INDEPENDENT_CLONE_GAME_STUDIO_SCENARIOS.md`

IC3 uses:
- `IC_SC05_PERSONAL_HOME_SURVIVAL`
- `IC_SC06_DEFAULT_PERSONAL_AUTONOMY`
- `IC_SC07_BIRTH_WITHOUT_GLOBAL_CAPACITY`
- `IC_SC08_NO_CAMP_START`

Game Studio process/pixel/performance evidence remains UNKNOWN while `game-dev` is unavailable.

## Gate

IC3 runtime implementation must not begin by deleting Camp.

Order:
`IC3A → IC3B → IC3C → archive-host decision → IC3D`.

Each gate uses SAT / VIOL / UNKNOWN. UNKNOWN is never PASS.
