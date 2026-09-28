# RC3.2 — Iron / Steel Material Economy

## Release status

**RELEASED / Production Gate SAT — 2026-09-28**

- PR: #174
- Candidate head: `0498dc9bc2b108741c60eee439dc6cba67f91b9d`
- Candidate Verify: #1823 — SUCCESS
- Exact merged-main release SHA: `1b60b13394c11bd7b03d10227919f4bb509b02df`
- Post-merge exact-SHA Verify: #1965 — SUCCESS
- GitHub Pages: #112 — SUCCESS
- Pages run ID: `36446558699`
- Post-merge Verify run ID: `36448294976`

The post-merge Verify was triggered from a verification-only branch ref pointing exactly at the released main SHA. No production code or bytes were changed to obtain that result.

## Released loop

Stone MINE → deterministic Iron Ore → Furnace → Iron Ingot → Steel Ingot → advanced tool craft.

Furnace:
- Wood 2 → Charcoal 1
- Iron Ore 2 + Charcoal 1 → Iron Ingot 1
- Iron Ingot 2 + Charcoal 2 → Steel Ingot 1

Existing recipe IDs remain stable. T2 uses 2 Iron; T3/T4/T5 use 2/3/4 Steel. Metals extend existing Rust material accounts (personal/household in Independent; top-level in legacy), not a new inventory. RC2 quality/abilities/provenance and RC3.1 Blueprint/mastery remain unchanged.

## Production evidence

Exact released SHA `1b60b13394c11bd7b03d10227919f4bb509b02df` proved:

- full unit regression: 880 pass / 0 fail
- deterministic real MINE Iron Ore commit
- Furnace Ore → Iron and Iron → Steel lifecycle
- T2/T3 processed-metal reservation exactly once
- RS4-0.2 old-save migration to zero metal fields
- public HTTP success
- exact deployed-byte checks
- real canvas Furnace hit/click
- desktop public browser proof at 1440px
- mobile public browser proof at 390px
- public RC3.2 metal suite: 50 checks SAT
- RC3.1 Blueprint public suite retained: 64 checks SAT
- RC2 crafting public suite retained: 70 checks SAT
- SWA7 public lifecycle retained: 18 PASS
- Adventure/autonomous combat regression retained
- Save preserves metal state and physical T2 crafted item
- no browser runtime errors in RC3.2 public proof

## Authority locks retained

- existing resource/Rust material accounts only
- no second inventory
- deterministic gameplay; no `Math.random` or wall-clock rule
- accepted craft orders reserve processed metal once
- RC2 frozen ticket/creator/quality semantics retained
- RC3.1 Blueprint/mastery authority retained
- old-save compatibility retained

RC3.2 is closed. RC4 Merchant Economy must integrate on top of these released authorities rather than replacing them.
