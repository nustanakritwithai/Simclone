# RC5.2 — Versioned Masterwork Quality G3 Success Contract

Status: STACKED DRAFT on RC5.1 PR #198. UNKNOWN never passes.

## Baseline / dependency

- Parent candidate: `23f0c07c394311f32e54938eca23a75008f7d60f` from `feature/rc5-crafter-career-g1-g2-20260929`.
- Do not merge this branch before RC5.1 is exact-head SAT and merged/rebuilt on current main.
- This gate changes only **new craft outcome versioning and presentation**.
- T3–T5 profession restriction remains HOLD. Recipe permissions are unchanged.

## Goal

A Crafter's validated same-family practice changes the probability window for newly
accepted items without rerolls, second inventory, global RNG, or retroactive edits.

Quality remains one deterministic value from 30..100. Crafting itself still succeeds
through the existing accepted-order executor; there is no random material-loss fail.

## Versions

Existing accepted orders/items keep:

- `RC2-order/1`
- `RC2-outcome/1`

Those evaluators are frozen and continue to validate/complete.

New accepted orders use:

- `RC5-order/1`
- `RC5-outcome/1`

A new order freezes:
`worldSeed + orderId + creatorId + recipeId + familyMastery + grade + ticket`.

The output stores the frozen grade with the existing creator, tier, quality, ticket
and abilities. Save/load, UI opening, time, global RNG and later mastery cannot
reroll that accepted order.

## Canonical grade source

`rust-possessions.mjs::queueCraft()` does not accept grade/mastery from the caller.

- mastery = existing `craftFamilyMastery()`
- if current profession is not Crafter, frozen grade = APPRENTICE
- if current profession is Crafter and the output is an RC5 tracked family, grade
  comes from live `crafterFamilyProfile()`
- building pieces remain APPRENTICE in G3

Pending RC5 order validation binds frozen mastery to the live mastery and forbids a
frozen grade above the live canonical grade. A recomputed deterministic ticket alone
cannot elevate an Apprentice pending order to MASTER.

The order that makes a Builder qualify remains APPRENTICE because state is frozen at
acceptance. Automatic promotion happens only after successful completion. The next
order may then freeze CRAFTER. No retroactive upgrade occurs.

## Quality rule

For new RC5 orders:

```
bonus = Apprentice 0 / Crafter 5 / Expert 10 / Master 15
floor = clamp(30 + min(40, 2 * familyMastery) + bonus - 3 * recipeTier, 30, 80)
ceiling = min(100, floor + 30)
quality = floor + deterministicTicketChannel % (ceiling - floor + 1)
```

Example: Master + mastery 32 + T5 => 70..100. This creates a chance of quality 90+
without guaranteeing quality 100.

Quality bands:

- 30–49 Rough
- 50–64 Standard
- 65–79 Fine
- 80–89 Superior
- 90–97 Masterwork
- 98–100 Exceptional

Tier and quality remain independent facts. High quality does not grant recipe
permission or change item kind.

## Functional ability compatibility

Existing ability pools and hard caps remain unchanged:

- tools: WORK_SPEED_BPS
- weapon: ATK / SPATK / SPD
- armor: DEF / SPDEF / HP
- accessory: SPATK / SPD / HP
- construction pieces: no ability

Existing consumers (`craftedToolMultiplier` and gear bridge) remain the only
functional readers. G3 invents no durability, gather critical, repair, or new stat.

## Migration / attack requirements

Must prove:

1. exact known RC2 ticket/outcome fixture remains unchanged;
2. RC2 pending order completes after G3 as RC2 outcome;
3. RC2 item still validates without a `grade` field;
4. all newly accepted orders freeze RC5 spec;
5. forged coherent-looking MASTER spec above live grade is rejected;
6. save/load gives the same RC5 outcome without reroll;
7. quality/grade/ticket tamper fails validation;
8. old item without `craft` metadata stays legacy/unknown;
9. qualifying Builder order is Apprentice; next Crafter order is CRAFTER;
10. item UI only displays validated stored facts and does not write them;
11. all retained RC4/RC3/RC2/Adventure/browser gates stay green.

## Deferred

- Career-based T3–T5 permission gate / old-save grandfathering.
- Autonomous demand-driven production.
- Merchant price premium from quality; RC4 pricing remains authoritative and does
  not infer a value premium in this gate.
- New stations, durability, repair, enchanting or extra random channels.

Candidate SAT is not release SAT. The stacked PR must remain Draft until its parent is
accepted; after parent merge this work must be rebuilt/fast-forwarded onto the exact
current main and re-proven before merge.
