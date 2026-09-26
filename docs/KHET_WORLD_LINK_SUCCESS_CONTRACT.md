# KHET.0 — World-link success contract

Status: PREPARED. NOT APPROVED FOR WIRING.  
Base: draft [PR #123](https://github.com/nustanakritwithai/Simclone/pull/123) head `f05274bb8beb91640c1eb04ef86fae2fb99d1281` on `feature/khet-sila-rules`.  
`main` has since merged VAL3 (`ddd266de`). This preparation does not rebase, force-push, or edit VAL3 files.

## Goal

Freeze the only future seam between เขตศิลา and Simclone before any caller exists.

`docs/khet-sila.md` refused a merge until this contract existed. Writing the contract does not connect the live sim and does not approve a merge.

## What already exists

`src/khet/` computes job stats, combat, zones, and enemy monsters. It is not called from `index.html` or `src/engine.mjs`. It does not replace skill XP.

## Authority that must stay untouched

- Clone skill XP stays `agent.skills` plus `src/skill-provenance.mjs`.
- Earned XP is recorded only by `recordEarnedSkill`, and only from real productive work.
- Inheritance stays `floor(parent XP × 0.35)`.
- Teaching and reading still grant no skill XP.
- Khet `exp`, job level, shards, gear, and battle rewards are not skill XP and must not be passed to `recordEarnedSkill`.

## Non-goals

- Do not merge PR #123 from this preparation.
- Do not edit `index.html`, `src/engine.mjs`, `src/skill-provenance.mjs`, personal planning, VAL2/VAL3 projections, household, ecology, or Pages workflows.
- Do not write world nodes, stock, tasks, households, relationships, settlements, or saves.
- Monsters stay zone enemies. No tame, ranch, breed, gene, or pet.
- No second stat or damage formula. `statValue` and `damageOf` remain the only khet math.
- No walkable ขอบโคลน field, other players, or shop in this contract. A field is a later gate, after a shadow exists and a separate contract names its caller.

`saveCharacter`, `loadCharacter`, and `clearCharacter` already touch browser `localStorage` key `khet-sila-v1`. That is sandbox persistence, not world state. The sim must not call those functions.

## Future seam, specified now and not built

A later implementation gate may add exactly one read-only function in `src/khet/`, not imported by the engine:

`encounterShadow(input) -> projection | null`

The caller must pass an explicit plain object:

- zone id `z1`..`z4`
- an adventurer snapshot already produced by `src/khet` (not a Clone agent)
- an optional monster id from that zone's roster

The projection may contain only zone, monster id, enemy level, rank, and whether `canEnter` allows the zone. It must not mutate the input or any world object.

Rules for that future function:

- It must not import `src/engine.mjs`, `src/skill-provenance.mjs`, or any world writer.
- `index.html` must not import it in the same gate. UI wiring needs its own contract.
- `agent.skills` is neither an argument nor an output.
- A missing zone or a monster outside the zone uses the existing `unknown_zone` / `monster_outside_zone` failure. Do not invent a monster.
- UNKNOWN is not PASS. Until the function exists, any claim that a Clone met a khet monster is UNKNOWN.

## Acceptance of this prepared gate

1. This file states `encounterShadow` and says wiring is NOT APPROVED.
2. `index.html` and `src/engine.mjs` do not reference `src/khet` or `khet-sila`.
3. Files in `src/khet/` do not import `engine.mjs`, `skill-provenance.mjs`, or world writers.
4. `tests/khet-sila.test.mjs` still proves the locked stat vectors and combat rules.
5. No skill XP test is edited by this preparation.

## Not yet SAT

- `encounterShadow` is not implemented. Calling it is UNKNOWN, not PASS.
- Browser, Pages, and public release are out of scope.
- Merge stays forbidden until a later contract names the caller and the proof.

## After this preparation

Stop. Do not implement `encounterShadow` until asked. Do not merge #123.
