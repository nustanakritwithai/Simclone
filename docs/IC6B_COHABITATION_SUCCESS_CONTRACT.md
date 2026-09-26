---
type: success-contract
project: Simclone
domain: simulation
feature: IC6B Adult Cohabitation
status: active
canonical: true
owner: Project Brain
validation: implementation-candidate
last_reviewed: 2026-09-26
---

# IC6B — Adult Cohabitation / Share Home

## Goal

Let a homeless productive adult consider sharing another adult's complete home only when a real evidence-backed relationship is strong enough.

This is optional social emergence, not a replacement for the personal-home default.

## Preconditions

A share-home candidate requires:

- subject is alive and can perform productive work;
- subject does not already own a complete home;
- target owner is alive, productive and owns a complete home;
- subject and owner are different people;
- direct parent ↔ adult-child pairs are excluded in IC6B so adult children continue the leave-home / own-home path by default;
- proximity alone never qualifies.

## Relationship gate

For subject → owner:
- trust >= 4
- affinity >= 2
- fear <= 20

For owner → subject:
- affinity >= 2
- fear <= 20

These thresholds are intentionally reachable through IC6A evidence:
Mentor + repeated knowledge cooperation + locally verified reliability.

No romance, attraction or hidden preference is inferred.

## Candidate ordering

Deterministic score:

```text
subject.trust * 2
+ subject.affinity
+ subject.respect
+ owner.affinity
- subject.fear * 2
- owner.fear * 2
```

Tie break: lowest ownerId.

No Math.random / Date / LLM.

## IC6B implementation scope

The pure planner remains read-only:
- `cohabitationCandidates(world, subject)`
- `cohabitationCandidate(world, subject)`

The residency authority adds:
- `JOIN_HOUSEHOLD`
- `LEAVE_HOUSEHOLD`
- bounded residence history in `social.residences`
- automatic residence close when owner/resident dies
- shared-home REST/EAT destination
- personal-home planning pauses while cohabiting and resumes after leave

Residency does **not**:
- transfer physical house ownership;
- merge personal inventory/material balances;
- infer romance/partner status;
- create a second home ledger.

## Acceptance

1. Nearby stranger with no relationship never becomes a candidate.
2. Thresholds must be satisfied by persisted IC6A relationship evidence.
3. Subject with complete own home has no candidate.
4. Target must have complete owned home.
5. Direct adult parent-child does not auto-cohabit.
6. Candidate ranking is deterministic.
7. Planner is read-only.
8. JOIN persists one active residence and is idempotent.
9. Switching owner requires explicit LEAVE first.
10. Household projection includes explicit cohabitants without changing owner.
11. REST/EAT may use shared home, while food/materials remain personal.
12. Personal-home goal pauses while cohabiting and resumes after leave.
13. Owner death closes hosted residence links.
14. Save/load preserves residence; IC6-social-1 migrates to v2 with empty residence history.
15. Existing IC1–IC6A regressions remain SAT.

UNKNOWN is never PASS.


## IC6C supersession

The earlier IC6B statement that adult cohabitants keep separate raw food/material balances is superseded by `docs/KINGDOM_HOUSEHOLD_SUCCESS_CONTRACT.md`.

Current rule:
- house ownership remains unchanged;
- physical bag items/tools remain personal;
- food/wood/stone/charcoal route through the active household resource pool.
