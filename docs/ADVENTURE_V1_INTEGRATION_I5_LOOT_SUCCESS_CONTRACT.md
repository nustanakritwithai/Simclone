# Adventure V1 Integration I5 — VERIFIED Loot → Rust Possession Authority

Status: CANDIDATE. MERGE NOT APPROVED.  
Parent: I4 exact head `b021a1feb48cc9dd00a3d5817556cac1d0d8797c` with Verify SUCCESS #1441.

## Goal

Commit admitted Adventure LootProposal outputs into the existing Rust possession ledger without creating an Adventure inventory.

```text
I4 VERIFIED VICTORY
→ CLAIM_ADVENTURE_LOOT
→ donor adventure-loot proposal
→ Rust possession authority
→ bag first / physical drop overflow
```

## Content admitted in I5

I5 does not invent new loot families. It admits only the item kinds already present in the SAT loot donor:
- FIRE_CORE — UNCOMMON
- HIDE — COMMON
- EMBER_SHARD — RARE

They are registered in the existing Rust item catalog as non-craft material items.

The admitted loot donor currently defines only the FIRE profile. Other monster types fail closed with `unsupported_loot_profile` and mutate nothing. Expanding all 18 type profiles is a separate content gate, not an Integration Lead invention.

## Single possession writer

Only `src/rust-possessions.mjs` may mint item instances.

I5 adds a dedicated Rust-authority function that:
- validates donor loot item kinds/rarity/quantity,
- pre-validates total item capacity before mutation,
- creates canonical Rust item instances,
- fills existing bag capacity first,
- physically drops overflow at the Clone's actual x/y,
- tags created instances with the loot claimKey for idempotency,
- rejects unknown/mismatched duplicate claims without partial mutation.

No `adventureInventory`, loot bag, second item ID counter or second persistence ledger exists.

## Claim gate

`CLAIM_ADVENTURE_LOOT` requires:
- living Clone,
- terminal VICTORY,
- Adventure terminal evidence VERIFIED,
- I4 reward receipt VERIFIED + COMMITTED and linked to the same outcome.

The proposal uses:
- actual monsterId,
- monster primary type,
- encounter rank,
- I4 outcomeId,
- combatId as deterministic RNG ticket.

## Replay/idempotency

Loot proposal claimKey is `ADVENTURE_LOOT:<outcomeId>`.

Rust item instances carry `sourceClaimKey`.
If the same claimKey with the same exact item multiset is presented again, Rust returns the already-created item IDs and performs no mint.

The combat session also stores one bounded loot receipt linking claimKey, outcomeId, source monster, item IDs, bag/drop counts, proposal rows and committed tick. The receipt is evidence, not another inventory.

## Still deferred

- all non-Fire loot profiles,
- gear item mint/crafting,
- equipment CombatStats modifiers,
- upgrade material consumption,
- UI claim button/live loot result,
- automatic claim policy.

## Acceptance

1. Rust catalog validates with exactly the admitted donor loot kinds.
2. Loot mint occurs only inside Rust possession authority.
3. Bag fills first and overflow becomes physical drops at real coordinates.
4. Claim is atomic against global Rust item capacity.
5. Duplicate claimKey creates no duplicate item.
6. VERIFIED Fire victory claims the exact deterministic LootProposal.
7. Unsupported non-Fire profile fails closed with byte-identical state.
8. Loot receipt + Rust items save/load deterministically.
9. No Adventure inventory or second item counter exists.
10. Existing I0–I4 and project regressions remain SAT.
11. Exact-head Verify succeeds. UNKNOWN is not PASS.
