# Pose Studio V0.2 — Contact-aware 2D Motion Solver

Status: **CANDIDATE / NOT PRODUCTION SAT**

Base production main: `33f7b7489db9bc29c7e07b76c419c2776e82de66`

Reference design source:
`nustanakritwithai/3JS-player-block-asset-engine-`

This implementation borrows architecture ideas only:
- explicit foot sockets;
- grounded / air contact metadata;
- locomotion vs action ownership;
- bounded foot-plant root correction;
- movement-state library.

It does **not** import Three.js character meshes or 3D rig geometry.

## V0.2 pipeline

```
gameplay task/combat (read-only)
→ motion selector
→ motion pose
→ contact metadata
→ support-leg response
→ bounded foot-plant root correction
→ 2D cutout image pieces
→ isometric canvas
```

## New movement states

- Jump
- Fall
- Land
- Crouch
- Hit

Existing Idle / Walk / Run / Work / Wave / Attack remain.

## Contact rules

Walk alternates planted left/right support with a short double-support window.

Run includes explicit flight windows.

Jump transitions grounded → air → grounded.

Fall is always air.

Land is grounded and receives bounded landing compression.

## Foot sockets

The solver exposes:
- `foot.L`
- `foot.R`

These are read-only render coordinates derived from ankle joints.

## Authority boundary

The solver may translate the **render root** by at most the configured visual correction.

It must never mutate:
- agent x/y;
- task/path;
- navigation;
- combat result;
- inventory;
- profession;
- Wallet/economy;
- save schema.

## Acceptance

- full `npm test` PASS;
- cache pins exact SHA-256;
- Independent browser smoke PASS;
- Adventure retained;
- RC4 retained;
- RC2/RC3 retained;
- no browser JavaScript errors;
- solver source contains no Math.random, Date, DOM or network calls.

UNKNOWN is never PASS.
