# RC3.1 — Physical Blueprint Loot & Recipe Learning

Base: `c1fdbcac92f61499507ef89eec8b207da5bab7cb` (released RC2). Owner: this integration workstream. Donor #168 is read-only reference; never merge it or other stale branches directly.

## Player contract
New Adventure combats may award one deterministic physical RECIPE_BLUEPRINT. The item is claimed through the existing Rust authority, uses one bag slot (overflow drops at the actual Clone position), identifies a released advanced recipe, and is consumed exactly once by a living productive-age owner to learn that recipe. Already-known recipes do not consume the item or grant mastery. Blueprint acquisition/learning does not grant crafting completions or Adventure XP.

Start from the existing 29 non-starter RC2 recipes, not invented Iron/Steel recipes. Explicit versioned catalog: T1–T5, monster-level cap 1 + floor((level-1)/12), capped at 5. Chance by rank: NORMAL 1250 / ELITE 2500 / BOSS 5000 basis points (initial tuning, not final balance). Blueprint is a second learning route, not a new restriction on existing mastery/teaching unlocks.

## Authorities
- Rust possessions remain the sole physical item and consumption authority.
- knowledgeState.recipes remains the sole recipe writer/validator.
- VERIFIED combat outcome and existing reward receipt are mandatory before any loot mint.
- Freeze the versioned Blueprint offer at new combat acceptance. It is a proposal, not ownership or permission; validate again at claim. Save/load, UI timing, unrelated RNG and changing personal knowledge cannot reroll it. The versioned recipe pool is stable and explicit, not silently rebuilt from a future catalog.
- Old combats without an offer remain legacy; no retroactive Blueprint roll.
- Preserve old Fire loot. New admitted combats can have Blueprint-only or empty loot for other monster types; empty results must not mint placeholder items.
- One accepted victory uses the existing claim key. Consumed Blueprint provenance is retained in bounded personal recipe evidence; replay must not mint it again even after consumption.
- Do not consume an item still named by an open loot receipt. The player closes the combat result first. Another person's open receipt also blocks consumption.
- All command failures preserve inventory, knowledge, counters, HP and XP. No UI state writer, second inventory/HP/XP/equipment ledger, free item, teleport, Math.random or wall-clock gameplay rule.
- Respect pending craft output capacity, old saves, death/drop/pickup, teaching provenance, and the existing single command path.

## Proof obligations
1. Pure deterministic offer, pinned vector, immutable inputs, stable catalog ordering/version and level/rank bounds; malformed/UNKNOWN cases fail closed.
2. Real combat start/attack/VERIFIED victory/claim; no reward for ACTIVE or DEFEATED; old Fire and non-Fire behavior preserved for legacy sessions.
3. Claim replay, conflicting manifest, capacity and pending craft capacity: no partial mint, counter drift or reroll.
4. Learn from actual owned bag item; reject wrong owner, dropped/forged/known recipe, child/dead, combat-active, open-receipt use and duplicate use.
5. Item disappears, exact recipe appears with source item/claim evidence, mastery and XP unchanged; save/reload, teaching and retained-history proof.
6. Forged evidence, duplicate consumed item identity, live+consumed duplication and direct regrant after consumption fail closed.
7. Real desktop/mobile buttons: visible result, physical item/recipe label, Continue then Learn, disabled replay/known state, save/reload. Screenshots required, DOM presence alone insufficient.
8. Existing full unit and UI/Independent/Adventure/RC2/SWA7 gates retained. Exact final candidate Verify, then expected-head merge, exact merged-main Pages and native/public Blueprint proof before release SAT.

## Explicitly out
Iron/Steel, new stations, markets/currency, automatic learning/mentoring, paid upgrades, durability, rerolling RC2 items, changing mastery unlock rules, and all donor merges.

## Evidence status
Contract only initially. Implementation, tests and public release are UNKNOWN until actual evidence is recorded. Local offline browser proof is not native/public persistence evidence. Prepared fixture resources or knowledge are not claimed as autonomous achievements. Consistency checks are not cryptographic authenticity against a fully rewritten self-consistent offline save.
