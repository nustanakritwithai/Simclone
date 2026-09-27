# RC2 — Rust Crafting V2 / Crafter Identity

Date: 2026-09-28
Base: 7538ab583b1b192b7a502eb40e0c7faa016416f9
Status: implementation candidate; not a released feature until exact-head and exact-main proof.

## Entry gate — SAT

PR #164 head 29c809dce80ba5ab2229045c820885970d1563cb passed Verify #1749.
Merged main 7538ab5 passed Pages #105 (run 36359400157), including public exact
bytes and all 18 Same-World lifecycle checks. Public before/after population is
24 physical instances, 12 monsterIds, four zones, three types per zone, two copies.
No stale Adventure donor is merged into this workstream.

## Product contract

RC2.1: A Clone has personal recipe knowledge. Knowledge, a usable station and all
materials are necessary at authoritative CRAFT_ITEM acceptance. Knowing a formula
never grants a station, materials, XP or equipment. The existing nine survival /
housing formulas (including Hammer T1) form the explicit shared starter curriculum.
Advanced formulas are NOT globally known. Learn them from completed predecessor
crafts, a consumed physical blueprint, or an active, nearby existing mentor.
Research/discovery remains future work.

RC2.2: Recipes own their tier (0..5). New crafted item instances own quality 0..100
and retain the existing numeric createdBy identity. No second craftedBy writer.
The real content ladder uses existing stone tools and monster materials; it does
not pretend an iron/steel mining and smelting chain already exists. Tier recipes
can output the same kind with a distinct recipe name and immutable tier.

RC2.3: Resolve each new item's quality and category-appropriate abilities from a
versioned immutable ticket: world seed, reserved item ID, crafter ID, recipe ID,
accepted crafting XP / per-recipe mastery and order ID. Reserve IDs at acceptance,
not completion, so interleaving another craft cannot change an accepted roll.
No Math.random, Date, wall-clock, mutable world RNG or reroll on restore.

Only implemented effect consumers enter the roll pool: tool work speed; gear
Core6 plus crit/evasion/resistance/penetration ratings. Accuracy is already capped
at 100% for the current hero baseline, so do not roll a useless accuracy bonus.
Durability, yield, gather-crit and elemental-affinity affixes require separate
approved consumers and do not appear as decorative/nonfunctional abilities.
Buildings retain quality/provenance but acquire no new housing/capacity rule.

RC2.4: A successful physical completion awards CRAFT XP in agent.skills, through
existing skill-provenance accounting, and increments that recipe's completed-work
mastery. Queueing, failure, cancellation, death, replay and teaching award no XP.
The next recipe unlocks after three accepted completions of its prerequisite.
Mastery shifts the quality range upward with overlap; it never guarantees quality
100. Keep recipe knowledge and mastery under the existing knowledgeState authority.

## Authority and atomicity

- CRAFT_ITEM -> existing Rust order -> existing scheduler/advanceCraft -> existing
  rustPossessions.items. No new inventory, equipment, HP or Adventure XP ledger.
- Item ingredients are selected by canonical ID order from the actor's own bag.
  Never consume another Clone's item, an equipped item or a still-open loot receipt.
- Validate everything before spending. Raw and item ingredients enter escrow once;
  completion spends nothing again. Death retains the existing no-refund policy.
- Account for consumed ingredient slots and pending outputs in capacity checks.
  A bag filled during work drops the completed item at the crafter's real position
  instead of overfilling or duplicating it.
- New UI intents carry expectedOrderId. A stale replay is rejected even after the
  prior item/order is gone. Legacy internal calls without that optional guard
  remain new craft intents, not claimed to be network-idempotent requests.
- Completion uses the existing order exactly once, plus a monotonic personal
  completed-order guard. Reserve counters are never rolled back or reused.
- Blueprint consumption and giving/dropping items use the Rust possession writer.
  Active combat gear and open loot-result receipts cannot be consumed/transferred.
- Mentor teaching uses an existing active mentorship link and knowledge range;
  it does not create a second relationship authority or grant craft XP.

## Compatibility and validation

- Legacy items without craft metadata retain exactly their previous effects and
  bytes. Legacy pending orders finish as legacy items, without retroactive rolls.
- Existing saves can omit the entire crafting knowledge extension. Read-only views
  project starter knowledge without mutating saves. First accepted learning/work
  creates the optional extension. Never repair malformed RC2 data as if legacy.
- Unknown roll versions, forged quality/abilities, wrong recipe tier/category,
  duplicate/reserved IDs, malformed mastery and XP/provenance drift fail closed.
- Combat uses immutable equipment snapshots. Old v1 snapshots stay valid; crafted
  snapshots include verifiable item identity and bounded modifiers/ratings. Live
  hp remains the existing Simclone ratio authority. Upgrades remain +0-only in
  production; the existing +1..+10 pure formula is not falsely declared released.
- Keep histories bounded by the finite recipe catalog and existing identity/save
  limits. No unbounded command or item history is added.

## Visible gameplay

An accessible Crafter panel shows actor, personal known/locked recipes, prerequisite
progress, actual station/material eligibility, CRAFT XP, per-recipe mastery, bag
items, creator, tier, quality and actual effects. It dispatches existing/validated
commands only. Show blueprint learning and nearby active-mentor teaching. Show
quality/provenance on existing item cards without making the UI authoritative.
The game continues to craft via its scheduler after the panel closes. No synthetic
progress timer, fake inventory or separate crafting simulation.

## Required evidence

1. Catalog: starter compatibility, bounded tiers and real materials; all tier
   ladders reachable through actual crafting/learning, not a test-only unlock API.
2. Knowledge: two Clones diverge, unknown recipe cannot spend, station is not
   knowledge, blueprint consumed once, mentor/range/ownership guards.
3. Roll: deterministic vectors, category pools, bounds, mastery distribution,
   exact mid-order and completed save/load/replay, interleaving independence.
4. Atomicity: insufficient materials/no station/full capacity no mutation; item
   escrow conservation, reserved IDs, stale commands, completion replay, death,
   item drop/give, open-loot-receipt and active-combat protection.
5. Skills: real completion earns XP/provenance once, failed/UNKNOWN work earns none,
   predecessor mastery unlocks only that actor, malformed data rejected.
6. Combat/tools: actual effect consumers, bounded stats/ratings, v1 snapshot
   compatibility, v2 snapshot validation, no HP/equipment/Adventure XP duplication.
7. Existing active regressions plus autonomous housing and Same-World Adventure.
8. Browser: actual controls -> craft -> item/XP/knowledge visibility -> save/load,
   mobile/desktop screenshots, no JS errors. Distinguish offline proof from native
   HTTP/storage and actual public Pages proof.
9. Exact-head Verify -> expected-head merge -> exact-main Pages including public
   crafting and preserved SWA7 lifecycle. UNKNOWN is not PASS.

This is the four-phase crafting identity release, not a new currency/shop market,
research system, Iron Age resource chain, or production gear-upgrade release.
