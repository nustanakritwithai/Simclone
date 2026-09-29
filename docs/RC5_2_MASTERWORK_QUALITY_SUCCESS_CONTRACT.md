# RC5.2 — Versioned Masterwork Quality — Success Contract

Status: STACKED RUNTIME CANDIDATE / BLOCKED on RC5.1 exact-head SAT.  
UNKNOWN is never PASS.

## Dependency

- Parent candidate: PR #200 / `feature/rc5-crafter-career-tier-gate-20260929`
- Required parent head for this stack: `cf5507636d633a55963f972d35e94ee109649dd5`
- Parent `d32084a8f699859e99c4b171393aee6f3d56baaf` failed Verify #2173 on fixture assumptions and is superseded; RC5.2 must preserve the authority-faithful repair in `cf550763...`.
- Do not merge RC5.2 before RC5.1 is accepted and rebuilt/retargeted onto the
  resulting current main.

RC5.2 owns only versioned accepted-order quality generation and its read-only
presentation. It does not weaken profession, recipe, item, material, station,
trade, persistence or combat authority.

## User contract

A skilled Crafter has a better chance to make high-quality work, especially after
reaching Expert/Master in the exact output family being produced.

Craft completion still succeeds through the existing deterministic Rust order
path. RC5.2 does **not** add a random catastrophic failure or destroy extra
materials on a bad roll.

Quality is the uncertain result; item creation remains deterministic and replayable.

## Version split

Legacy versions remain supported unchanged:

- accepted order: `RC2-order/1`
- item outcome: `RC2-outcome/1`

New accepted orders use:

- accepted order: `RC5.2-order/2`
- item outcome: `RC5.2-outcome/2`

Never reinterpret a legacy ticket with the new formula.

A pending V1 order loaded after RC5.2 must resolve through the V1 formula and
produce a V1 item. A V1 item must continue to pass its original validator.

## V2 acceptance snapshot

The Rust queue derives from canonical state:

- `mastery = craftFamilyMastery(agent, recipe)`
- `grade = crafterFamilyProfile(agent, recipe).grade`

and freezes both into the accepted V2 order specification.

UI / AI / command payloads cannot supply either field.

While a V2 order is pending, save validation re-derives the current same-family
mastery/grade. Because one person can have only one active craft order and mastery
increments only on verified completion, the frozen values must still match.
A forged higher grade is invalid even if its deterministic ticket is internally
self-consistent.

Career capability was already validated by RC5.1 before any material/item escrow.

## Quality range

Initial deterministic balance:

```text
grade bonus
Apprentice = 0
Crafter    = 5
Expert     = 10
Master     = 15

base = 30
     + min(40, 2 × same-family mastery)
     + grade bonus
     - 3 × recipe tier

floor   = clamp(base, 30, 80)
ceiling = min(100, floor + 30)
quality = floor + deterministicTicketChannel % (ceiling-floor+1)
```

Examples:

- legacy V1, mastery 0, T0: 30–60 (unchanged);
- Expert, mastery 16, T4: 60–90;
- Master, mastery 32, T5: 70–100.

Master T5 therefore can produce Masterwork/Exceptional quality but does not
guarantee 100.

No `Math.random`, wall clock, browser timing or global simulation RNG participates.

## Quality bands

- Rough: 30–49
- Standard: 50–64
- Fine: 65–79
- Superior: 80–89
- Masterwork: 90–97
- Exceptional: 98–100

Bands are presentation labels over stored numeric quality. They are not a second
rarity authority and do not change item tier/material identity.

## Item authority

`rustPossessions.items` remains the only physical item ledger.

A V2 crafted item stores:

- existing `createdBy` and `createdTick`;
- `craft.version = RC5.2-outcome/2`;
- accepted `orderId`, `recipeId`, same-family `mastery`;
- accepted `grade`;
- recipe `tier`;
- deterministic `quality`;
- deterministic `ticket`;
- existing functional `abilities`.

Tool/gear consumers continue reading the same bounded ability list.
No durability, critical gather, repair ledger, extra stats or second equipment
authority is invented.

## Replay / save-load

An accepted ticket is frozen. These must never reroll it:

- save/load;
- UI open/close;
- unrelated RNG/ticks;
- item-id allocation elsewhere;
- profession change after acceptance;
- later mastery earned after a different order.

The existing capacity-hold behavior still keeps the same order/spec if completion
cannot yet place the output.

## RC4 continuity

Merchant/trade systems transfer the exact physical item identity. RC5.2 must not
create a shop copy, merchant item or price-owned quality field.

Trade of a V1 or V2 item must retain the original:

- item id;
- creator;
- craft version;
- tier;
- mastery/grade when present;
- quality;
- abilities;
- ticket.

Pricing may later read quality as an input only through an explicit pricing
contract. RC5.2 does not alter RC4 price calculation.

## UI

Item info shows the stored numeric quality and one derived band label.

V2 production history additionally shows accepted grade.
Legacy items without craft metadata remain honestly labelled legacy/unknown.
V1 items show their existing fields and are never backfilled with a grade.

## Must-pass verification

- `createCraftSpec()` still generates valid V1 specs.
- V1 resolver output remains deterministic and validates.
- new real orders use V2 specs.
- V2 queue grade equals canonical same-family profile.
- a forged higher V2 grade fails pending-order validation.
- Master T5 range is exactly 70–100 at mastery 32.
- deterministic samples include high-quality outcomes but do not guarantee 100.
- V2 save/load completes to exactly the same outcome.
- V1 pending order restores and completes as V1.
- V1 existing item validation remains accepted.
- malformed V2 grade/ticket/item metadata is rejected.
- V2 item abilities stay inside existing caps.
- RC2 Crafting, RC3.2 Iron/Steel, Adventure equipment and RC4 trade regressions remain SAT.
- browser import-map pins match exact source bytes.

## Release gate

This is a stacked candidate. Required sequence:

```text
PR #200 exact-head SAT
→ integrate/rebuild RC5.1 on current main
→ exact-main proof
→ rebuild/retarget RC5.2 on that exact base
→ RC5.2 exact-head Verify SAT
→ merge
→ exact-main Verify + Pages
→ native/public item proof
```

Do not use a green stacked-branch run as production evidence for either layer.
