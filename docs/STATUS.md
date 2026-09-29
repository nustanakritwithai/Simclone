> **RC4 Merchant Economy RELEASED — 2026-09-29**
>
> Production main: `1ff2907c4e69af8adc336792105894542576433b`.
> Accepted integration candidate: PR #194 head `582cc72668071e4c3e1f55fd43c143841a3bbaad`.
> Exact-main Verify #2160 and Pages #113 are SUCCESS.
> Public Merchant Economy is released: Producer → Merchant → Customer, Home Market, BuyOffer/Listing, real navigation, canonical Wallet/Rust item/Reservation/Trade/Ledger/Career, save/load and desktop/mobile browser proof.
> RC4 donor/acceptance PRs are historical/superseded by #194 and must not be merged into current main.
> Read `docs/RC4_RELEASE_CLOSEOUT.md` and `docs/RC4_RELEASE_SUCCESS_CONTRACT.md`. Earlier baseline/candidate notes below are historical where they conflict.
>
> **RC4 production candidate — 2026-09-29**
>
> PR #194 is the assembled Merchant Economy candidate on the RC3.2 production baseline.
> Read `docs/RC4_RELEASE_SUCCESS_CONTRACT.md` for authorities, user interaction, replay, corruption and exact-main/public gates.
> Implementation and old-head CI are not release evidence. Consult PR #194 and its exact current checkout, main Verify and Pages/public reports. Do not label this release complete until all mandatory exact-SHA gates succeed.
> Earlier dated baseline notes below are historical.

> **RC3.1 candidate source update — 2026-09-28**
>
> Starting released main: `c1fdbcac92f61499507ef89eec8b207da5bab7cb` (RC2, Pages #110). PR #173 adds physical Blueprint loot and personal recipe learning through existing authorities.
> Read `docs/RC3_1_BLUEPRINT_SUCCESS_CONTRACT.md` and `docs/RC3_1_BLUEPRINT_RELEASE.md`. Candidate implementation does not imply publication: exact-head Verify and exact-main Pages/native/public Blueprint + RC2 + SWA7 remain mandatory. Record actual results on #173.
> Donor #168 stays read-only/unmerged. Iron/Steel, new stations, market and upgrades are not part of RC3.1. Earlier baseline notes below are historical where they conflict.

> **RC2 source update — 2026-09-28**
>
> Last verified starting main: `4f9c573bf896c9a5e2ade1310f2287bab8e95a6f` (Pages #108 SUCCESS). Adventure public/SWA7 24-instance gate is already closed.
> This source adds PR #171: visible Crafter Identity, the 38-recipe T0–T5 book, actual instance quality/creator/abilities, existing recipe teaching, bounded opt-in practice, and canonical hand-slot fixes.
> Read `docs/RC2_CRAFTER_RELEASE.md` and `docs/RC2_5_CRAFTER_PUBLIC_SUCCESS_CONTRACT.md`. Exact-head Verify and exact-main Pages with native/public RC2 plus SWA7 remain mandatory; consult actual runs for release status.
> Blueprint donor #168 and older Adventure/display donor branches are not approved for direct merge. Notes below predate RC2 and are historical where they conflict with this update.

# Simclone — current implementation status

> **Current verified override — 2026-09-28**
>
> Source main: `b7983c1334a55b70a94d2ee46fcb9ffd9217e950`.
> Exact-main Pages #98 = SUCCESS.
> Adventure V1 and Same-World Adventure SWA0–SWA7 are released.
> Display D0 + DSP1 + D1 + D2 are released; unified deterministic `{kind,id}` selection is public.
>
> Active gameplay candidate: **Autonomous Adventurer Hunt Loop V1** on `feature/autonomous-adventurer-hunt-loop`.
> Current released Adventurers can Hunt/Combat through manual UI, but ordinary autonomy does not initiate Hunt or Attack. This candidate adds deterministic policy that selects a reachable physical worldMonsterId and drives the released command path automatically under explicit survival gates.
>
> Parallel display candidate: **D3 Adventure Journey Visualization** on `feature/display-d3-adventure-journey`.
> D3 owns presentation only. It must visualize gameplay truth and must not create combat, HP, path, defeat or respawn state.
>
> Sections below predate the current release line and are retained as historical context where they conflict with this override.


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
