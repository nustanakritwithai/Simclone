# Simclone — current implementation status

> **Current verified override — 2026-09-27**
>
> Source main: `dd3fa43c3e8057a36534cf5e1b731c95da73ac1d`.
> Adventure V1 is released.
> SWA0 PR #140 and SWA1 PR #141 are merged.
> Same-World now has one physical `84×52` map with Core x0–59 and Adventure Annex x60–83.
>
> Active candidate: SWA2 / `feature/swa2-wild-monster-authority`.
> SWA2 adds one saveable Wild Monster world-state ledger with 12 deterministic physical entities: 3 each in z1-z4. It reuses Adventure V1 monster definitions and stat projection and adds no renderer/UI authority.
>
> Sections below predate the Same-World release line and are retained as historical context where they conflict with this override.


## Public released baseline

Current public `main`:

`65bfcfb241e1971a4cb06b8e7c7ac32110f7d1da`

Release line:
- VAL7–VAL10 cognition completion
- CV0–CV2 prediction evidence reconciliation and calibration-quality shadows

Exact-main GitHub Pages proof:
- workflow run `36305878183`
- SUCCESS
- exact SHA: `65bfcfb241e1971a4cb06b8e7c7ac32110f7d1da`

Adventure V1 is **not public yet** at this baseline.

## Adventure V1 release candidate — I0–I7 SAT

Draft PR:
- #138 — `Adventure V1 I0–I7: playable production Adventure UI`
- branch: `integration/adventure-v1`

Current SAT candidate before I8 release metadata:
- `5a7f16d1afd1af29d892b0e6079c6ba48e90ae6b`
- Verify #1450 / run `36318537486` = SUCCESS

Completed gates:

- I0 — exact-head SAT donor consolidation
- I1 — canonical Adventure progression Lv.1–60 in `agent.skills.ADVENTURE` + existing skill provenance
- I2 — real-path Khet expedition and deterministic encounter; no teleport
- I3 — deterministic combat session using pure resolver; canonical human health remains `agent.hp`
- I4 — VERIFIED terminal victory rewards Adventure XP exactly once
- I5 — VERIFIED Fire loot commits only through Rust possessions with claim-key idempotency
- I6 — Rust-owned Weapon / Armor / Accessory loadout projects donor modifiers into CombatStats
- I7 — production Adventure UI + Chromium playtest flow

Current playable candidate loop:

```text
Clone
→ 3 accepted real EXPLORE completions
→ Adventurer
→ Adventure Lv.1–60
→ choose Khet z1–z4
→ walk using Simclone path authority
→ deterministic wild encounter
→ BASIC_ATTACK combat
→ canonical agent.hp damage commit
→ VERIFIED victory
→ Adventure XP
→ Fire LootProposal
→ Rust possession claim
→ Rust-owned Adventure gear
→ CombatStats projection
```

Production UI in the candidate includes:
- Adventure launch control
- Adventurer panel
- qualification / level / XP / HP
- z1–z4 access
- expedition HUD
- encounter HUD
- Start Combat
- BASIC_ATTACK
- Victory / Defeated result
- Fire loot claim
- Weapon / Armor / Accessory slots

## Authority locks

Adventure V1 does not create parallel world authorities.

- Clone identity/life/needs: Simclone
- profession: existing `adoptProfession`
- path/position: Simclone navigation/task authority
- canonical human health: `agent.hp`
- Adventure XP: `agent.skills.ADVENTURE` + existing skill provenance
- monster data: bounded Pocket-derived Adventure catalog
- combat calculation: pure Adventure resolver
- possession/item instances: Rust possession authority
- gear ownership/equipment: existing Rust equipment array
- UI: state reader + validated engine commands only

Still forbidden:
- second human HP ledger
- `khetXP` / parallel Adventure XP field
- Adventure inventory
- second equipment ledger
- teleport
- `Math.random` / wall-clock gameplay rules
- capture / ranch / bond / breeding / egg / owned monster systems
- runtime merge of PR #123

## Current content boundaries

Adventure V1 currently has:
- 36 wild monster forms from 18 species families
- z1 Lv.1–15
- z2 Lv.16–30
- z3 Lv.31–45
- z4 Lv.46–60
- BASIC_ATTACK combat action
- Fire loot profile only
- donor gear definitions:
  - EMBER_BLADE
  - HIDE_ARMOR
  - EMBER_CHARM

Still deferred:
- non-Fire loot profiles
- Skills 1–3
- Dodge / Guard / Retreat
- Ranger / Guardian / Ritual specialization
- gear acquisition recipes/costs
- authoritative +1..+10 upgrade material consumption
- defeat return / recovery
- autonomous Adventure policy
- quests / party / boss / dungeon

## Verification tiers

Routine PR verification:
- `npm test`
- active Chromium UI smoke
- Independent desktop smoke

Exact-main Pages release gate:
- active regressions
- native Independent desktop release smoke
- deployment
- exact public-byte verification

Heavy proofs remain in manual Full Regression workflows.

## Active external work / stale references

- PR #123 — Khet Sila separated adventurer rules — donor/history only; do not merge into Adventure V1.
- Older stale/reference PRs must be re-audited before reuse.

## Evidence rule

A successful branch CI does not make Adventure V1 public.

Release authority remains:

`Success Contract → Candidate → Verify → SAT → Merge → exact-main CI/Pages → public proof`

UNKNOWN is never PASS.
