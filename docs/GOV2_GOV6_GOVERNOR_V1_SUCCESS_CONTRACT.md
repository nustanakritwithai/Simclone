---
type: game-design
project: Simclone
domain: governance
feature: Governor v1
status: active
canonical: true
owner: Simclone
validation: candidate
last_reviewed: 2026-09-26
---

# GOV2–GOV6 — Governor v1 Success Contract

Dependency: GOV0/GOV1 candidate semantics in `docs/GOV0_GOV1_GOVERNOR_CANDIDATE_SUCCESS_CONTRACT.md`.

## GOV2 — Office Authority

A Governor is a persistent **social office**, not a productive profession.

The single office writer owns only:
- settlementId
- governorId or VACANT
- term provenance
- appointment evidence summary
- qualification/transition ticks
- bounded prior-term history

It must never write or copy:
- house ownership
- Household membership
- Settlement boundaries/member lists/resources
- raw resources/inventory
- productive profession/career
- relationships

One active Settlement has at most one office record and at most one active Governor.

## Appointment

At governance cadence, an active Settlement with a vacant office appoints GOV1's top deterministic candidate. Appointment preserves the agent's productive profession.

## Qualification and succession

Immediate vacancy:
- Governor dies
- Governor is no longer a current Settlement resident
- Settlement becomes dormant

Evidence/support loss receives a one-governance-cycle grace period. If qualification is not recovered, the term ends.

After a vacancy, the same cadence may appoint the next valid top GOV1 candidate. No valid candidate means VACANT; VACANT is a valid state.

No hereditary succession exists in Governor v1.

## GOV3 — Policy Authority

Governor policies can address only broad Settlement shortages:
- food → FORAGE
- wood → WOODCUT
- stone → MINE

A broad issue exists when at least `ceil(settlement households / 2)` current households have K2 scarcity > 1.2 for that good.

Policy selection is deterministic:
1. more affected households
2. higher average scarcity
3. higher maximum scarcity
4. food, wood, stone fixed order

A Settlement has at most one active Governor policy in v1.

Policy records store provenance/outcome only, never stock.

Policy signal enters the existing task scorer. It never writes an Agent task.

### Priority

- Survival emergency suppresses Governor policy to zero.
- Household Cooperation remains stronger.
- Governor policy bonus is bounded to 6 / 9 / 12:
  - average scarcity < 1.8 → 6
  - < 2.5 → 9
  - otherwise → 12

IC7B Household Cooperation remains max 36.

## GOV4 — Support / legitimacy

Legitimacy is a read-only projection, not a free-form emotion score.

It derives from:
- current GOV1 household support
- Trust / Respect evidence
- Leadership
- completed Governor policy outcomes

When an active policy resolves because broad shortage no longer meets its gate, each current Settlement household owner other than the Governor records at most one bounded outcome evidence:
- Trust +1
- Respect +1

No automatic negative relationship penalty exists in Governor v1.

## GOV5 — Succession

Term end is persisted in bounded office history with:
- termId
- governorId
- appointedTick
- endedTick
- reason

Changing Governor never changes profession, house ownership or Settlement ownership/provenance.

## GOV6 — UI

The Inspector must distinguish:
- productive profession
- Governor office
- Governor candidate status
- Leadership
- household support x / required
- current policy and policy bonus
- resolved-policy count

UI is read-only and creates no governance writer.

## Acceptance

1. Fresh Independent worlds migrate/own deterministic empty governance state; Legacy has none.
2. GOV1 rules remain SAT and browser import pins cover every new runtime module.
3. One active Settlement has one office record; no duplicate office per Settlement.
4. Valid top candidate is appointed deterministically.
5. Appointment leaves profession/career/household/home/Settlement provenance unchanged.
6. No valid candidate leaves VACANT.
7. Death or leaving Settlement vacates immediately.
8. Support loss obeys exactly one governance-cycle grace then vacates.
9. Next valid candidate succeeds deterministically.
10. Dormant Settlement has no active Governor.
11. Broad food/wood/stone shortage creates the matching policy.
12. Narrow shortage below majority creates no policy.
13. Only one active policy per Settlement.
14. Governor policy bonus is 6/9/12 and never exceeds 12.
15. Survival emergency suppresses policy signal.
16. Household Cooperation max remains 36 and remains stronger than Governor policy.
17. Policy never writes Agent tasks or stock.
18. Resolved policy writes bounded owner→Governor Trust/Respect evidence once per policy.
19. No failure automatically subtracts Trust/Respect.
20. Legitimacy/support projection is read-only and explainable.
21. Save/load continuation remains deterministic with office, history and policies.
22. Validator rejects malformed governance state and forbidden copied ownership/resource fields.
23. Legacy behavior is unchanged.
24. MX5–MX7, IC7A, IC7B, VAL1 and existing browser regressions remain SAT.
25. Inspector visibly separates profession from Governor office/candidate/policy.
26. Exact candidate Verify, exact-main Pages and public release proof are separate gates.

UNKNOWN is not PASS.
