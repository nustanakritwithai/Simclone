---
type: success-contract
project: Simclone
domain: simulation
feature: Kingdom Household Organization + Recruitment Shadow
status: active
canonical: true
owner: Project Brain
validation: preparation-candidate
last_reviewed: 2026-09-26
---

# Kingdom Organization / Recruitment Shadow

Donor: `nustanakritwithai/Kingdom-sandbox`

## Goal

Adapt Kingdom's OrganizationSystem + LaborMarketSystem recruitment semantics to Independent Clone World **without creating settlement/faction authority early**.

A household may become the seed of a future organization when:

```text
complete home
+ leader
+ Leadership capacity
+ relationship-backed follower candidates
+ real household labor/scarcity need
→ recruitment opportunity
```

IC6E is read-only. It proposes; it does not recruit or JOIN.

## Donor semantic reuse

Kingdom:
- organizations have a leader and memberIds;
- labor/recruitment offers express demand for people;
- leaders require leadership and followers;
- recruitment is constrained by relationships / membership / local context;
- group leadership can later change based on leadership + domain competence.

Simclone adaptation:
- household owner is the provisional leader for the household seed;
- existing explicit cohabitants are current adult members;
- guardian dependents are residents, not adult followers;
- `cohabitationCandidates()` is the relationship-backed recruitment candidate source;
- Leadership follower slots are the capacity bound;
- K2–K6 household labor pressure supplies the recruitment purpose.

## Read-only outputs

### householdOrganizationShadow(world, ownerId)

Returns:
- houseId
- leaderId
- adultMemberIds
- dependentIds
- leadership profile
- purpose / labor pressure
- organizationReady boolean

This is a projection only. No persistent organization id exists yet.

### householdRecruitmentOffers(world, ownerId)

For each current K4 household labor offer:
- role
- quantityNeeded
- availableFollowerSlots
- candidateIds
- candidate evidence score
- urgency
- source houseId / leaderId

Rules:
- no follower slot → no offer;
- no relationship-backed candidate → offer may exist but candidate list is empty;
- proximity alone never creates a candidate;
- candidate with own complete home is excluded by existing cohabitation rules;
- direct parent↔adult-child automatic following remains excluded;
- already active household member is excluded;
- ordering is deterministic.

## Explicit non-authority

IC6E does not:
- call JOIN_HOUSEHOLD;
- change profession;
- pay wages;
- move resources;
- create organization/faction ids;
- change house ownership;
- create loyalty from nothing;
- recruit by proximity alone.

## Future activation

After IC6C/IC6D SAT:

```text
Household Recruitment Offer
→ candidate decision
→ explicit JOIN / work agreement
→ cooperation evidence
→ organization membership authority
```

Only after multiple real household/organization interactions may Neighborhood/Settlement be derived.

## Acceptance

1. Household with labor pressure and follower slot produces a recruitment offer.
2. Candidate requires existing cohabitation relationship gate.
3. Stranger proximity does not produce candidate.
4. Full Leadership follower capacity suppresses recruitment.
5. Existing active followers appear in organization shadow memberIds.
6. Dependents do not consume adult follower slots.
7. Shadow evaluation is byte-read-only.
8. Same save/load state produces the same offer ordering.
9. No settlement/faction state is created.

UNKNOWN is never PASS.
