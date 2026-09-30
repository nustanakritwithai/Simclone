# Pose Studio — Profession Motion Profiles V1

Status: **CANDIDATE / NOT PRODUCTION SAT**

Baseline: `87ab8616c57a104e548056ae26e9bb30d5a79d3d` after PR #226 forward-lean hotfix.

## Goal

Give each released productive profession a distinct presentation identity without creating another rig, movement authority or gameplay state.

## Profiles

- Forager → FORAGE
- Woodcutter → WOODCUT
- Miner → MINE
- Builder → BUILD
- Crafter → CRAFT / PROCESS
- Merchant → INSPECT / TRADE
- Adventurer → HUNT / ATTACK / GUARD / VICTORY

Shared locomotion remains:

- IDLE
- WALK
- RUN
- JUMP
- FALL
- LAND
- CROUCH
- HIT

## Ownership

`character-profession-motion.mjs` is a read-only selector:

`canonical profession + task/combat/travel facts → motion name`

The selected motion goes through the released shared motion solver and released 2D cutout rig.

It must never write:

- profession or career;
- task/path/navigation;
- agent x/y;
- combat result;
- wallet/trade/ledger;
- inventory/resources;
- save schema.

## Pose Studio

Pose Studio exposes profession tabs and previews the selected profession's signature motions on the same isometric shared rig used by the world renderer.

## Acceptance

- profession/task selector tests pass;
- mismatched professions cannot borrow another profession's signature work animation;
- every profession motion resolves to finite connected rig coordinates;
- forward-lean semantics from PR #226 remain correct;
- exact runtime cache pins pass;
- full npm test passes;
- RC4 desktop/mobile retained;
- Adventure retained;
- Independent browser retained;
- RC2 / RC3.1 / RC3.2 retained.

UNKNOWN is never PASS.
