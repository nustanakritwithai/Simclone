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

# Current handoff — Same-World Adventure Expansion

> **Current verified override — 2026-09-28**
>
> Adventure V1 + Same-World Adventure SWA0–SWA7 are RELEASED.
> Display D0 + DSP1 + D1 + D2 are RELEASED on `main@b7983c1334a55b70a94d2ee46fcb9ffd9217e950`.
> Exact-main Pages #98 = SUCCESS.
>
> User-visible gameplay gap: Adventurer profession exists, but released autonomy never starts Hunt/Combat/Attack by itself.
>
> Active gameplay gate: **Autonomous Adventurer Hunt Loop V1**
> - safe idle Adventurer selects deterministic reachable physical Monster
> - uses START_ADVENTURE_HUNT
> - real Simclone path
> - READY → START_ADVENTURE_COMBAT
> - deterministic BASIC_ATTACK cadence
> - existing reward/loot/result authorities only
> - survival gates remain above hunting
>
> Parallel display gate: **D3 Adventure Journey Visualization** on `feature/display-d3-adventure-journey`.
> D3 may add target/path/combat/damage/defeat/respawn cues, but only as read-only presentation of released gameplay state.
>
> Closeout order for the gameplay gap:
> 1. exact-head Auto Adventure Verify SAT
> 2. merge without overwriting D3
> 3. exact-main Pages SAT
> 4. observe public world with Adventurer autonomously entering the Monster loop
> 5. D3 consumes that truth for visible attack feedback
>
> After this: continue D3 → D4 Renderer Architecture → D5 Asset Layer → D6 Performance/Public Visual Release.
>
> Product lock: one map, one coordinate system, no teleport scene, no duplicate HP/inventory/path authority, no renderer-owned gameplay state.


## Public source of truth

Current public baseline:

`main@65bfcfb241e1971a4cb06b8e7c7ac32110f7d1da`

Exact-main Pages run:
- `36305878183`
- SUCCESS

Adventure V1 is not public until I8 closes.

## Adventure V1 candidate

PR #138:
`Adventure V1 I0–I7: playable production Adventure UI`

Last SAT gameplay/UI candidate:
`5a7f16d1afd1af29d892b0e6079c6ba48e90ae6b`

Verify:
- #1450
- run `36318537486`
- SUCCESS

I0–I7 are closed as SAT.

## Immediate next gate — I8 Release

Do not add more gameplay features before release.

I8 sequence:

1. sync release metadata/docs on the current PR
2. run exact-head Verify on the final candidate SHA
3. UNKNOWN/FAIL must not merge
4. mark PR #138 ready only after exact-head SUCCESS
5. re-check current `main` immediately before merge
6. merge PR #138 without force-push
7. capture exact merged-main SHA
8. require exact-main CI/Pages SUCCESS
9. verify public HTTP and exact deployed bytes
10. browser proof that public page exposes Adventure launch/runtime
11. only then label Adventure V1 RELEASED

## Public proof checklist

The released page must demonstrate at minimum:

- Adventure launch is present
- mobile dock remains five tabs
- no boot/runtime error
- production UI loads from the exact merged SHA
- public runtime pins match source
- Independent world remains playable
- existing Rust/World/VAL/CV UI does not regress

The full gameplay flow is already proven in exact-head Chromium candidate tests. Public proof does not replace those tests; it proves deployment identity and browser reachability.

## After Adventure V1 release

Do not mix these into I8.

Next planned gates may include:

1. Upgrade Authority
   - atomically consume HIDE / FIRE_CORE / EMBER_SHARD
   - then permit +1..+10 gear
2. Specialization
   - Ranger / Guardian / Ritual as Adventurer specializations, not professions
3. Defeat / Return
   - recovery and return-to-home/camp behavior
4. Adventure AI
   - autonomous expedition policy under survival/household priority
5. Content expansion
   - non-Fire loot profiles across remaining types
6. Combat actions
   - Skills 1–3 / Dodge / Guard / Retreat
7. Quests / party / boss / dungeon

## PR #123 rule

PR #123 remains donor/history only.

Do not merge it.
Do not import its local character/save/XP/inventory authority.
Do not use it to bypass Adventure V1 authority locks.

## CI discipline

Routine PR:
- npm test
- active UI smoke
- Independent desktop smoke

Release:
- exact candidate Verify
- merge
- exact-main Pages
- public byte/browser proof

UNKNOWN is never PASS.
