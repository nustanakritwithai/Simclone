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
