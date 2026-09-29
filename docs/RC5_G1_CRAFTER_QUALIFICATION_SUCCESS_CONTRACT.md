# RC5 G1 — Crafter Qualification Evidence Success Contract

Status: **CANDIDATE / NOT RELEASED**. UNKNOWN never passes a gate.

## Baseline

This work must start from current main `ec8709f6c6543ee76dba97f11d52beebefc307e0`.
RC4 runtime production is released at `1ff2907c4e69af8adc336792105894542576433b`
with exact-main Verify #2160 and Pages #113 SUCCESS. The later main commit is RC4
closeout metadata. RC4 donor branches are historical and must not be merged again.

PR #195 is a stale RC3.2-based design donor only. Its accepted ideas may be ported
onto current main; its commits must not be merged or rebased over RC4.

## G1 goal

Create one fail-closed, read-only canonical-root projection answering:

> Has this living Builder actually done construction work AND accumulated enough
> verified same-family crafting mastery to be eligible for a future Crafter transition?

G1 does NOT change profession, does NOT gate crafting tiers, does NOT change item
quality, and does NOT add UI/autonomy.

## Authority locks

- Profession remains `kingdom-utility.mjs`; G1 never calls `adoptProfession`.
- Construction state remains Housing + Rust station placement + Skill Provenance.
- Recipe mastery remains `knowledgeState.recipes` verified by the existing receipt
  validator and `recipeMastery()`.
- Items remain Rust possessions. Ownership or purchase of an item is not crafting
  experience.
- No Craft XP, Crafter level field, new receipt ledger, new inventory, new RNG,
  new save root or migration.
- Merchant and Adventurer remain locked special professions.
- UI/caller snapshots are not evidence. Future G2 must re-read the live root.

## Construction evidence

Initial/inherited BUILD XP alone is insufficient.

Construction is CONFIRMED when the current root is structurally valid and at least
one of these canonical facts exists:

1. validated `skillProvenance.bySkill.BUILD.earnedXP > 0`; or
2. a Rust station record has `placedBy === agent.id` and its socket is part of a
   currently complete modular house.

This dual route is deliberate. Autonomous house completion currently awards BUILD
earned XP, while a valid manual PLACE_STATION path can complete a house without
awarding that XP. G1 must recognize both without inventing a replacement writer.

Malformed Skill Provenance or Rust station metadata is UNKNOWN, even if another
fact looks plausible.

## Craft evidence

Specialties are the six existing physical output families:

- STONE_AXE
- STONE_PICKAXE
- HAMMER
- EMBER_BLADE
- HIDE_ARMOR
- EMBER_CHARM

Per-family counts are derived only from validated existing per-recipe mastery,
including `retiredCompletions` after bounded receipt compaction.

Qualification threshold for G1:

- total verified completions in one family >= 6; and
- verified T2 completions in that same family >= 2.

This projects grade CRAFTER and a future max-new-tier of T3. Higher grade projections
retain the RC5.0 candidate thresholds: Expert = 16 total + 4 T3; Master = 32 total
+ 6 T4. G1 does not enforce those tiers.

Blueprint/teaching knowledge without successful production is zero mastery.
Buying, receiving, equipping or placing somebody else's crafted item is zero mastery.

## Result vocabulary

`crafterQualificationProjection(state, agentId)` returns:

- SAT: canonical read model currently meets G1 evidence requirements.
- VIOL: authoritative facts disqualify it (wrong career, no work, dead/stage, etc.).
- UNKNOWN: required authority data is malformed/ambiguous.

Every result has `commitAllowed:false`. SAT is a proposal for G2 only; it is not
permission to assign `profession='crafter'`.

## Must-pass attacks

- initial/inherited BUILD XP but no construction work → VIOL
- manual real modular-house contribution → construction CONFIRMED
- construction with no craft mastery → VIOL
- six same-family completions with two T2 → SAT
- recipe knowledge with zero completion → no mastery
- bought/received items → no mastery
- unrelated-family mastery → no leakage
- malformed BUILD provenance → UNKNOWN
- malformed mastery receipt → UNKNOWN
- Merchant/Adventurer → special lock
- other worker → Builder required
- receipt compaction retains totals without a new XP ledger
- save/load retains the projection
- reads are byte-stable / mutation-free
- exact family ids only; no coercion trick

## Next gate

After exact-head G1 Verify succeeds, G2 may add the canonical Crafter profession
transition and high-tier craft capability validation. G2 must use current-root G1
evidence internally and the existing profession authority; it may not accept a
caller-supplied SAT projection.

G3 quality versioning remains separate. Existing RC2 accepted orders/items must
continue under their frozen outcome version.
