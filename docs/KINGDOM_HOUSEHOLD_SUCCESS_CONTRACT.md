---
type: success-contract
project: Simclone
domain: simulation
feature: Kingdom Household Economy + Leadership
status: active
canonical: true
owner: Project Brain
validation: implementation-candidate
last_reviewed: 2026-09-26
---

# Kingdom Adaptation Gate — Household Economy + Leadership

## Product rule

There is no world material stock in Independent mode.

Raw resources belong to:
1. a homeless person's temporary store, or
2. a household store keyed by a completed `houseId`.

Physical item instances/tools remain personal.

## Household resources

Household pool contains:
- food
- wood
- stone
- charcoal

Activation:
- completed home creates one household store;
- founder temporary balance moves atomically into it;
- JOIN_HOUSEHOLD moves the joiner's temporary balance atomically into that house;
- leaving never splits the household pool;
- owner, cohabitants and guardian dependents route gather/eat/craft/process/birth costs through the same pool;
- world totals are aggregate/read-only.

No unit may be counted in personal and household balances simultaneously.

## Kingdom donor leadership

Donor source uses a real `leadership` agent skill plus relationship/loyalty requirements.

Simclone adapts that as:
- `skills.LEADERSHIP` with existing skill provenance;
- Leadership is not an action profession/preference;
- relationship evidence remains mandatory for cohabitation/following;
- Leadership controls adult follower slots;
- dependents/children do not consume follower slots.

Household follower capacity:
- Leadership Lv0 → 1
- Lv1 → 2
- Lv2 → 3
- Lv3 → 4
- Lv4 → 5
- Lv5+ → 6

First successful unique follower JOIN awards +10 Leadership XP to the host.
Rejoining the same follower never awards XP twice.

## Shared household production

A resident may use the host's crafting table/furnace because the household owns the raw-resource pool.
Crafted item output still goes to the worker's personal bag.

## Acceptance

1. Fresh independent Clone has Leadership skill/provenance.
2. Completing a home moves founder raw balance to exactly one house store.
3. Founder personal raw balance becomes zero after activation.
4. JOIN moves the joiner's temporary raw balance into the target household atomically.
5. Owner and resident resolve to the same resource object after JOIN.
6. LEAVE returns the person to an empty temporary personal store; pooled resources stay with the house.
7. Guardian-dependent child uses the guardian household pool.
8. Crafting/processing from a resident spends the same household pool.
9. First unique follower increases host Leadership XP; same follower cannot farm XP by rejoin.
10. Leadership capacity blocks additional adult followers when full.
11. Relationship gate remains required regardless of Leadership.
12. Save migration creates household stores deterministically without double-counting.
13. Existing Independent/legacy regressions remain SAT.

UNKNOWN is never PASS.
