---
type: success-contract
project: Simclone
domain: display-system
feature: D1 World Readability
status: implementation-candidate
canonical: true
owner: Project Brain + Display Integration
validation: UNKNOWN
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

Gameplay truth remains SWA authorities. SWA6 is in a separate PR and owns DEFEATED/despawn/respawn.

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
13. Runtime cache pins must be refreshed only after the SWA6 integration race is resolved.
14. UNKNOWN is never PASS.

## Integration note

SWA6 PR #147 currently touches index.html and tests/ui-smoke.py.

This D1 candidate intentionally avoids those files. Until SWA6 merges and D1 rebases/pins exact runtime assets, full release verification remains UNKNOWN even if focused Node tests pass.
