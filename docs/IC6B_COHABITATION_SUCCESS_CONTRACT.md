---
type: success-contract
project: Simclone
domain: simulation
feature: IC6B Adult Cohabitation
status: active
canonical: true
owner: Project Brain
validation: preparation-candidate
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

## IC6B preparation scope

This preparation slice is read-only:
- `cohabitationCandidates(world, subject)`
- `cohabitationCandidate(world, subject)`

It does not yet:
- move a resident;
- persist residence;
- share inventory/materials;
- transfer ownership;
- stop a personal-home build already underway.

The execution slice after IC6A SAT will add an explicit authoritative share-home / leave-home transition.

## Acceptance

1. Nearby stranger with no relationship never becomes a candidate.
2. Thresholds must be satisfied by persisted IC6A relationship evidence.
3. Subject with complete own home has no candidate.
4. Target must have complete owned home.
5. Direct adult parent-child does not auto-cohabit.
6. Candidate ranking is deterministic.
7. Planner is read-only.
8. Save/load of IC6A evidence produces the same candidate.

UNKNOWN is never PASS.
