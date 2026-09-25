# Independent Clone World — Work State

Status: ACTIVE BRANCH WORK  
Branch: `feature/independent-clone-world-ic1`  
Base: `main@df93ba3c0aff768f7c857eaefba271a6a7ac3f12`  
Canonical design: `docs/INDEPENDENT_CLONE_WORLD.md`

## Goal

Move Simclone toward individual-first simulation without merging colony-first assumptions into the new architecture.

## Completed

- IC0 canonical architecture written.
- IC1 `src/individual-housing.mjs` added as a pure projection/planning layer.
- Home ownership derives from the founding foundation's existing `placedBy` evidence.
- Personal home-site search originates from the Clone rather than Camp.
- IC1 deterministic tests cover homeless state, personal site choice, two distinct owners and ownership stability.

## Confirmed decisions

- No duplicate person/building/item ledger.
- No save-version change in IC1.
- No birth-rule change in IC1.
- No Camp removal in IC1.
- No global-stock replacement in IC1.
- Existing Rust `PLACE_STATION` remains construction authority.
- Settlement is a future emergent result, not a prerequisite in the target architecture.

## Current validation state

Candidate only. Tests have been authored but exact CI evidence is not yet recorded. UNKNOWN is not PASS.

## Next step

1. Pin the new runtime module in the import map.
2. Sync GAME_PLAN/NEXT_STEPS with the approved independent-world line.
3. Open a draft PR from this branch.
4. Use candidate CI as IC1 verification evidence; do not wait in chat for CI.
5. After IC1 SAT, implement IC2 personal autonomous home planning on the same authorities.
