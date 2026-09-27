# Adventure V1 Integration I0 — SAT donor consolidation

Status: CANDIDATE. MERGE NOT APPROVED.  
Base: `main@65bfcfb241e1971a4cb06b8e7c7ac32110f7d1da` (CV0–CV2).

## Goal

Place the independently verified Adventure departments on one current-main branch without inventing new runtime authority.

This gate proves coexistence only:

```text
ADV0 Career
+ ADV1 CombatStats adapter
+ ADV4 Wild Monster data
+ ADV5 Khet zone / encounter
+ ADV6 Combat resolver
+ ADV8/ADV9 Loot / Gear / Upgrade proposal
+ Adventure UI prototype
```

I0 does **not** make combat live, does not grant loot, does not create Adventure XP, and does not add a second save/inventory/HP authority.

## Exact donor heads admitted

- ADV0 / PR #130: `e2592eb511e117c0095d3d9d9436cccb2a6c282a`
- UI / PR #132: `5c01db70f55b897621fec2daf54bcb017dd49366`
- Loot/Gear / PR #133: `8390520bd3c752bc40e8021a224da2e961937463`
- Wild Monsters / PR #134: `470f1743a32adae2324ef51c3e1197635196255d`
- Combat Resolver / PR #135: `2d2b774f8ed30fedf981655cb105e79bc7452836`
- CombatStats / PR #136: `cec18b62104b2b44016b2bc0550f7d127bfaf977`
- Khet World / PR #137: `ad0210ee3baa1f45c8b2027a74790646bc593e58`

Each listed head had exact-head Verify SUCCESS before admission.

PR #123 is donor/history only and is not merged or copied as a runtime architecture.

## Authority locks

- Clone identity/life/needs: Simclone.
- Runtime profession transitions: existing `adoptProfession`.
- Position/path: existing Simclone navigation/executor.
- Canonical health store: `agent.hp`.
- Skill provenance: existing Simclone skill authority.
- Wild monster definitions: Adventure monster catalog only; no owned monster state.
- Combat math: pure resolver; it returns an outcome proposal only.
- Loot: proposal only in I0; no Rust write yet.
- Gear/upgrade: calculation only in I0.
- UI prototype: docs-only and non-authoritative.
- No `Math.random`, wall-clock time, DOM, localStorage, or LLM inside Adventure simulation modules.

## Forbidden in I0

- No Khet character or `khet-sila-v1`.
- No Capture / Throw / Ranch / Bond / Breeding / Egg / Party Monster.
- No Adventure inventory or second item ledger.
- No second HP ledger.
- No `khetXP`, `adventureXP`, or unproven XP writer.
- No teleport.
- No combat outcome commit to world state yet.
- No public Adventure UI wiring yet.
- No Ranger / Guardian / Ritual profession writers.
- No direct import of PR #123 modules.

## Next integration gates after I0 SAT

I1 — Adventure Progression Authority (Lv.1–60) with provenance and migration.  
I2 — World expedition bridge: real path to Khet zone and deterministic encounter.  
I3 — Combat session/outcome commit: resolver → one canonical `agent.hp` writer.  
I4 — VERIFIED combat outcome → progression reward; UNKNOWN grants nothing.  
I5 — Loot claim → existing Rust possession authority, idempotent by claim key.  
I6 — equipment/loadout projection → CombatStats, no duplicate stat writer.  
I7 — production UI/read model and browser/mobile proof.  
I8 — exact candidate CI → merge → exact-main Pages → public proof.

## I0 acceptance

1. All admitted donor tests run together from one tree.
2. Release metadata/import-map tests pass with every new runtime module pinned.
3. ADV0 profession behavior remains SAT on the CV0–CV2 base.
4. Existing VAL/CV/Governor/Household/Settlement/Rust/WorldSim tests do not regress.
5. No new engine imports of Adventure combat/monster/zone/loot modules in I0.
6. No duplicate HP, XP, inventory, profession, position, or save writer exists.
7. PR #123 remains untouched.
8. Exact candidate Verify on the final I0 SHA must be SUCCESS. UNKNOWN is not PASS.
