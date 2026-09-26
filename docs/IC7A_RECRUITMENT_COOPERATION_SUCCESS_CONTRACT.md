---
type: success-contract
project: Simclone
domain: simulation
feature: IC7A Household Recruitment + Cooperation Authority
status: active
canonical: true
owner: Project Brain
validation: implementation-candidate
last_reviewed: 2026-09-26
---

# IC7A — Household Recruitment + Cooperation Authority

## Goal

Turn the existing Kingdom household recruitment shadow into deterministic gameplay without adding a second membership or material authority.

```text
Household scarcity / labor gap
→ recruitment offer
→ relationship-backed candidate
→ Leadership slot
→ candidate willingness
→ existing JOIN_HOUSEHOLD authority
→ shared household resource account
→ real work contribution
→ relationship evidence
```

## Reused authorities

- labor need: `householdRecruitmentOffers()`
- candidate relationship gate: `cohabitationCandidates()`
- follower capacity: Leadership
- membership/residence mutation: `JOIN_HOUSEHOLD`
- raw-resource writer: `resourceStock()`
- relationship writer: `recordRelationshipEvidence()`

No parallel registry is introduced.

## Food recruitment

Kingdom K4 household labor offers include `forager → food` in addition to woodcutter/miner/builder so a food-poor house can recruit help.

## Candidate willingness

A productive homeless adult may autonomously accept the best offer only when:
- they have no complete owned home;
- they have no active residence;
- the offer already lists them through relationship + Leadership validation;
- either their personal work preference matches the offered role, or the offer urgency is high/critical.

Deterministic ranking:
1. critical > high > normal urgency;
2. higher offer priority;
3. higher relationship candidate score;
4. lower leader id;
5. role name.

No randomness and no proximity-only acceptance.

## Execution cadence

Recruitment evaluation runs on a bounded interval of 60 simulation ticks.
At most one new adult household join is executed per recruitment cycle.

Successful authority reuses `joinHousehold()`.
The residence row records `joinReason = recruitment:<role>`.

## Cooperation evidence

When a non-owner adult resident actually completes FORAGE/WOODCUT/MINE into a household resource account:
- owner → worker gains Trust +1 and Respect +1;
- evidence is bounded once per owner/worker/action/simulation-year;
- merely joining or being nearby earns no cooperation evidence.

## Explicit exclusions

IC7A does not:
- pay wages;
- create money;
- force profession changes;
- create factions/settlements;
- teleport resources;
- invent relationships;
- create a second household membership ledger.

## Acceptance

1. Food scarcity can emit a forager recruitment offer.
2. Stranger proximity alone cannot recruit.
3. Relationship candidate with matching preference can accept.
4. High/critical need may recruit a relationship-backed off-preference candidate.
5. Full Leadership capacity blocks recruitment.
6. At most one join occurs per 60-tick cycle.
7. Join uses the existing Household resource merge and residence authority.
8. Residence records the recruitment role as join reason.
9. Real resident resource work writes bounded owner→worker Trust/Respect evidence.
10. Save/load remains deterministic with no new duplicate membership/material ledger.
11. Legacy mode is unchanged.
12. Existing WM4.8, Household Economy and central-stock closeout regressions remain SAT.

UNKNOWN is never PASS.
