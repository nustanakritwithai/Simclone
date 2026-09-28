> **RC2 source update — 2026-09-28**
>
> Last verified starting main: `4f9c573bf896c9a5e2ade1310f2287bab8e95a6f` (Pages #108 SUCCESS). Adventure public/SWA7 24-instance gate is already closed.
> This source adds PR #171: visible Crafter Identity, the 38-recipe T0–T5 book, actual instance quality/creator/abilities, existing recipe teaching, bounded opt-in practice, and canonical hand-slot fixes.
> Read `docs/RC2_CRAFTER_RELEASE.md` and `docs/RC2_5_CRAFTER_PUBLIC_SUCCESS_CONTRACT.md`. Exact-head Verify and exact-main Pages with native/public RC2 plus SWA7 remain mandatory; consult actual runs for release status.
> Blueprint donor #168 and older Adventure/display donor branches are not approved for direct merge. Notes below predate RC2 and are historical where they conflict with this update.

# Simclone — Autonomous Clone World

A deterministic autonomous-society survival simulation where Clones survive, learn, form households and settlements, build physical tools/homes, preserve knowledge across generations, and now have a staged Adventure/MMORPG runtime candidate.

Play: https://nustanakritwithai.github.io/Simclone/

## Public release vs Adventure candidate

Public `main` is currently:

`65bfcfb241e1971a4cb06b8e7c7ac32110f7d1da`

Adventure V1 is in PR #138 and is not public until its I8 merge + exact-main Pages proof succeeds.

Adventure V1 candidate currently proves:

- 3 real EXPLORE completions → Adventurer qualification
- canonical Adventure Lv.1–60 progression
- real-path Khet z1–z4 expeditions
- 36 bounded wild monster forms
- deterministic Adventurer vs Wild Monster combat
- canonical `agent.hp` health authority
- VERIFIED combat victory → Adventure XP
- deterministic Fire loot → Rust possessions
- Weapon / Armor / Accessory projection into CombatStats
- production Adventure UI with expedition / encounter / combat / loot surfaces

The Adventure runtime does not import capture, ranch, breeding, egg, party-monster or owned-monster systems.

## Existing simulation line

The public game already includes:

- Independent Clone World
- personal / household resources and housing
- Rust physical crafting, possessions and modular housing
- Knowledge / mentorship / relationship evidence
- Community / Settlement emergence
- Governor v1
- Visible Autonomous Life
- bounded executable plans
- prediction / outcome verification / learning
- cognition continuity
- CV0–CV2 prediction evidence and calibration shadows
- WorldSim ecology/resource authority

## Authority boundary

Simulation rules remain deterministic:
- no DOM in engine
- no wall-clock gameplay rule
- no `Math.random`
- no UI-owned world truth
- UNKNOWN is never PASS

Adventure follows the same rule:
- Clone identity/life = Simclone
- path/position = Simclone
- human HP = `agent.hp`
- Adventure XP = `agent.skills.ADVENTURE` + existing provenance
- items/equipment = Rust authority
- UI = presentation + validated commands only

## Verification

Routine candidate gate:

```sh
npm test
python tests/ui-smoke.py
```

Release authority is not local test output. The release sequence is:

`exact candidate SUCCESS → merge → exact-main Pages SUCCESS → public proof`

## Start here

[Status](docs/STATUS.md) · [Next steps](docs/NEXT_STEPS.md) · [Game plan](GAME_PLAN.md)

PR #123 is Adventure donor/history only and must not be merged as a parallel runtime.
