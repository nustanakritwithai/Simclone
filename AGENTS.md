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

# Simclone — active agent guide

> **Current verified override — 2026-09-28**
>
> Source main is `b7983c1334a55b70a94d2ee46fcb9ffd9217e950` after merged Display D2 PR #154.
> Exact-main Pages #98 is SUCCESS.
> Adventure V1 and Same-World Adventure SWA0–SWA7 are released.
> Display V1 D0 + DSP1 + D1 + D2 are released.
> Active gameplay candidate: Autonomous Adventurer Hunt Loop V1 on `feature/autonomous-adventurer-hunt-loop`.
> This gameplay branch owns autonomous intent/policy only and must route all Hunt/Combat/Attack/Loot/Result writes through released engine commands.
> Parallel display branch `feature/display-d3-adventure-journey` owns visual journey feedback only and must not become gameplay authority.
> PR #84 and old ADV donor PRs remain stale/history unless explicitly re-audited.
> The older baseline notes below are retained as history where they conflict with this override.


Always read `GAME_PLAN.md`, `docs/STATUS.md`, `docs/NEXT_STEPS.md`, current `main`, open PRs and the exact Success Contract before changing code.

A handoff or old PR is never source of truth over the current repository.

## Current released baseline

Released main:

`3ab58da6289a28dbdde3656ce5d8285f1656ad8f`

Governor v1 GOV0–GOV6 is released and Pages #79 passed on that exact SHA.

Current separate in-flight work:
- PR #123 — Khet Sila rules
- PR #124 — VAL4 outcome verification shadow

Do not overwrite, force-push, rebase away or silently duplicate those branches.

## Authority and safety

- Engine simulation is deterministic: no DOM, wall-clock Date/time, Math.random as a simulation rule, per-tick LLM calls or external APIs.
- UI reads state and dispatches validated commands. UI is never simulation truth.
- Existing scheduler / task reservations / executors remain authoritative.
- Do not create duplicate resource, item, household, relationship, settlement, governance or task writers.
- Skills and knowledge keep provenance.
- Personal cognition uses owned/observed evidence, not hidden World Truth.
- Home ownership derives from authoritative construction provenance.
- Governor is an office, not a productive profession and not a property owner.
- Settlement and Governance are separate authorities.
- VACANT Governor office is a valid state.
- Preserve old-save compatibility and corrupt-save recovery.

## Verification method

Use VIP / VRR:

`Success Contract → Candidate(s) → Evidence / Verification → SAT / VIOL / UNKNOWN → Repair / Reselect → Prove → Execute → Post-verify`

UNKNOWN is never PASS.

## CI and release handoff

Routine PR verification:
- `npm test`
- active Chromium UI smoke
- Independent desktop smoke

Exact-main Pages:
- active regressions
- Independent native desktop smoke
- deployment
- exact public-byte check

Manual `Full Regression Proofs` owns:
- 120-year continuity
- full browser matrices
- archived heavy regression suites

Do not move a failing proof out of a gate merely to make CI green. A proof may be moved only when the evidence scope remains explicitly available elsewhere and the release contract still protects publication.

After pushing a candidate, provide its Actions URL once and stop polling. Re-check only when the user asks.

## Branch discipline

- Re-read branch heads before writes.
- Never force push.
- Never overwrite another agent branch.
- Rebuild stale work on current main instead of merging obsolete stacked branches.
- Runtime changes require refreshed browser import-map pins.
