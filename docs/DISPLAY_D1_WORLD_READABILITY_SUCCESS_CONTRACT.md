---
type: success-contract
project: Simclone
domain: display-system
feature: D1 World Readability
status: released
canonical: true
owner: Project Brain + Display Integration
validation: SAT
last_reviewed: 2026-09-27
---

# Display D1 — World Readability

## Goal

Make the Same-World readable as a game space before adding more HUD.

With normal panels closed, the player should be able to distinguish:
- Core Settlement
- Adventure Annex
- z1 Grassland · Lv.1–15
- z2 Woodland · Lv.16–30
- z3 Uplands · Lv.31–45
- z4 Stone Ridge · Lv.46–60

D1 is presentation only.

## Dependency

DSP1 is merged through PR #146.

Gameplay truth remains SWA authorities. SWA0–SWA7 are released. SWA7 hotfix is merged and exact-main Pages #96 is SUCCESS.

## Visual language

D1 uses:
- a restrained per-zone terrain wash
- one Adventure Annex entrance plaque on the physical map
- one compact in-world zone label per z1–z4
- one trail crest at each zone transition

These are render decorations with no collision, command or save authority.

Do not add:
- a permanent Adventure dashboard
- full-screen zone borders
- debug-grid styling
- teleport buttons
- fake encounter entities
- gameplay writers

## Architecture

DSP1 region truth:
worldPresentationRegions(state)

D1 enrichment:
worldReadabilityRegions(state)

Runtime:
makeGround() reads D1 regions and paints presentation-only cues.

Zone coordinates and level ranges must not be duplicated in app.mjs.

## Acceptance

1. Same-World presentation exposes Core + z1–z4.
2. Legacy world exposes Core only.
3. z1–z4 have distinct but restrained visual washes.
4. Each Adventure zone has a readable name + level range.
5. Adventure Annex has a physical-map entrance cue.
6. app.mjs consumes worldReadabilityRegions(state).
7. app.mjs does not own Adventure zone coordinates or level ranges.
8. Rendering does not mutate serialized simulation state.
9. D1 module contains no DOM, random, Date/time or gameplay command writer.
10. No new persistent HUD/dashboard is introduced.
11. Existing Monster/Clone/building/resource rendering remains authoritative.
12. Desktop and mobile screenshot proof is required before D1 is SAT.
13. Runtime cache pins must recursively cover every `src/**/*.mjs` runtime module, including DSP1 read-model dependencies.
14. UNKNOWN is never PASS.

## Integration note

D1 merged through PR #151 and is released on `main@4c75a098f01c179a425e045617f849683250d13b`. Exact-head Verify, Visual Proof #4 and exact-main Pages #97 are SAT. The offline Chromium fixture resolves both `./` and `../` local ESM imports so nested read-model modules are exercised through the normal browser boot gate.
