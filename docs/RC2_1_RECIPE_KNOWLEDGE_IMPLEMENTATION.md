# RC2.1 — personal recipe authority

Base: released main 7538ab583b1b192b7a502eb40e0c7faa016416f9 / Pages #105 SUCCESS.

Implemented in this phase:
- Bounded additive `knowledgeState.recipes`; no eviction or changes to resource beliefs.
- Absent namespace means exactly nine released survival recipes, not all advanced recipes. Reads and old-save reload remain byte-identical.
- Fourteen advanced tool recipe variants give explicit tier chains up to T5. `RECIPE_CATALOG` remains the released survival/UI view; all crafting authorities use `CRAFT_RECIPE_CATALOG` / `recipeById`, one definition per recipe.
- Craft permission rejects unknown personal recipes before materials/counters change.
- Verified completion receipts are required to unlock advanced knowledge, so the minimal mastery receipt foundation is included here rather than granting recipes without evidence. Two completions unlock the next recipe tier. Each recipe keeps the latest eight receipts plus a bounded retired count; no generic crafting XP is created.
- Actual nearby teacher can transfer a known recipe through `TEACH_CRAFT_RECIPE`. Child/dead/self/out-of-range/unknown-source/cyclic-evidence cases fail closed. A replay is a no-op.
- Original crafter identity and sole Rust item/material/station authority remain unchanged. Old in-flight orders complete without invented retrospective mastery.

Not yet delivered by this phase: per-item quality/ability generation and its consumers; advanced crafting UI; autonomous tool/gear planning. These are subsequent RC2 gates. Recipe tier existence alone is not an item-stat upgrade claim.

Local evidence for the exact source blob set:
- New recipe suite: 16/16 PASS.
- Full npm test: 783/783 PASS, no failures/skips.
- Existing Rust craft/build/cache checks retained.
- Runtime import pins generated with the repository's Node crypto script, not hand-written hashing; uploaded blob IDs checked against local git hashes.

Exact-head GitHub Verify, its browser/native smoke and post-merge Pages remain required. UNKNOWN is never PASS.
