# ADV8 / ADV9 — Loot, Equipment and Upgrade Success Contract

Status: proposed contract for `feature/adventure-loot-gear`

## 1. Scope

This slice owns calculation-only rules for:

- deterministic monster reward proposals
- Weapon / Armor / Accessory combat-stat modifiers
- deterministic `+0 -> +1 -> ...` upgrade proposals

It does **not** own possession or persistence.

Out of scope and forbidden in this slice:

- `adventureBag`
- `lootWallet`
- `khetInventory`
- any second item ledger
- Rust inventory writes or material consumption
- `engine.mjs`
- combat resolver logic
- monster catalog logic
- zone / encounter logic
- UI

The Rust possession/inventory authority remains the only future commit authority for actual items/materials.

## 2. Loot proposal contract

Canonical input shape:

```js
{
  monster: {
    monsterId: 'fire-slime-l1',
    primaryType: 'FIRE' // or lootProfileId: 'FIRE'
  },
  rank: 'NORMAL' | 'ELITE' | 'BOSS',
  outcome: {
    outcomeId: '...',
    verified: true,
    defeated: true
  },
  rngTicket: 'immutable-ticket'
}
```

A reward proposal is legal only after a verified defeat. Unverified or non-defeat outcomes are rejected.

Current Fire loot profile:

- `FIRE_CORE` — guaranteed; quantity increases by rank
- `HIDE` — deterministic ticketed chance
- `EMBER_SHARD` — deterministic ticketed chance

No `Math.random`, wall clock, DOM, mutable global state, inventory lookup or inventory write is permitted.

Canonical output:

```js
{
  sourceMonsterId,
  outcomeId,
  claimKey,
  items: [
    { itemKind, quantity, rarity }
  ]
}
```

`claimKey = "ADVENTURE_LOOT:" + outcomeId`.

### Duplicate outcome / claim rule

This proposer is intentionally stateless. Therefore duplicate protection is an integration invariant:

1. The Rust item authority MUST treat `claimKey` / `outcomeId` as the idempotency key for the reward commit.
2. A second commit attempt with the same `claimKey` MUST be rejected or return the already-committed result.
3. A different RNG ticket submitted for an already-seen outcome ID MUST NOT create a second claim.
4. The proposer never marks an outcome claimed and never creates a shadow claim ledger.

This means a duplicate `outcomeId` cannot imply a second legal inventory grant, even if a caller incorrectly asks the pure proposer to calculate again.

## 3. Quantity bounds

All quantities are non-negative integers.

Rank rule bounds:

| Rank | Guaranteed Fire Core | Optional item quantity cap |
| --- | ---: | ---: |
| NORMAL | 1 | 2 |
| ELITE | 2 | 3 |
| BOSS | 3 | 4 |

The proposer rejects unsupported ranks and unsupported loot profiles instead of guessing.

## 4. Equipment contract

Supported slots:

- `WEAPON`
- `ARMOR`
- `ACCESSORY`

Supported combat modifier vocabulary:

- `ATK`
- `DEF`
- `SPATK`
- `SPDEF`
- `SPD`
- `HP`

`HP` is approved only as a bounded additive **max-HP modifier proposal**. This module never writes `hpCurrent`, never heals, and never decides HP clamping after equip/unequip. The combat-stats/integration owner must define final HP application semantics.

Per-item bounds:

```text
ATK <= 60
DEF <= 60
SPATK <= 60
SPDEF <= 60
SPD <= 20
HP <= 180
```

One equipped item per supported slot. Duplicate slots are rejected.

Aggregate loadout bounds:

```text
ATK <= 100
DEF <= 100
SPATK <= 100
SPDEF <= 100
SPD <= 30
HP <= 300
```

Modifiers are additive proposals only. They do not mutate CombatProfile, inventory, save state or engine state.

## 5. Upgrade contract

Upgrade levels are bounded:

```text
+0 .. +10
```

Each proposal advances exactly one level.

V1 upgrade is intentionally deterministic and has no success/failure roll:

```text
modifierAt(level) = round(baseModifier * (100 + 10 * level) / 100)
```

The result is then clamped to the per-item modifier bounds.

Material requirement proposal:

```text
quantity = min(1 + floor(fromLevel / 2), 6)
```

The material kind comes from the immutable gear definition (`upgradeMaterialKind`).

The upgrade module does not:

- check possession
- reserve materials
- consume materials
- change an item instance
- write upgrade level
- write inventory

The Rust authority/integrator must validate possession and atomically commit any approved upgrade later.

## 6. Determinism and purity gates

Required proofs:

- same monster + rank + verified outcome + RNG ticket -> identical LootProposal
- all proposed quantities are integer, bounded and never negative
- same `outcomeId` -> same claim key
- integration contract forbids a second reward commit for a duplicate outcome/claim key
- same gear + level -> identical upgrade proposal
- upgrade advances exactly one level and never exceeds `+10`
- stat modifiers are restricted to the canonical vocabulary and bounded
- input objects remain unchanged
- no `Math.random`
- no Date/wall-clock gameplay rule
- no DOM
- no inventory or engine writer

## 7. Acceptance state

`SAT` only when all new Node tests pass and the branch diff contains only the approved pure modules, test, and this contract.

`UNKNOWN` is not PASS.
