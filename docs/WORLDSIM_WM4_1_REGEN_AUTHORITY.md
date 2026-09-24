# WM4.1 — Resource Regeneration Authority Parity Gate

This is the first real Resource Authority transfer.

## What moves

The writer for existing-node regeneration moves from inline Simclone engine code to:

`applyWorldResourceRegeneration(state)`

owned by the WorldSim integration module.

## What must NOT change

Behavior remains exactly:

- food: +3 every 120 ticks, capped at node.max
- wood: +1 every 720 ticks, capped at node.max
- stone: 0 regeneration

Write order remains food first, then wood.

No ecology multiplier, climate modifier, soil modifier, hydrology modifier or vegetation modifier is authoritative in WM4.1.

## State / persistence

No new save fields.
No new scheduler state.
No node identity changes.
No spawn/despawn authority.
No stock changes beyond the same historical regeneration.

## Verification contract

The WorldSim function is compared against a literal legacy oracle across ordinary and boundary ticks. Existing Survival, birth, death, history-continuity and browser gates must remain SAT.

Only after parity is proven may a later gate make **food** regeneration ecology-sensitive. Wood follows separately. Stone remains finite unless a separate geology design explicitly changes that contract.
