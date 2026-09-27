# Adventure V1 Integration I3 — Combat Session + Canonical HP Commit

Status: CANDIDATE. MERGE NOT APPROVED.  
Parent: I2 exact head `44f9916c23e54660867a33378bf8ab9dacc42406` with Verify SUCCESS #1439.

## Goal

Turn a READY encounter into a deterministic combat session and commit incoming combat damage to the existing Simclone `agent.hp` authority.

```text
READY encounter
→ START_ADVENTURE_COMBAT
→ neutral Adventurer CombatProfile
→ Pocket-derived Wild Monster CombatProfile
→ pure ADV6 resolver
→ engine commits result
```

I3 does not grant XP, loot, equipment, status effects or permanent combat death.

## Human CombatStats policy

I1 Adventure level is the only progression input.

Unspecialized Adventurer I3 uses a neutral Pocket-shaped baseline:
- Core6 base = 50 each,
- potential = 15,
- training = 0,
- same level-scaling form used by the admitted Pocket monster stat adapter,
- ratings: accuracy 1, crit 0.05, evasion/resistance/penetration 0,
- no elemental type in I3.

Ordinary FORAGE/WOODCUT/MINE/BUILD skill values are not converted into combat stats.

Ranger/Guardian/Ritual and equipment modifiers remain later gates.

## HP authority

Human health authority remains exactly `agent.hp` (0..100).

The combat session stores monster HP because a wild encounter needs its own ephemeral target state. It must not persist `agentHpCurrent`, `humanHpCurrent` or another human health ledger.

ADV1 conversion helpers project `agent.hp` into Pocket integer HP for each action. After a monster counterattack, engine commits the projected ratio back into `agent.hp`.

Until the dedicated defeat/death gate:
- a combat knockout becomes `DEFEATED`,
- engine commits `agent.hp = 1`,
- combat must not invoke permanent death or mislabel defeat as starvation.

## Turn/replay authority

I3 admits only `BASIC_ATTACK`.

Each command requires `expectedTurn === session.turn`.
After a successful commit, the turn increments exactly once.
Replaying the old command is rejected as `stale-turn` and changes nothing.

RNG tickets derive from:
`combatId + turn + actor-role`.

## Session states

- ACTIVE
- VICTORY
- DEFEATED

VICTORY/DEFEATED are terminal evidence for later gates. No reward is committed in I3.

## Acceptance

1. Combat can start only from a READY encounter at the Clone's real position.
2. Human combat profile is deterministic from I1 level + canonical agent.hp only.
3. Session stores monster HP but no second human HP ledger.
4. BASIC_ATTACK uses the pure ADV6 resolver.
5. Incoming damage commits to existing `agent.hp`.
6. Combat knockout leaves the Clone alive at hp=1 and status DEFEATED.
7. Same save + same expected turn produces byte-identical continuation.
8. Replay of an already committed turn is rejected without state change.
9. VICTORY does not grant Adventure XP or Rust items.
10. Existing I0–I2 and project regressions remain SAT.
11. Exact-head Verify succeeds. UNKNOWN is not PASS.
