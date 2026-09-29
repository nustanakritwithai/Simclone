# RC5.1 — Crafter Career + High-Tier Capability Gate — Success Contract

Status: RUNTIME CANDIDATE / UNKNOWN until exact-head Verify succeeds.  
UNKNOWN is never PASS.

## Source

- Build from current post-RC4 closeout main `ec8709f6c6543ee76dba97f11d52beebefc307e0`.
- RC4 Merchant Economy production source is `1ff2907c4e69af8adc336792105894542576433b`.
- RC4 exact-main Verify #2160 and Pages #113 are recorded SUCCESS in the released closeout.
- PR #195 is a superseded RC5.0 model donor only. Do not merge/cherry-pick it.
- This slice must retain RC4 Producer → Merchant → Customer, Adventure, RC2 Crafting,
  Blueprint, RC3.2 Iron/Steel and save/load behavior.

## Player contract

The construction profession can mature into **Crafter / ช่างประดิษฐ์** through
real work. Recipe knowledge remains necessary but no longer alone authorizes every
new high-tier craft in a newly activated RC5 world.

No Craft XP or persisted Craft Level is introduced.

A person's family grade is derived from the existing verified per-recipe completion
authority:

`recipeMastery = retiredCompletions + retained verified receipts`.

Grades are per physical output family. Hammer work does not grant sword mastery.

| Grade | Same-output-family evidence | Maximum new tier |
|---|---|---|
| Apprentice | baseline | T2 when current profession is Builder/Crafter |
| Crafter | >=6 total, including >=2 T2 | T3 |
| Expert | previous + >=16 total, including >=4 T3 | T4 |
| Master | previous + >=32 total, including >=6 T4 | T5 |

Master requires T4 evidence, never an already-made T5. First T5 remains reachable.

## Canonical Crafter qualification

A transition to Crafter requires all of:

1. living productive-age person;
2. current canonical profession is `builder`;
3. valid recipe-knowledge state;
4. permanent canonical construction evidence from `rustStations.stations`:
   at least one complete structure piece with `structurePiece===true`,
   `placedBy===agent.id`, valid station id and placement id;
5. at least one output family at Crafter grade.

The projection is read-only. The only profession writer is
`kingdom-utility.mjs -> adoptProfession()`.

Accepted transition:

```text
evaluateCrafterQualification(live root)
→ SAT
→ adoptCrafterProfession()
→ adoptProfession(agent, 'CRAFTER', tick, explicit crafter-v1 evidence)
→ canonical career row
```

Direct caller assignment to `agent.profession` is not an RC5 path.

## Special-profession locks

- Crafter cannot overwrite Merchant.
- Crafter cannot overwrite Adventurer.
- Merchant cannot overwrite Crafter.
- automatic Adventurer qualification cannot overwrite Crafter.
- ordinary FORAGE / WOODCUT / MINE / BUILD selection cannot demote Crafter.
- Crafter transition must originate from Builder.

A future explicit special-to-special transition policy is out of scope.

## Craft acceptance gate

The gate belongs inside the existing Rust craft acceptance path and runs **before**
materials/items are escrowed.

The caller must still separately satisfy existing:

- productive life stage;
- valid recipe knowledge;
- no active combat / conflicting craft;
- canonical materials and physical item ingredients;
- canonical station availability;
- bag/order capacity.

RC5 adds only career capability:

- T0/T1: existing survival access retained.
- T2: Builder or Crafter.
- T3: Crafter grade or higher in the same output family.
- T4: Expert or Master in the same output family.
- T5: Master in the same output family.

An accepted order is frozen work. Later profession changes must not invalidate the
already-escrowed order or cause a second spend.

## Old-save compatibility

RC5 does not silently revoke recipes learned under RC2/RC3 rules.

New worlds receive an empty canonical `crafterPolicy` at creation.

When restoring a valid older save that has no RC5 policy, exactly one migration:

1. scans explicit personal recipe entries;
2. records only already-known T2–T5 recipe ids per retained person;
3. stores sorted unique bounded ids in `crafterPolicy.grandfathered`;
4. marks `migratedFromLegacy:true`;
5. never adds future recipes to the grandfather set.

A grandfathered recipe bypasses only the **new career capability gate**.
Recipe knowledge, actor, station, material, item, reservation and order validation
still apply normally.

Client payloads cannot request grandfathering. A malformed policy is corruption
and fails validation. Migration is deterministic and idempotent.

## Construction provenance decision

RC5 intentionally reads permanent station records rather than the bounded
`rustStations.placements` tail. Receipt/log compaction therefore cannot erase
qualification evidence.

A Crafting Table or Furnace is not a structure piece and does not count as
construction qualification. Foundation/wall/doorway/roof placement through the
canonical Rust writer can count.

## Automatic qualification checks

Trusted engine orchestration re-evaluates Crafter qualification after:

- a successful physical structure placement;
- a successful completed Craft order.

This permits either evidence family to arrive last without adding another command
or UI-owned profession switch.

The check itself cannot manufacture construction or recipe evidence.

## Persistence

`crafterPolicy` is additive state under the existing save version. It is validated
on every normal `validate()` call.

Career state remains the existing:

- `agent.profession`;
- `agent.professionSinceTick`;
- bounded `agent.career`.

No second Crafter career ledger is permitted.

## UI

The recipe book continues to read `craftPreview()`. It may display these
fail-closed reasons:

- `crafter-builder-required`
- `crafter-profession-required`
- `crafter-grade-required`
- `crafter-policy`
- `crafter-evidence`

UI never supplies grade, mastery, construction proof, grandfather state or
profession evidence.

## Not in RC5.1

RC5.1 does **not** change the RC2 quality formula.

Existing `RC2-order/1` and `RC2-outcome/1` must remain verifiable for old items
and accepted orders. The requested higher Masterwork probability belongs to RC5.2
and requires a new versioned accepted-order/outcome contract, not an in-place
formula rewrite.

RC5.1 also does not add durability, critical gathering, arbitrary item stats,
another inventory, another station authority, autonomous production demand or
merchant price rules.

## Must-pass attacks

- non-Builder cannot self-promote Crafter;
- Merchant/Adventurer special locks;
- missing construction evidence does not qualify;
- Crafting Table alone does not count as structure construction;
- malformed recipe evidence does not qualify;
- unrelated-family mastery cannot unlock another family's T3–T5;
- Blueprint/teaching knowledge alone does not grant high-tier capability;
- bought item ownership does not grant mastery;
- T5 has no circular T5 prerequisite;
- new-world forager cannot use T2 merely by knowing it;
- old save keeps only recipe permissions that existed before migration;
- post-migration learned high-tier recipe is not grandfathered;
- malformed/duplicate/unsorted grandfather records fail validation;
- migration is one-shot;
- accepted high-tier escrow remains valid after later career-state change;
- replayed qualification does not duplicate career rows;
- no material/item is spent when capability gate rejects;
- full RC4/Adventure/RC2/RC3.2 regressions remain green.

## Verification gate

Candidate:

```text
npm test
active Chromium UI smoke
Independent desktop smoke
RC2 crafting smoke
RC3.2 Iron/Steel smoke
RC4 Merchant production/regression gates
```

Runtime source changes require regenerated exact import-map pins.

Release still requires:

```text
exact-head Verify SAT
→ merge
→ exact merged-main Verify/Pages SAT
→ public exact-byte/browser proof
```

Candidate CI success is not production evidence.
