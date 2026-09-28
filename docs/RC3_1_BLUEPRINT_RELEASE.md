# RC3.1 — Physical Blueprint Loot & Recipe Learning

## Source and boundary
Starting release: main `c1fdbcac92f61499507ef89eec8b207da5bab7cb`, RC2 + mobile identity fix, Pages #110 / 36389509662 SUCCESS. Candidate: PR #173, branch `feature/rc31-physical-blueprint-20260928`. Donor #168 was read as a pure proposal reference only; its old branch is not merged.

This document describes the candidate, not a pre-approved deployment. Only exact final-head Verify followed by exact merged-main Pages, native/public Blueprint and the retained RC2/SWA7 gates can close release SAT. Record actual SHAs and run IDs on #173; UNKNOWN is not PASS.

## What a player does
A newly started Adventure fight freezes one versioned Blueprint offer. A VERIFIED victory can award a physical `RECIPE_BLUEPRINT` alongside the existing Fire materials, or Blueprint alone for other types. The Victory HUD shows the real recipe and Tier when a Blueprint is offered. Press **รับ Loot**, then **เดินทางต่อ (Continue)**.

Select that Clone → **ของ / Rust**. The physical Blueprint card displays its exact recipe, Tier and original collector. Press **ใช้พิมพ์เขียวเรียนสูตร**: one item disappears and that person's book records the recipe, consumed item ID, claim source and acceptance evidence. No mastery/completions or XP are granted. The normal station, ingredients and material rules still apply to crafting.

A full bag causes the item to drop at the collector's actual position. Another eligible Clone can use ordinary pickup before learning. If the recipe is already known, the Blueprint stays intact and the button is disabled. Nothing learns automatically. A Blueprint still referenced by anyone's open loot result cannot be consumed: finish that result first. Dead/child actors, wrong owners, ground items, active combat and inconsistent evidence cannot learn.

## Initial content and balance
One physical item kind, not 29 inventories. The explicit v1 pool contains the 29 released non-starter RC2 recipes (38 total recipes remain): advanced stone axe/pickaxe/hammer variants and Fire weapon/armor/accessory variants. No Iron/Steel recipe is invented. Blueprint learning is additive; released mastery unlocks and teaching still work.

Initial drop chance: Normal 12.5%, Elite 25%, Boss 50%. Tier cap by monster level: 1–12 → T1; 13–24 → T2; 25–36 → T3; 37–48 → T4; 49–60 → T5. These are configured chances across deterministic tickets, not a promise of a drop within a fixed number of fights.

## Authority and compatibility
Rust possessions own mint, location, pickup and consumption. `knowledgeState.recipes` owns learning and bounded provenance. VERIFIED terminal/reward evidence is rechecked by both integration and the existing Rust mint authority before a new Blueprint is minted. Unclaimed offers are not items or knowledge.

World seed + actor + combat identity + monster level/rank + fixed pool version determine the offer. Acceptance tick is retained for chronology, but does not influence the roll, so UI delay cannot change the selected recipe. Completion, save/load, unrelated RNG or changing personal knowledge cannot reroll it. Legacy combats without the new field stay legacy and receive no retroactive offer.

Claim receipts remain idempotent. Consumed source IDs/claim keys are read from personal knowledge, not a new inventory or XP ledger, preventing remint after learning. Old RC2 items/orders are not rerolled. Item metadata and known recipes survive transfer/death/pickup/teaching as their existing authorities permit. Capacity checks reserve room for pending craft outputs. Invalid commands do not partly change materials, items or knowledge.

Consistency validation is not cryptographic authenticity against an entirely rewritten self-consistent offline save.

## Verification
`node --test tests/blueprints.test.mjs` includes real path/combat/victory/claim, replay and consumption, malformed evidence, known recipes, death/pickup, legacy sessions, held receipts and capacity. `npm test` retains existing regressions.

`python tests/blueprint-smoke.py` exercises actual canvas/DOM buttons at 1440×1000 and 390×844. `--native` uses real HTTP/storage and exact file bytes. `--public` additionally requires PAGE_URL and exact RELEASE_SHA. Native Blueprint runs before Pages deployment; public Blueprint runs after deployment alongside unchanged RC2 and SWA7 proof. Neither workflow timeout is increased.

The fixture supplies a qualified Lv.60 tester and valid initial world, not a free Blueprint or advanced knowledge. Those starting skills are not claimed as autonomous achievements. Actual Hunt/path/attack/claim/Continue/learn/save/reload must produce the item and recipe. Offline storage doubles are not native/public persistence evidence. Screenshots must be inspected, not merely DOM text.

## Out of this release
Iron/Steel, new stations, market/currency, automatic learning/mentoring, paid upgrades and durability remain separate integrations. No stale donor branch or other agent's runtime is included.
