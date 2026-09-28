# RC2 Blueprint donor — NOT PRODUCTION

Base: 7538ab583b1b192b7a502eb40e0c7faa016416f9 (Pages #105/public SWA7 SAT).
Canonical crafting workstream: PR #166, `feature/rc2-crafter-identity`.
This directory is owned by the independent verification/Blueprint follow-on workstream.

No runtime, catalog, import map, engine, UI, inventory or personal knowledge is changed.
Do not merge/copy this donor into production until canonical recipe/mastery APIs
are released and separately reviewed. This is not a second crafting system.

## Executable scope

`proposeBlueprintLoot` is a pure, deterministic, bounded proposal. It accepts a
catalog snapshot, monster snapshot, verified defeat, world seed and stable ticket.
It emits at most one RARE physical Blueprint proposal using the EXISTING Adventure
loot claim key. `committed:false` is always retained. No grant or learning occurs.

Draft balance (not a claim about current live loot):

- Normal: 12.5%; Elite: 25%; Boss: 50%.
- Monster levels 1–12 -> T1 cap, 13–24 -> T2, 25–36 -> T3,
  37–48 -> T4, 49–60 -> T5.
- Only explicit non-starter recipes enter the pool. No synthetic fallback formula.
- One finite catalog recipe maps to one registered Blueprint item kind.
- Known recipes are NOT part of the lottery: learning/forgetting cannot reroll it.
- Catalog order is normalized by code-point order, not host locale.
- A JSON tuple and domain-separated FNV32 hash avoid free-string delimiter collisions.
- Hash is deterministic evidence, NOT a cryptographic anti-cheat signature.

## Frozen-ticket integration contract — still UNKNOWN

1. At combat session creation, capture an immutable Blueprint offer/ticket using
   canonical recipe definitions and the accepted monster identity/level/rank.
   Persist its version, catalog revision and resulting proposal. Do NOT reselect
   from a newer catalog or the person's current knowledge when claiming loot.
2. A stable catalog version must identify immutable definitions. Retain a legacy
   resolver or saved canonical offer; absent offers in old sessions mean no new
   Blueprint, not retroactive migration that invents earned loot.
3. Only existing VERIFIED victory + committed reward authorizes merging the offer
   into the existing loot proposal and `grantAdventureLoot` call. No separate grant
   command/ledger, no reward for failed/UNKNOWN/defeated/retreated outcomes.
4. Register Blueprint item kinds in the canonical Rust catalog with a recipe link.
   The existing Rust item ID/sourceClaimKey/ownership/location are authoritative.
5. Learning consumes an owned physical Blueprint atomically through the same Rust
   writer and records provenance through the single `knowledgeState.recipes`
   authority. Unknown IDs, malformed offers, wrong ownership, already-known
   formula, death, child, active combat or open loot receipt must not consume it.
6. Finish the loot result before consuming receipt-referenced items: current
   `validateAdventureLootClaimState` still requires every granted ID to exist.
7. Claim replay must not regrant even after a Blueprint is consumed. Prove the
   existing session/result boundary; don't infer durable idempotency merely from
   searching remaining `sourceClaimKey` items.
8. Incoming item budgets must reserve pending craft outputs. A full bag drops loot
   at the actor's real position; global item cap cannot be bypassed by a pending
   craft or new Blueprint.
9. UI reads the actual Rust bag/recipe book and dispatches the validated learning
   command. No preview grants, fake Blueprint, independent knowledge or XP.
10. Require exact-head unit/browser proof, expected-head merge, exact-main Pages,
    public learning/craft/save-load and unchanged SWA7 lifecycle before LIVE.

## Evidence (local, donor only)

Run: `node --test docs/wip/rc2-blueprints/blueprint-proposal.test.mjs`

13/13 tests SAT, no skipped tests. Includes all 60 levels x 1,000 tickets for tier
isolation; 10,000-ticket samples per rank yielded Normal 1,241, Elite 2,502, Boss
4,991 drops. These are deterministic sample counts, not a proof of statistical
independence or guaranteed future rates. Golden vector pins v1 output.

Production integration, actual Blueprint loot, learning, UI and public behavior
remain UNKNOWN and are NOT inferred from donor success.
