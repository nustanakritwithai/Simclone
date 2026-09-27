# Adventure V1 Integration I8 — Release Success Contract

Status: CANDIDATE. MERGE NOT APPROVED.

Parent gameplay/UI candidate:
`5a7f16d1afd1af29d892b0e6079c6ba48e90ae6b`

Parent evidence:
- Verify #1450
- run `36318537486`
- SUCCESS

## Goal

Release the already-SAT I0–I7 Adventure candidate without changing gameplay authority.

I8 owns release metadata, final exact-head verification, merge, exact-main Pages proof and public deployment proof only.

## No new gameplay in I8

I8 must not add or alter:
- profession rules
- Adventure XP
- Khet zone/encounter rules
- combat formulas
- HP writers
- loot proposals
- Rust possession rules
- equipment modifiers
- UI gameplay commands

Any gameplay change returns the candidate to the relevant earlier gate.

## Final candidate gate

After release metadata is synced:
- exact final PR head must run the routine Verify workflow
- every required job/step must succeed
- UNKNOWN / cancelled / skipped-required / failure is not PASS

Only after exact-head SUCCESS may PR #138 be marked ready.

## Merge gate

Immediately before merge:
- fetch current `main`
- confirm PR base is still current or reconcile explicitly
- confirm PR remains mergeable
- confirm exact candidate CI corresponds to the current PR head
- no force-push

## Exact-main release gate

After merge:
- capture the exact merged-main SHA
- exact-main Pages workflow must run on that SHA
- required tests/smokes must succeed
- deployment must succeed
- public-byte proof must identify that exact SHA/runtime pin set

Merge alone is not release.

## Public browser proof

The public GitHub Pages site must:
- return successfully
- load without boot/runtime errors
- expose the Adventure launch control in Independent world
- retain the five-tab mobile navigation contract
- use the exact merged runtime pins
- retain existing Independent / Rust / World / VAL / CV surfaces

## Release label

Adventure V1 may be called RELEASED only after:
- final exact-head candidate Verify = SUCCESS
- PR #138 merged
- exact-main Pages = SUCCESS
- public deployment identity/browser proof = SAT

UNKNOWN is never PASS.
