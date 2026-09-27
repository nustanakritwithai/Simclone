# ADV6 — Adventure Combat Resolver Success Contract

Status: Draft PR only  
Owner: ADVENTURE COMBAT RESOLVER  
Simclone base at branch creation: `65bfcfb241e1971a4cb06b8e7c7ac32110f7d1da`  
Pocket Monster donor pin: `f7f243d21906d9fa26127529313b441b4b938ce0`

## Scope

ADV6 adds one pure deterministic resolver for **Adventurer vs Wild Monster** actions.

Owned files:

- `src/adventure-combat.mjs`
- `tests/adventure-combat.test.mjs`
- `docs/ADV6_COMBAT_RESOLVER_SUCCESS_CONTRACT.md`

No engine, UI, inventory, loot, zone, profession, monster-catalog, persistence, or kingdom authority is added here.

## Donor contract retained

The resolver is an intentionally small adapter of the Pocket Monster V9.1.2 combat rules:

- shared level bounds: `1..60`
- Core combat vocabulary: `HP / ATK / DEF / SPATK / SPDEF / SPD`
- ratings: `accuracy / crit / evasion / resistance / penetration`
- Physical channel: `ATK -> DEF`
- Special channel: `SPATK -> SPDEF`
- hit chance: `actionAccuracy * attackerAccuracy * (1 - defenderEvasion)`
- combined penetration is capped at `0.95`
- type chart is the same 18-type runtime chart
- STAB: `1.5`
- critical multiplier: `1.5`
- deterministic variance: `0.9..1.0`
- base formula constants: level divisor `5`, damage divisor `50`, flat `+2`
- minimum successful direct damage: `1`
- RNG draw order: `hit -> critical -> variance -> statuses in definition order`
- HP result is lethal-clamped to `0`

Donor files reviewed at the pinned Pocket commit:

- `combat-v91-contract.mjs`
- `combat-v91-rules.mjs`
- `type-catalog.mjs`
- `damage-resolver.mjs`
- `combat-v91-status.mjs`
- `combat-v91-rng.mjs`
- `docs/combat-v91-client-handoff.md`

## Input contract

```js
resolveAdventureCombat({
  attacker: CombatProfile,
  defender: CombatProfile,
  action: CanonicalAction,
  rng: { seed, ticket, sequence? },
  worldModifiers?: {
    attacker?: Partial<CombatMultipliers>,
    defender?: Partial<CombatMultipliers>
  }
})
```

`CombatProfile` may be flat or donor-shaped with the combat values under `stats`.

Required semantic values:

```js
{
  level,            // integer 1..60
  types,            // 0..2 unique Pocket runtime types
  hpMax, hpCurrent,
  atk, def, spAtk, spDef, spd,
  accuracy, crit, evasion, resistance, penetration
}
```

The resolver accepts `types` separately from the 12 combat numeric fields because type identity is required for STAB/effectiveness.

Canonical action:

```js
{
  actionId,
  channel,          // physical | special
  power,
  accuracy,
  element,          // Pocket runtime type | null
  criticalAllowed,
  armorPierce,
  hitCount,
  statusApplications: [
    { statusId, target: 'attacker' | 'defender', chance, resistible? }
  ]
}
```

`actor/target` aliases from the donor status-target vocabulary are accepted and normalized to `attacker/defender`.

## Output contract

The only successful resolver product is a frozen `CombatOutcome` proposal:

```js
{
  schemaVersion,
  rulesVersion,
  committed: false,
  actionId,
  channel,
  hit,
  hitChance,
  critical,
  criticalChance,
  damage,
  hpBefore,
  hpAfter,
  typeMultiplier,
  stabMultiplier,
  varianceMultiplier,
  attackStat,
  defenseStat,
  effectiveDefense,
  combinedPenetration,
  hitDamages,
  speedOrder,
  statusProposals,
  rngTrace
}
```

Invalid inputs fail before resolution by throwing `TypeError` / `RangeError`; there is no partial state write or success wrapper.

## SPD contract

Pocket's single-action damage formula calculates effective `SPD` but does not mix speed into direct damage. Multi-actor initiative/sequence is a separate authoritative ordering concern.

ADV6 therefore:

1. validates `SPD`,
2. applies immutable world SPD multipliers,
3. emits deterministic `speedOrder` (`attacker_faster`, `defender_faster`, or `tie`),
4. **does not** alter damage from SPD and **does not** commit encounter sequence.

A later Adventure encounter sequencer may consume this projection; ADV6 does not become that writer.

## Status contract

ADV6 produces **status proposals only**. It does not own or commit a runtime status ledger.

For each eligible status application:

```text
finalChance = baseChance * (1 - recipientResistance)
```

unless `resistible: false`.

Status RNG follows action definition order. A damaging action that deals zero damage because of immunity does not apply attached status. A defeated defender does not receive a post-lethal status proposal.

## Deterministic RNG

ADV6 has no `Math.random` and no `Date`/wall-clock dependency.

The local stream is deterministically derived from:

- rules version
- seed
- ticket
- sequence
- optional attacker/defender entity IDs (or stable role labels in fixtures)
- canonical action
- canonical immutable world modifiers

It is a replay stream, not a security/token generator. The Pocket donor uses a SHA-256 counter stream at the server authority boundary; this isolated Simclone resolver keeps the same deterministic ordering contract without claiming to issue or verify server RNG tickets.

## Authority boundary

Hard invariant:

```text
CombatProfile snapshot + Action + RNG ticket + immutable World modifiers
  -> pure resolver
  -> CombatOutcome(committed=false)
```

Forbidden writes/imports:

- no `agent.hp =`
- no monster save
- no inventory write
- no XP write
- no profession write
- no engine import
- no DOM
- no `Math.random`
- no `Date`

The caller/owner may decide whether and how to commit an accepted outcome later. ADV6 never does it.

## Acceptance proof

`tests/adventure-combat.test.mjs` must prove:

| Gate | Required result |
|---|---|
| same seed/input = same outcome | SAT |
| Physical uses ATK/DEF | SAT |
| Special uses SPATK/SPDEF | SAT |
| type immunity = 0 damage | SAT |
| level bounds 1..60 | SAT |
| HP cannot go below 0 | SAT |
| invalid profile rejected | SAT |
| resolver leaves input byte-identical | SAT |
| accuracy/evasion deterministic | SAT |
| crit deterministic | SAT |
| penetration deterministic | SAT |
| SPD projection deterministic | SAT |
| status proposals only | SAT |

UNKNOWN is never PASS.

## Out of scope

- engine integration
- UI/HUD
- loot/reward settlement
- XP/profession progression
- monster definition/catalog ownership
- encounter spawning/zones
- persistence
- capture/party/ranch/bond/breeding/egg/owned-monster systems
- authoritative HP/status commit transaction
- multi-actor sequence writer
