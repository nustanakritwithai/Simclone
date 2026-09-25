# IC3 — Independent Start Work State

Status: PREPARED / NOT ACTIVE  
Branch: `feature/independent-clone-world-ic3-prep`  
Stacked from IC2 candidate head: `9246f38e6f2e202caeb0de8c4b2ed9353577b612`  
Canonical contract: `docs/IC3_INDEPENDENT_START_SUCCESS_CONTRACT.md`

## Goal

Remove the central-village prerequisite safely, without deleting compatibility data or bypassing existing authorities.

## Runtime audit findings

- `createWorld()` still creates Camp + legacy Shelter and clusters the initial population.
- EAT/REST still derives a shared `home` from completed `s.buildings`.
- autonomous birth still gates on global `housingCapacity(world)`.
- Cultural Archive is still hosted/validated by a Camp building.

## Prepared sequence

1. **IC3A — Personal survival home**
   - owned modular home becomes REST/EAT destination.
2. **IC3B — Default personal-home autonomy**
   - homeless productive adults no longer wait for global housing pressure.
3. **IC3C — Birth independence**
   - remove global capacity as birth authorization after guardian/household semantics are explicit.
4. **Archive host decision**
   - replace Camp-only archive ownership before deleting Camp from fresh worlds.
5. **IC3D — No-Camp fresh start**
   - deterministic separated start, no mandatory Camp/Shelter.

## Explicit non-actions

This prep branch does not yet:
- remove Camp;
- change fresh-world starting population or positions;
- alter birth;
- alter EAT/REST;
- change save version;
- change Cultural Archive authority;
- change IC2 candidate runtime.

## Validation state

Design/runtime-audit preparation only. No IC3 runtime claim is SAT.
Game Studio execution remains UNKNOWN while `game-dev` is unavailable.
