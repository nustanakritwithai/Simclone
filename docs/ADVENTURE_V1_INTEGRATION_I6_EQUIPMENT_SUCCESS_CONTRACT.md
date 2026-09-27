# Adventure V1 Integration I6 — Rust Equipment → CombatStats Projection

Status: CANDIDATE. MERGE NOT APPROVED.  
Parent: I5 exact head `a3ed866c589361e28f3605e950f954e201ff3f44` with Verify SUCCESS #1443.

## Goal

Use the existing Rust possession/equipment authority for Adventure Weapon / Armor / Accessory and project the SAT donor modifiers into the Adventurer CombatProfile.

No second equipment ledger is allowed.

## Admitted gear

Only the three definitions already present in the SAT ADV8/ADV9 donor are admitted:

- EMBER_BLADE — WEAPON — RARE — ATK +8, SPATK +4
- HIDE_ARMOR — ARMOR — COMMON — DEF +6, SPDEF +3, HP +12
- EMBER_CHARM — ACCESSORY — UNCOMMON — SPATK +5, SPD +2

I6 does not invent crafting costs, drop rates or recipes for these items.

## Ownership

Canonical item instances remain in `state.rustPossessions.items`.

Canonical equipment remains the one existing `state.rustPossessions.equipment` array.

Slots become:
- hand — existing Rust tool slot
- WEAPON
- ARMOR
- ACCESSORY

A missing `slot` on an old equipment row is interpreted as `hand` for old-save compatibility.

There is no `agent.adventureEquipment`, second bag, second item counter or second equipment array.

## Acquisition boundary

I6 registers the three gear kinds and adds a Rust-authority mint primitive for future approved craft/quest/reward authorities.

It is **not exposed as a player command** in I6.

No recipe is added because the donor contract did not approve a base crafting cost.

## Upgrade boundary

All I6 gear instances are exactly `upgradeLevel: 0`.

Although the admitted pure upgrade calculator supports +0..+10, I6 has no material-consumption authority for upgrades yet. A save/import carrying +1..+10 gear is rejected in I6 instead of granting free upgrades.

A later gate must atomically consume the donor-proposed material cost before widening this validator.

## Combat projection

The read-only equipment bridge:
- reads currently equipped Rust gear,
- maps each item to the admitted donor definition,
- calculates +0 modifiers through the existing pure upgrade/gear modules,
- enforces one item per Adventure slot,
- aggregates through the donor loadout bounds.

The combat session snapshots this loadout at combat start.

Gear changes are rejected while combat status is ACTIVE, so a turn cannot swap equipment after the combat snapshot.

## HP modifier semantics

`HP` is additive to combat `hpMax` only.

`agent.hp` remains the canonical 0..100 health ratio.

Equipping/unequipping HP gear does not heal or damage the Clone. Projection maps the unchanged ratio onto the modified combat hpMax.

## Acceptance

1. Existing hand-tool behavior and old slotless hand saves remain valid.
2. Rust equipment authority supports one hand + one WEAPON + one ARMOR + one ACCESSORY.
3. The three donor gear definitions produce exactly ATK 8 / DEF 6 / SPATK 9 / SPDEF 3 / SPD 2 / HP 12 when all are equipped at +0.
4. No agent-side equipment ledger exists.
5. HP gear changes projected hpMax while preserving agent.hp ratio.
6. Combat snapshots the loadout at start and active combat rejects gear changes.
7. Gear/loadout save/load is byte deterministic.
8. upgradeLevel > 0 is rejected until the later upgrade commit gate.
9. No invented gear recipe/acquisition cost is added.
10. Existing I0–I5 and project regressions remain SAT.
11. Exact-head Verify succeeds. UNKNOWN is not PASS.
