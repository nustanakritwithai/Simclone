# RC2.2–4 — persistent crafting outcomes and real consumers

Implementation candidate. Requires merged RC2.1 exact-head and public SAT before this phase is merged.

An accepted craft order snapshots the rule version, world seed and evidence-derived family mastery. A deterministic ticket uses seed/orderId/recipeId/creator/mastery, not completion time, allocated item ID or the global simulation RNG. Completion produces one immutable value outcome on the existing Rust item. Legacy items/orders without the new snapshot remain legacy: no reroll or invented abilities.

Tiers are catalog values T0–T5, not random rarity. Quality and bounded category-specific abilities vary by ticket. Mastery increases the quality range. Only functional traits ship: tool work-speed multiplier and Core6 gear bonuses via existing consumers. No durability/gather-critical claims or unimplemented resources.

Existing owned bag items can be ingredients: unequipped prior tools/gear and actual loot material instances. The Rust authority consumes IDs once at acceptance and keeps non-spendable escrow receipts. Equipped items or items referenced by an unclosed loot result are not consumable. Output capacity is rechecked at completion; full bags hold the same order without spending, granting mastery or rerolling.

Acceptance: no recipe/ownership bypass, atomic denial, ticket independence from completion timing/RNG, two distinct orders can vary, identical replay cannot vary, invalid metadata fails closed, no duplicate input consumption, full-bag retry, legacy output compatibility, tool/gear effects real and bounded, immutable active loadout and no HP heal, save/load invariance, mastery and unlock only once. Exact-head full tests/browser and exact-main public release are required.
