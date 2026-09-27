# Current handoff — Same-World Adventure Expansion

> **Current verified override — 2026-09-27**
>
> Adventure V1 is released.
> SWA0–SWA5 are merged.
> Display V1 D0 + DSP1 is merged on `main@250285d4a6d381751c60791bd9897fd7ab92a70f`.
>
> Active gameplay branch: `integration/swa6-after-display-v1`
> Active gameplay gate: **SWA6 — Victory → DEFEATED → despawn → deterministic respawn**
>
> SWA6 may merge only after exact-head Verify is SAT on the integration branch.
>
> After SWA6 SAT:
> 1. SWA7 — exact-main CI/Pages
> 2. public-byte identity
> 3. browser/mobile proof of visible Monster → Hunt → Combat → Victory → disappear → Continue → respawn
> 4. close Same-World Adventure release line
>
> Display next line after DSP1:
> 1. D1 — World Readability: Core / Adventure Annex / z1–z4 and entity silhouettes
> 2. D2 — unified `{kind,id}` selection + deterministic hit resolution
> 3. D3 — authority-driven Adventure visualization using merged SWA6 lifecycle truth
> 4. D4 — render registry + viewport culling + LOD
> 5. D5 — visualKey asset resolver; PR #139 remains donor assets only
> 6. D6 — desktop/mobile/public visual proof
>
> Product lock: one map, one coordinate system, no teleport scene, no encounter-only fake Monster, and no renderer-owned gameplay state.
>
> The older Adventure V1 release-gate notes below are retained as historical context only.


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
