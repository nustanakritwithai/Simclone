# Pose Studio V0.1 — 2D Cutout Character Rig

Status: **CANDIDATE / NOT PRODUCTION SAT**

Production baseline: `main@9fdf3d9d2b9cfae24b78c880cc8122efbffabcad`

## Goal

Pose Studio focuses on Simclone characters and movement.

The character is articulated like a skeleton:

```
pelvis
→ torso
→ neck/head
→ shoulder → upper arm → elbow → lower arm → wrist
→ hip → upper leg → knee → lower leg → ankle
```

But visible body parts remain **2D image pieces from the character visual prototype**.

Bones/joints only control transforms.

This is intentionally **not**:
- a 3D character model;
- a GLTF/GLB mesh;
- segmented 3D geometry;
- a second gameplay/physics authority.

## Image-piece rule

Each visible part is rasterized into an image surface:

- head
- torso
- upper/lower left arm
- upper/lower right arm
- upper/lower left leg
- upper/lower right leg

The renderer applies bone transforms and then uses `drawImage()`.

This keeps the source visual as 2D cutout art while still allowing articulated movement.

## Shared runtime rig

The same rig drives:
- normal world characters;
- walking;
- work motion;
- combat/attack motion;
- Pose Studio preview.

Pose Studio is not a separate fake preview character system.

## Pose Studio V0.1 controls

- IDLE
- WALK
- RUN
- WORK
- WAVE
- ATTACK
- play/pause
- animation phase scrub
- show/hide skeleton

V0.1 is presentation-only and writes nothing to simulation state.

## Determinism

The rig:
- uses no `Math.random`;
- uses no wall-clock `Date`;
- derives motion phase from render time only;
- never changes gameplay state;
- never changes task/path/combat authority.

## Acceptance

Candidate SAT requires:
- full unit test PASS;
- focused Pose Studio rig tests PASS;
- exact import-map pins PASS;
- Independent world smoke PASS;
- world characters render through cutout rig;
- mobile Pose Studio opens and animates;
- no regression in RC4 economy / Adventure / crafting / save-load.

UNKNOWN is never PASS.
