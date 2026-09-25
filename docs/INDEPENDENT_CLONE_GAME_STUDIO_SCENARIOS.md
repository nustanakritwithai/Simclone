# Game Studio Scenarios — Independent Clone World

Status: DESIGN READY / EXECUTION BLOCKED  
Reason: `game-dev` CLI is not available in the current execution environment. No software installation was performed.

These scenarios are the intended Game Studio evidence boundary once a project adapter is available.

## IC_SC01_SOLO_HOME_IDENTITY

Purpose: prove one Clone can be homeless, select a personal site without Camp authority, and found a house identity.

Controls:
- fixed seed
- fixed starting save/state
- fixed viewport/camera for visual capture

Evidence:
- selected agent id
- chosen home origin
- founding foundation station id
- `placedBy`
- derived `ownerId`
- rendered foundation/object id when adapter supports semantic attachments

SAT:
- ownerId equals founding Clone id
- no separate ownership ledger exists
- no Camp coordinate is required by personal site selection

## IC_SC02_TWO_INDEPENDENT_HOMES

Purpose: prove two Clones can own two distinct house components.

SAT:
- two distinct house ids
- owner A != owner B
- each home resolves through founding foundation evidence
- no shared ownership is inferred
- save/load preserves the evidence required to derive the same owners

## IC_SC03_ASSIST_WITHOUT_STEALING_HOME

Purpose: prove another Clone may later build a piece without silently becoming house owner.

SAT:
- helper placement can be attributed to helper
- house owner remains founding foundation owner
- no duplicate house state is introduced

## IC_SC04_FUTURE_PERSONAL_HOME_LOOP

Reserved for IC2:
`homeless adult → gather/craft → Hammer → pieces → PLACE_STATION → complete own home`.

This scenario must use existing Rust authorities and must not add a second crafting/material/build executor.

## Evidence classification

Until Game Studio can run and seal these scenarios:
- static source/test evidence: available
- Game Studio process/capture evidence: UNKNOWN
- pixel/GPU/performance claims: UNKNOWN

UNKNOWN is never PASS.


## IC_SC04_PERSONAL_HOME_LOOP — IC2 prepared contract

Purpose: prove one homeless productive adult can progress through a personal-home loop without settlement housing pressure owning the decision.

Expected trace:

```text
agentId
→ PERSONAL HOME intent
→ existing Rust command/order
→ owned bag item
→ existing BUILD task
→ PLACE_STATION
→ station.placedBy
→ IC1 derived house.ownerId
```

Required checkpoints:
1. initial IC2 intent belongs to the subject agent;
2. Hammer requirement/equipment is personal to that agent;
3. house-piece craft order `agentId` matches the subject;
4. completed item enters that subject's bag;
5. placement uses the existing placement validator/executor;
6. founding Foundation `placedBy` matches the intended owner;
7. IC1 `homeOf(subject)` resolves that house;
8. a helper may place later pieces without changing the founding owner;
9. save/load preserves all evidence needed to derive the same owner;
10. no `housingCapacity` or colony-population-pressure value is used as the reason the individual wants a home.

Game Studio capture plan when `game-dev` becomes available:
- fixed seed and fixed starting state;
- capture at `NEED_HAMMER`, `CRAFT_PIECE`, first Foundation, mid-build, complete-home;
- preserve telemetry with planner subject id, Rust order id, item id, placement id, station id and house id;
- visual compare only equivalent seed/camera/viewport/scenario runs.

Until a sealed Game Studio run exists, runtime/pixel claims remain UNKNOWN.
