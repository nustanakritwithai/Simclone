# Simclone — Playable Alpha 0.1.0

## Implemented in this build

The default page is now a playable simulation, not the development-plan poster. The original plan page is preserved byte-for-byte at `plan.html`; `GAME_PLAN.md` remains the roadmap, not a completion report.

- A deterministic, seeded 30 × 26 tile world and a DOM-free engine.
- Original + five clones with permanent appearances, parent IDs and manual clone generations.
- Four ticks per second at 1×; pause, 2× and 5× controls.
- CPU-scored forage, woodcut, mining, construction, eating, rest and exploration.
- Real grid movement and breadth-first pathfinding; water is blocked, a bridge is traversable.
- Shared food/wood/stone, bounded needs, starvation and resource regeneration with explicit rates.
- Clone command: food 8 + wood 4; inherits 35% of each selected parent's skill XP; checks housing first.
- House placement: wood 12 + stone 6 reserved once; clones complete construction, adding 6 housing slots.
- Portraits, roster, inspector, actual score breakdowns, skill XP/source, bounded personal memories and event log.
- Responsive desktop overlay / mobile bottom sheet, touch pan/pinch, zoom and camera follow.
- JSON save/load validation, autosave, export/import confirmation, reset confirmation.

## Verification evidence

`npm test`: 15/15 engine tests passed in the build environment. Includes a deterministic 10,000-tick comparison, another five seeded 10,000-tick runs, a 50,000-tick bounded-history run, save continuation, selected-parent inheritance, atomic failure, housing enforcement and autonomous construction.

Chromium UI fixture: boot, advancing time, pause, actual decision scores, roster selection, cloning from Kira, storage-adapter reload, mobile navigation/inspector, malformed import rejection and building-to-completion passed. No JavaScript page errors were captured. Layouts inspected at 1440×1000 and 390×844.

The runner blocked HTTP navigation. UI tests therefore loaded the same modules in memory and used an explicit in-memory Storage test double. Native browser localStorage persistence, live Pages HTTP/asset delivery and actual Android-device performance are UNKNOWN until checked on a real device. This is not an end-to-end production test.

## Not completed

No autonomous birth, child/adult/elder aging, mentor/archive learning, local-knowledge perception, full V0.7 decision architecture, social/faction/economy/conflict systems, replay or LLM integration. A manually cloned second generation is not proof of autonomous population continuity. The V1.0 100-day proof is NOT claimed.

The simulation stops while hidden, while a modal is open, and after closing the page. It does not run 24/7 or catch up offline. Recent event history is capped at 120 entries and personal memories at 8. This is not a full historical archive.

## Next implementation gate

Harden V0.2: food/resource balance, job reservations, travel-aware scoring and edge cases with a fully occupied village. Then implement V0.3 aging and autonomous generation creation with new deterministic contracts; do not infer it from the existing manual Clone command.

## Observation UI update 0.1.1

The presentation layer has been upgraded while preserving the 0.1.0 engine and save schema. See [UX/UI implementation and verification](UX_UI_0.1.1.md) for the exact scope and current evidence: 15 engine tests and 42 offline Chromium UI assertions passed. This newer UI fixture supersedes the old fixture's immediate house-placement interaction. Native storage and live browser delivery limitations remain explicit.

## Observation UI update 0.1.2

Adds layout-aware camera framing, a read-only minimap, recoverable startup and visible save status/protection without changing engine/save 0.1.0. Current evidence and remaining verification limits are recorded in [UI 0.1.2](UX_UI_0.1.2.md). Older test counts above describe earlier builds; they do not establish live Android or HTTP verification.
