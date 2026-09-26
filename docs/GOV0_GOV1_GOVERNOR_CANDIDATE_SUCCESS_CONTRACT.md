---
type: game-design
project: Simclone
domain: governance
feature: GOV0-GOV1 Governor Candidate
status: active
canonical: true
owner: Simclone
validation: candidate
last_reviewed: 2026-09-26
---

# GOV0–GOV1 — Governance Foundation + Governor Candidate Success Contract

Base: `main@9283a9c88bf4b8f540498e8539e5551865b18e2c`

## Goal

Introduce governance without turning a ruler into a resource owner, settlement owner, or replacement profession.

```
Active Settlement
→ living residents
→ Leadership + evidence-backed household support
→ deterministic Governor candidates
```

GOV1 is read-only. It does not appoint a Governor.

## Authority ownership

- Productive profession: `src/kingdom-utility.mjs`
- Leadership: `src/leadership.mjs`
- Relationship evidence: `src/relationships.mjs`
- Household membership/home truth: existing household/home authorities
- Settlement lifecycle/provenance: `src/settlement-authority.mjs`
- Governor candidate projection: `src/governor-candidate.mjs`
- Persistent office, policy, legitimacy and succession: deferred to GOV2+.

Governor is a social office, not a productive profession. GOV1 must never write `agent.profession`.

## Candidate eligibility

A candidate must:

1. belong to the current resident IDs of an **active** Settlement snapshot;
2. be alive and productive/adult under the existing lifecycle authority;
3. have Leadership level >= 1;
4. receive qualifying support from the required number of distinct Settlement household owners.

No proximity-only promotion is allowed.

## Household support gate

A Settlement household owner supports a candidate only when the directed relation **owner → candidate** has:

- Trust >= 4
- Respect >= 2
- Fear <= 20
- at least one retained relationship-evidence record

A candidate's own household does not count as support for that candidate.

Required support:

```
ceil(active settlement households / 2)
```

The threshold uses the Settlement projection's current household count. GOV1 creates no copied membership registry.

## Deterministic ranking

Candidates within one Settlement sort by:

1. more supporting households
2. higher total Respect from supporting owners
3. higher total Trust from supporting owners
4. higher Leadership level
5. more retained supporting evidence
6. older supporting-evidence continuity
7. lower agent ID as the final deterministic tie-break

No random jitter and no aggregate opaque "governance score".

## Projection shape

Each candidate exposes evidence sufficient for UI/explainability:

- settlementId
- agentId
- current profession (read-only)
- Leadership level / XP
- requiredSupport
- supportOwnerIds
- supportHouseholds
- supportTrust
- supportRespect
- supportEvidenceCount
- supportContinuityTicks
- qualified: true

The projection exposes explicit authority flags showing zero writers/save fields.

## Explicit exclusions

GOV0/GOV1 do **not** add:

- governorId to Settlement state
- elections
- inherited office
- king/lord profession
- law
- tax
- treasury
- policy bonuses
- diplomacy
- military command
- court/faction politics
- settlement/home/household ownership transfer
- new relationship evidence
- new save fields

## Acceptance

1. Legacy worlds return zero Governor candidates.
2. No active Settlement → zero candidates.
3. A resident with Leadership but no support evidence is not a candidate.
4. Proximity alone never creates support.
5. A non-resident cannot become candidate even with high Leadership/support.
6. Leadership level 0 blocks candidacy.
7. Trust without Respect, Respect without Trust, excessive Fear, or no evidence each block that household's support.
8. Candidate's own household never counts as support.
9. Required support is exactly `ceil(households/2)`.
10. A valid evidence-backed resident becomes a candidate.
11. Ranking follows the frozen key order and agent ID is only the final tie-break.
12. Candidate projection is read-only: serialized state bytes remain unchanged.
13. Candidate projection never changes profession, Settlement records, relationships, resources, homes, households or tasks.
14. Dormant Settlement records produce no candidates.
15. Same state produces byte-equivalent projection after save/load.
16. Existing MX5–MX7 Settlement and IC7A/IC7B regressions remain SAT.

UNKNOWN is not PASS.
