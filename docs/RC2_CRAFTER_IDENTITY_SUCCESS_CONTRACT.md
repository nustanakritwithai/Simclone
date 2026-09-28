# RC2 — Rust Crafter Identity

Status: IMPLEMENTATION CANDIDATE / UNKNOWN. Owner: this integration workstream on `feature/rc2-crafter-identity`. Other agents: do not duplicate or overwrite this branch; coordinate through the PR.

## Baseline / release gate

Start from main `7538ab583b1b192b7a502eb40e0c7faa016416f9`, merged PR #164. Pages #105 / run 36359400157 passed the exact public byte and full public Same-World lifecycle gates. Duplicate P0 PR #165 was closed without merge. No donor branch is merged again.

## User goal

People know recipes individually; actual people produce Rust items with multiple recipe tiers, persistent per-item quality and generated abilities. Verified production improves their recipe mastery and unlocks further recipes. The result is visible and usable, not merely metadata.

## Authority locks

- Preserve existing engine tasks, physical station travel and `CRAFT_ITEM`/Rust order execution.
- `rustPossessions.items` is the only item ledger; `createdBy` is the only creator identity.
- Material stock / owned Rust items are the only spendable material authorities.
- No second inventory, equipment ledger, generic crafting XP or profession writer.
- Personal recipe records live in a bounded additive `agent.knowledgeState.recipes` namespace. Resource beliefs remain resource-specific and keep their existing limits; recipes must not evict survival knowledge.
- Old saves with no recipe namespace retain precisely the released nine survival recipes as a deterministic compatibility baseline; no random historical knowledge is invented. Preview does not materialize state.
- Engine/Rust validates permissions and consumes materials once. UI only reads and dispatches commands.
- Recipe tier is catalog truth. Quality/abilities are resolved from a versioned frozen order ticket and mastery snapshot, never wall-clock or global simulation RNG.
- Completed items never reroll on load, equip, transfer, tooltip, capacity retry or command replay.
- Existing items and in-flight pre-RC2 orders keep legacy behavior; no retroactive random abilities.

## Phased implementation / PR gates

1. RC2.1: bounded personal recipe knowledge, explicit nearby teaching with evidence, crafting permission boundary, compatibility and replay tests. Existing recipe catalog and output effects preserved.
2. RC2.2–4: recipe tiers, accepted-order snapshot, deterministic quality and ability resolution, one-time mastery receipt and tier unlock; real tool and gear consumers. Only supported abilities are LIVE.
3. RC2.5–6: recipe/creator/tier/quality/ability UI and bounded autonomous crafting through existing commands; browser and public proof.

Each phase must pass exact-head regression/browser gates before merge and exact-main release verification afterward. UNKNOWN is never PASS. The user authorized continued execution without repeated approval questions.

## Scope decisions

The first complete RC2 release reuses existing item kinds and real material ledgers. Tiers describe craftsmanship; introducing iron/steel resource systems, loot blueprints, research, currencies, markets, durability, gather criticals or arbitrary combat ratings is not part of this release. Tool speed and existing Core6 gear modifiers have real consumers. Unsupported traits must not be rolled or shown as functional.

Mastery is bounded evidence-backed successful craft count per recipe, not a new free XP ledger. Teaching requires an actual living productive teacher who knows the recipe, a living productive recipient in range, and no duplicate knowledge grant. Starter survival recipes remain shared for compatibility; advanced recipes are personal.

## Must-pass acceptance

- Two people can have different advanced recipe permissions; unknown recipe craft is rejected without spending or advancing counters.
- Station ownership/range, actor life stage, bag/item/order caps and existing survival behavior are preserved.
- One accepted order consumes materials once, completes one item and grants mastery once; repeated completion cannot duplicate either.
- Same frozen ticket produces identical quality/abilities after save/load and independently of unrelated simulation RNG consumption.
- Item creator is the completing accepted crafter; tier equals its recipe; traits obey category-specific bounds and demonstrably affect the existing consumer.
- Legacy item/read/save behavior is unchanged. New metadata, forged permissions, out-of-range values and inconsistent outcome evidence fail closed.
- Changing equipped items never heals HP; ACTIVE combat loadout remains immutable.
- Autonomous crafting cannot starve housing/survival, interrupt active adventures, fill bags indefinitely or bypass recipe/material checks.
- Desktop/mobile UI shows actual creator and item results, rejects missing recipes/materials visibly and dispatches no gameplay writer itself.
- No Math.random / Date gameplay logic, no new inventory/HP/XP writer, no production changes to unrelated D3 renderer work.
