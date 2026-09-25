# Game Studio Scenarios — Independent Clone World

Status: DESIGN READY / EXECUTION BLOCKED  
Reason: `game-dev` CLI is not available in the current execution environment. No software installation was performed.

This file is the canonical Game Studio scenario owner for the Independent Clone World line.

## Shared controls

Use:
- fixed seed
- fixed starting save/state
- fixed viewport/camera
- same renderer/build mode for comparisons
- sealed telemetry/capture bundle when the adapter exists

Never treat source inspection as pixel/GPU/performance proof.

## IC_SC01_SOLO_HOME_IDENTITY

Purpose: prove one Clone can be homeless, choose a personal site without Camp authority, and found a house identity.

Evidence:
- agent id
- chosen origin
- founding foundation station id
- `placedBy`
- derived `ownerId`

SAT:
- ownerId equals founding Clone id
- no separate ownership ledger
- no Camp coordinate required by personal site selection

## IC_SC02_TWO_INDEPENDENT_HOMES

Purpose: prove two Clones can own two distinct house components.

SAT:
- distinct house ids
- distinct owners
- ownership derives from founding foundation evidence
- save/load preserves the same evidence

## IC_SC03_ASSIST_WITHOUT_STEALING_HOME

Purpose: prove a helper may place later pieces without silently becoming owner.

SAT:
- helper placement is attributed to helper
- house owner remains founding foundation owner
- no duplicate house state

## IC_SC04_PERSONAL_HOME_LOOP

IC2 runtime scenario.

Trace:

```text
agentId
→ personal-home intent
→ existing Rust command/order
→ owned bag item
→ existing BUILD task
→ PLACE_STATION
→ station.placedBy
→ IC1 house.ownerId
```

Checkpoints:
1. intent belongs to subject agent;
2. Hammer requirement/equipment is personal;
3. craft order `agentId` matches subject;
4. output item enters subject bag;
5. placement uses existing validator/executor;
6. founding Foundation `placedBy` matches owner;
7. helper pieces do not steal ownership;
8. no global housing-pressure value is the reason the person wants a home.

Capture points:
- NEED_HAMMER
- CRAFT_PIECE
- first Foundation
- mid-build
- complete home

## IC_SC05_PERSONAL_HOME_SURVIVAL

IC3A scenario.

Purpose: prove a complete personal modular home becomes a real survival home.

Required evidence:
- subject agentId
- resolved personal houseId/ownerId
- REST/EAT selected target
- actual arrival/execution
- another person's house not selected as owned home merely by proximity

SAT:
- owner can use own modular home for survival destination;
- no second home registry;
- existing reservation rules remain intact.

## IC_SC06_DEFAULT_PERSONAL_AUTONOMY

IC3B scenario.

Purpose: prove a productive homeless adult starts personal-home progression without settlement housing pressure.

SAT:
- full personal-home chain can start while global capacity still has spare slots;
- no `housingCapacity`/population-buffer gate causes the decision;
- two adults may independently found distinct houses.

## IC_SC07_BIRTH_WITHOUT_GLOBAL_CAPACITY

IC3C scenario.

Purpose: prove autonomous birth no longer depends on a generic settlement-wide housing slot.

Evidence:
- parent identity
- cooldown
- retained-history capacity
- food/wood reserve
- birth event
- child lifecycle/guardian or household evidence defined by IC3C

SAT:
- birth is not blocked only because global housingCapacity is full;
- all non-housing reproduction constraints remain enforced;
- no second reproduction registry.

## IC_SC08_NO_CAMP_START

IC3D scenario.

Purpose: prove a fresh independent world can run without a mandatory Camp/Shelter.

Evidence:
- fresh world state contains no mandatory central Camp authority;
- deterministic starting positions are separated by the accepted spawn contract;
- survival tasks remain valid;
- personal-home construction works;
- Cultural Archive behavior is explicit under its replacement host contract;
- save/load preserves the world.

SAT:
- same seed replays deterministically;
- no crash/hidden Camp dependency;
- at least one productive adult survives and can found a personal home;
- no silent loss of Cultural Archive data on migrated old saves.

## Evidence classification

Until `game-dev` can run and seal these scenarios:
- static source/test evidence: available where implemented
- Game Studio process/capture evidence: UNKNOWN
- pixel/GPU/performance claims: UNKNOWN

UNKNOWN is never PASS.
