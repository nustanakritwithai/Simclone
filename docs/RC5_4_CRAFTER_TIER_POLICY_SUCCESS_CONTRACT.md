# RC5.4 — High-Tier Crafter Permission + One-Time Grandfather Migration G5

Status: STACKED DRAFT on RC5.3 G4. UNKNOWN never passes.

## Goal

Make high-tier crafting an actual Crafter capability without revoking recipes that a
valid old save could already craft before RC5.

## New-world rule

Recipe knowledge and career capability are separate.

- T0–T2: no Crafter career requirement; existing knowledge/material/station rules.
- T3: Crafter grade or higher.
- T4: Expert grade or higher.
- T5: Master grade.
- Knowing, buying or being taught a recipe does not bypass the grade rule.

The check is part of the existing Rust craft validator, so manual UI, bounded
training, autonomous G4 and any future caller all share the same gate.

## Old-save migration

New worlds persist:
`{version:'RC5-tier-policy/1', mode:'NATIVE', migratedTick:0, agents:[]}`.

A save with **no** tier-policy field is treated exactly once as pre-G5. Restore
captures only T3–T5 recipe IDs that:

1. are currently known through valid recipe evidence; and
2. have canonical `learned.tick <= migrationTick`.

Those IDs are persisted under `mode:'GRANDFATHERED'`. They keep their pre-RC5
craft permission even if the owner is not a Crafter.

The policy is never recomputed once present. A recipe learned after migration is
therefore not grandfathered. Validation rejects a grandfather recipe whose learned
tick is after the frozen migration tick.

This state stores permission migration evidence only. It is not a second recipe
book and has no mastery/item/material/profession data.

## Pending orders

Pending-order validation uses the same permission rule.

A pre-G5 high-tier recipe recorded as grandfathered remains valid after restore.
Legacy RC2 orders retain their old outcome evaluator. New RC5 orders retain their
frozen quality version/grade rules.

## Attacks

Must prove:

- new world starts NATIVE/empty;
- T0–T2 stay compatible;
- Crafter T3 SAT;
- known T4 while still Crafter is VIOL;
- Expert T4 SAT;
- Master T5 SAT and produces a real RC5 Master item;
- non-Crafter + known advanced recipe is still VIOL on NATIVE saves;
- old-save known T3/T4 is grandfathered;
- T5 learned after migration is not grandfathered;
- inserting that post-migration T5 into grandfather state fails validation/restore;
- repeated restore does not expand grandfather permissions.

## UI

Recipe cards keep displaying known/locked knowledge independently from capability.
A known recipe can show `crafter-tier` and have its craft button disabled. This is
intentional: “รู้สูตร” is not the same as “ฝีมือถึง”.

## Deferred

Market price premiums, item reputation and demand-driven recipe selection remain
future gates. G5 does not change recipe learning, Blueprint, teaching or item stats.
