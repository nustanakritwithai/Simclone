# RC5.3 — Bounded Crafter Progression Autonomy G4

Status: STACKED DRAFT on RC5.2 PR #199. UNKNOWN never passes.

## Purpose

When the existing **full RP1 production policy is explicitly enabled**, a qualified
Crafter may progress their strongest craft family using the existing CRAFT_ITEM
authority. G4 adds no background item mint, no XP grant, no second queue and no
always-on crafting toggle.

## Dependency

Parent exact candidate: `a251a3792ba937d444f0ec47fbe29cf6723d6f85`.

Required before release:
RC5.1 career SAT → RC5.2 versioned outcome SAT → this G4 exact-head SAT. If an
earlier parent changes, rebuild this slice on the accepted parent and re-prove.

## Policy

`crafterProgressionSnapshot()` is read-only. It returns an intent only when:

- `productionPlan.enabled === true` (the existing user opt-in);
- actor is a living productive Crafter;
- canonical personal home is still complete;
- no manual craft-training plan is enabled;
- no active adventure/encounter, task, craft order or processing order;
- HP ≥ 70, satiety ≥ 70, energy ≥ 65;
- existing food/wood/stone safety floors remain after the proposed craft;
- the exact recipe is known, its physical item ingredients exist, processed
  materials exist, the station exists, the bag can accept output, and the station
  is reachable according to the existing path authority.

The policy does not mutate while evaluating.

## Progression choice

The strongest canonical family profile selects exactly one target:

- CRAFTER → T3
- EXPERT → T4
- MASTER → T5 until one verified T5 completion exists
- after one T5 completion → COMPLETE and no more autonomous orders

This does not change manual recipe permissions. It controls only what this optional
autonomy will request.

The existing recipe chain already requires real prior-item ingredients for T2+.
Every accepted autonomous order therefore uses the same physical material/item
escrow, station, path, work executor, frozen RC5 quality snapshot, completion
receipt and save/load validation as a manual CRAFT_ITEM.

## Priority / non-interference

Housing remains ahead of Crafter progression:

- Independent world: existing personal-home planner gets first opportunity.
- Legacy/settlement world: existing RP1 tool/station/charcoal/home chain gets first
  opportunity.
- Crafter progression runs only when those paths produce no higher-priority action.

Manual `SET_CRAFT_TRAINING` takes precedence and blocks G4 for that actor.
Survival tasks also block it.

## Acceptance

Prove:
1. policy OFF is byte-stable and creates no order;
2. intent is frozen and non-mutating;
3. CRAFTER chooses real known T3 in the same family;
4. unsafe needs / manual training / task / adventure / reserve block without spend;
5. non-Crafter special professions cannot use the policy;
6. engine dispatch creates an ordinary canonical CRAFT_ITEM order;
7. frozen grade/mastery are canonical RC5 values;
8. save/load cannot duplicate the pending order;
9. real T3 completions can advance the profile to EXPERT;
10. real progression can reach MASTER and make one T5;
11. after one T5, policy is COMPLETE and does not farm indefinitely;
12. full retained repo/browser gates stay green.

No UI-owned simulation truth is introduced. Existing RP1 toggle is the opt-in
surface; Crafter panel may display its status later but need not persist another
flag.

## Deferred

- Mandatory T3–T5 permission restriction / old-save grandfathering.
- Merchant price premium from item quality.
- Demand-driven choice from market information.
- Durability, repair, enchanting or new stations.

Candidate green CI is not production release evidence.
