# Rust Crafting V2 — first playable Crafter Identity release

## Source and proof

Verified starting main: `4f9c573bf896c9a5e2ade1310f2287bab8e95a6f`, Pages #108 / run 36365258674 SUCCESS. SWA7 population gate is closed: 24 physical instances, 12 existing monster types. PR #171 completes the player-facing RC2 layer without merging donor #168 or touching another agent branch.

This source includes personal recipe knowledge, deterministic item outcomes, the recipe/item UI, teaching, and bounded practice. A release is SAT only when the **exact final PR head** passes Verify and the **exact merged main** passes Pages, native/public RC2 and public SWA7. Read the actual runs; this document does not pre-approve publication. Record the final SHAs and runs on PR #171 after they finish.

## Player flow

Select a Clone, then **ของ / Rust**. The recipe book lists 38 canonical recipes across T0–T5. It shows known/locked recipes, real completion counts, learning provenance, the next unlock requirement, station and material requirements, and the authority's reason when crafting is blocked.

**คราฟต์ 1 ชิ้น** sends the existing CRAFT_ITEM command. Close the dialog and unpause: the Clone walks to its station and works through the original task/order executor. The resulting Rust instance shows its stored tier, quality, actual functional abilities and creator. Expanding production history shows the accepted order, tick, mastery snapshot and deterministic roll ticket. No UI roll or second inventory exists. Legacy objects without outcomes are labelled honestly and never rerolled.

**ฝึก 2 ชิ้น** opts one Clone into one bounded batch. It is OFF by default. Accepted work still uses CRAFT_ITEM; completed receipts supply all progress. Safety, current work, housing, food/birth reserves, wood/stone reserves, capacity and reachable stations can block the next order. It never discards items, adds free XP, starts the next tier or re-arms itself. **หยุดรับงานฝึกใหม่** stops only future orders; accepted escrowed work remains in the original queue. Stale command revisions cannot restart a finished batch.

**ถ่ายทอดสูตร** uses TEACH_CRAFT_RECIPE for a known advanced recipe and a nearby productive-age student within two cells. The engine rechecks eligibility, range and provenance. Teaching does not grant crafting completions or XP.

Gear buttons use the existing Adventure equipment commands. Tool, weapon, armor and accessory slots coexist in the same ledger. Materials no longer receive a structure-placement button. Housing and held-tool views read the canonical hand slot even when armor appears earlier in the equipment array.

## Determinism and bounds

Recipe knowledge remains in `knowledgeState.recipes`; mastery is derived from bounded verified completion receipts. Craft order acceptance freezes the roll inputs. Practice stores only a versioned/revisioned preference, not a separate progress ledger. Save/load must preserve item metadata, tickets, receipts, and quota. UI rendering is read-only.

## Evidence commands

```
npm test
python tests/ui-smoke.py
python tests/rc2-crafting-smoke.py
python tests/rc2-crafting-smoke.py --native
PAGE_URL=<Pages URL> RELEASE_SHA=<exact merged SHA> python tests/rc2-crafting-smoke.py --public
```

The RC2 fixture is a validated Independent Same-World scenario with two physical personal houses and tables. Fixture starting resources and positioning are not claimed as gameplay achievements. The proof operates real buttons, observes real path/work/completion, checks exact native/public source bytes, records screenshots, and reloads real native storage. Offline proof is explicitly not public or native persistence proof.

## First-release limits

This release extends existing stone tools, hammer, building parts and Fire gear; it does not invent an iron/steel economy. Blueprint loot and physical consumption (docs-only donor #168), research/discovery, autonomous mentoring, market/currency/trading UI, durability, gather crit, new combat ratings and paid +1..+10 upgrades require separately verified authority integration. Tiers, quality and functional abilities are not a claim that those future systems exist.

## Local pre-public evidence

Desktop 1440×1000 and mobile 390×844 offline real-button lifecycle: 22/22 each, including teaching, advanced craft, bounded practice, stored outcomes and reload. Screenshots inspected for readability/overflow. Local native HTTP is UNKNOWN because this environment returns ERR_BLOCKED_BY_ADMINISTRATOR before boot; candidate CI and Pages retain native/public tests as required gates. Never substitute offline results for those gates.
