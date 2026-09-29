# RC5 Producer / Crafter — Production Closeout Success Contract

Status vocabulary: SAT / VIOL / UNKNOWN. UNKNOWN never passes.

## Scope

This release closes the **Producer / Crafter** side only.

Economic role boundary:

```text
Gatherer / ordinary worker -> raw materials
Producer / Crafter         -> transforms materials into physical quality goods
Merchant                   -> existing RC4 buy / stock / price / resale authority
Adventurer / Customer      -> existing consumer / use authority
```

No new Merchant strategy, Merchant accounting, Customer policy, Adventure combat,
loot or market authority belongs to this release.

## Canonical producer behavior

1. Builder is the source productive career for Crafter qualification.
2. Crafter qualification reads canonical personal-home / construction evidence and
   existing verified per-recipe mastery. It never accepts a caller-supplied proof.
3. Profession transition still commits only through the existing
   `adoptProfession()` authority.
4. Craft expertise is derived from existing recipe completion evidence. There is no
   Craft XP, craftLevel, second inventory, second item writer or second material ledger.
5. Special professions remain locked: Crafter, Merchant and Adventurer cannot silently
   overwrite one another through ordinary work.

## Tier progression

Per output family:

- Apprentice / Builder bridge: up to T2
- Crafter: T3
- Expert: T4
- Master: T5

Initial thresholds remain:

- Crafter: >= 6 total same-family completions and >= 2 T2
- Expert: >= 16 total and >= 4 T3
- Master: >= 32 total and >= 6 T4

Master requires T4 evidence, never an already-created T5.

Knowledge remains independently required. Blueprint or teaching alone never creates
mastery.

## Masterwork quality

New accepted Crafter orders use the versioned RC5 outcome contract. Existing
RC2-order/1 and RC2-outcome/1 records remain valid and are not reinterpreted.

Quality remains deterministic and frozen at accepted-order time. Grade and mastery
are frozen into the accepted outcome specification. No UI reroll, no global RNG,
no retroactive quality rewrite and no random material-destruction failure is added.

Quality labels are read-only display bands:
Rough / Standard / Fine / Superior / Masterwork / Exceptional.

The physical item retains its canonical `createdBy`, recipe tier, quality and
abilities through ordinary Rust ownership transfer. Existing RC4 trade consumes
that same item identity; RC5 adds no Producer shop, wallet, listing or ledger.

## Bounded producer autonomy

The existing RP1 opt-in is reused. When enabled, a safe qualified Crafter may
progress one family using ordinary `CRAFT_ITEM` commands:

Crafter -> T3 -> Expert -> T4 -> Master -> one T5 showcase -> stop.

The policy is proposal-only and is blocked by survival, housing, manual training,
Adventure state, active work, reserve floors, missing item/material/station/path,
and capacity. It does not mint or directly write items/mastery/profession.

## Old-save compatibility

New worlds start with the native RC5 high-tier policy.

A pre-RC5 save that already knew T3-T5 recipes receives a deterministic one-time
grandfather record for only those recipes proven known at migration time. Later
knowledge is never silently added. Grandfathering bypasses only the new career-tier
restriction; normal knowledge, station, material, item, order and bag validation
still apply.

Malformed migration evidence fails closed.

## Producer release gates

P1 Career:
- real Builder evidence -> canonical Crafter transition;
- Merchant / Adventurer lock retained;
- replay does not append duplicate career transitions.

P2 Tier:
- T2 bridge works;
- T3/T4/T5 require the matching family grade;
- rejection occurs before any material or item escrow.

P3 Quality:
- RC5 new orders freeze grade/mastery/ticket;
- old RC2 items and accepted orders remain byte-semantics compatible;
- save/load does not reroll.

P4 Autonomy:
- OFF is byte-stable;
- ON uses only existing command/executor paths;
- real progression reaches a physical T5 and then stops;
- survival and reserve gates remain higher priority.

P5 Persistence:
- native policy validates;
- legacy migration is one-shot and bounded;
- corruption is rejected;
- accepted in-flight craft survives reload exactly.

P6 Economy boundary:
- Rust remains the sole item authority;
- existing RC4 Merchant Economy regressions stay SAT;
- Producer output is trade-compatible without adding Merchant writers.

P7 Regression:
- complete `npm test` SAT;
- active Chromium / Independent smoke SAT;
- RC2 crafting SAT;
- RC3.1 Blueprint SAT;
- RC3.2 Iron/Steel SAT;
- RC4 Merchant Economy SAT.

P8 Production:
- exact-head Verify SUCCESS;
- merge only that exact head;
- exact merged-main Verify / Pages SUCCESS;
- public bytes match merged main.

## Integration source

The closeout candidate is rebuilt on the current production main, not by merging
the old stacked RC5 draft branches. Their accepted Producer-only modules and tests
are ported onto the latest main while retaining the RC4 autonomous-Merchant hotfix.

Old RC5 PRs become donor/history after this closeout candidate is accepted.
