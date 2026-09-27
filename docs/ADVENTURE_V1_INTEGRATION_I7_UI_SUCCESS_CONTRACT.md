# Adventure V1 Integration I7 — Production Adventure UI + Browser Playtest

Status: CANDIDATE. MERGE NOT APPROVED.  
Parent: I6 exact head `d16792f7345e0ade95d36b591f700ec6d261c816` with Verify SUCCESS #1447.

## Goal

Expose the already-authoritative I0–I6 Adventure runtime through production UI without adding a gameplay writer.

The UI is a client of the engine. It may read state and submit existing commands only.

## Production surfaces

I7 adds:

- a compact Adventure launch control on the world,
- an Adventure panel showing Clone profession, qualification, Level/XP/HP, Khet zones and Rust gear slots,
- a persistent world HUD for expedition / encounter / combat / result,
- start-expedition buttons for unlocked zones,
- start-combat,
- BASIC_ATTACK,
- Fire loot claim,
- equip/unequip of already-owned Rust Adventure gear.

The existing five-button mobile navigation contract remains unchanged; Adventure is an overlay/world control rather than a sixth dock tab.

## Command-only boundary

The production UI sends only commands already owned by I0–I6:

- START_ADVENTURE_EXPEDITION
- START_ADVENTURE_COMBAT
- ADVENTURE_COMBAT_ACTION
- CLAIM_ADVENTURE_LOOT
- EQUIP_ADVENTURE_GEAR
- UNEQUIP_ADVENTURE_GEAR

The UI module does not mutate:
- agent.hp,
- profession,
- Adventure XP,
- encounter/combat state,
- Rust item/equipment state,
- position/path,
- save schema.

## Time semantics

Opening the Adventure selection dialog follows the existing game rule that dialogs pause simulation.

After START_ADVENTURE_EXPEDITION succeeds, the dialog closes immediately so the world can continue walking.

The expedition/combat HUD is not a dialog and therefore does not pause simulation.

## Qualification visibility

Non-Adventurers show real EXPLORE qualification progress (0..3) and cannot enter zones.

The UI does not invent a qualification shortcut. EXPLORE completion authority remains ADV0.

## Browser proof

The UI smoke suite must use the actual Independent-world save schema from the current branch.

It proves:
1. Adventure launch appears without adding a sixth mobile dock tab.
2. A valid Adventurer fixture renders profession/qualification/zone state.
3. Starting z1 routes through engine and leaves coordinates unchanged at command time.
4. The HUD appears during the real EXPLORE expedition.
5. Real simulation completion creates READY encounter and Start Combat UI.
6. Start Combat creates canonical ACTIVE session.
7. Attack sends expectedTurn through engine and increments exactly one turn.
8. Mobile page retains no horizontal overflow.
9. Existing UI smoke remains SAT.

## Deferred

- manual shortcut to qualify an Adventurer,
- Skills 1–3 / Dodge / Guard / Retreat,
- full non-Fire loot content,
- upgrade commit,
- specialization UI,
- defeat return/recovery,
- automatic Adventure AI policy.

## Acceptance

Exact-head Verify including Chromium UI smoke must succeed. UNKNOWN is not PASS.
