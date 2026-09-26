---
type: success-contract
project: Simclone
domain: simulation
feature: IC6 Social + Household
status: active
canonical: true
owner: Project Brain
validation: implementation-candidate
last_reviewed: 2026-09-26
---

# IC6 — Social Relationship Authority + Household Projection

## Goal

Move Independent Clone World from isolated individuals toward emergent social structure without inventing motives or adding a second home/inventory executor.

The first IC6 slice owns two things:

1. a bounded persisted **relationship signal** derived only from authoritative interactions;
2. a read-only **household projection** that explains who currently belongs to a home through actual ownership/guardian evidence.

This slice does not yet create romance, trade, factions or autonomous adult cohabitation.

## Relationship semantics

Relationship values are deterministic decision signals, not free-form emotions.

| Signal | Meaning in IC6 | Range |
|---|---|---|
| trust | verified reliability / dependable support | -100..100 |
| affinity | retained positive cooperation history | -100..100 |
| respect | evidenced teaching / recognized guidance | -100..100 |
| fear | authoritative threat/harm exposure | 0..100 |
| debt | authoritative resource obligation | -100..100 |

IC6A only writes signals for events that already have an authority. `fear` and `debt` remain zero until a later authoritative conflict/trade/resource-transfer system exists.

## Authoritative evidence in this slice

### Knowledge share
A successful `SHARE_KNOWLEDGE` proves voluntary cooperation occurred.
- sender → receiver: affinity +1
- receiver → sender: affinity +1
- it does **not** increase trust merely because a claim was received.

### Knowledge verification
When a received claim is locally verified as `locally-observed`, the verifier gains:
- verifier → original source: trust +4

A stale/depleted observation is not dishonesty and changes no relationship score.
A refuted claim is evidence of mismatch, but IC6A does not infer malicious intent and therefore does not automatically add fear/hostility.

### Mentor link
Creating a real Mentor link proves a guidance relationship:
- student → mentor: respect +8, trust +2
- mentor → student: affinity +2

Repeated creation of the same active link must not double count because the mentor command itself is idempotent.

### Guardian support
When a child actually consumes one unit from an evidenced guardian's personal food balance:
- child → guardian: trust +1
- child → guardian: affinity +1

Support evidence is bounded to once per simulated biological year for the same child/guardian pair so normal eating cannot spam relationship state.

## Persistence

Use one world-level extension:

```text
social
├─ version
├─ nextEvidence
└─ relations[]
   ├─ fromId
   ├─ toId
   ├─ trust
   ├─ affinity
   ├─ respect
   ├─ fear
   ├─ debt
   └─ evidence[] (bounded)
```

Rules:
- directed relation: A→B may differ from B→A;
- no duplicate relation for the same directed pair;
- evidence keys are idempotent;
- retained people may remain referenced after death;
- no relation to an unknown person ID;
- old independent 0.6.0 saves gain an empty IC6 extension on restore; do not fabricate historical scores from old chat/events;
- legacy 0.5.0 worlds may carry the same empty extension if they later create social evidence, but IC6 gameplay activation targets independent mode first.

## Household projection

IC6A does not persist a second household registry.

A household is derived from current evidence:

```text
complete owned home
→ owner
→ living children whose guardian resolves to that owner
→ household projection
```

The projection exposes:
- houseId
- ownerId
- residentIds
- dependentIds
- source: owner + guardian evidence

A child may reside in the guardian's home because that behavior already exists in IC3.
An unrelated adult is **not** considered a resident merely because they stand nearby.

Adult cohabitation from relationship scores belongs to IC6B after the relationship authority is proven.

## Authority boundaries

Reuse:
- identity/lineage/lifecycle → existing engine/history/lifecycle
- guardian evidence → existing `guardianOf`
- home ownership → IC1 `homeOf`
- knowledge verification/share → existing knowledge authorities
- Mentor link → KF1 authority
- materials/items/building → existing Rust authorities

Do not add:
- second person registry
- second home/resident ledger
- second inventory/material ledger
- UI-owned relationship writes
- inferred emotions or motives

## Determinism

No `Math.random`, Date, wall clock or LLM writes.
Same starting state + same command/tick sequence must serialize byte-identically.

## Acceptance

1. New world has valid empty social state.
2. Successful knowledge share adds only mutual affinity once.
3. Verified received knowledge raises verifier→source trust once.
4. Stale/depleted verification does not lower trust.
5. Creating a Mentor link adds the defined directed scores exactly once.
6. Guardian meal support adds trust/affinity at most once/year.
7. Save/load preserves relationship state.
8. Invalid/duplicate/unknown IDs are rejected.
9. Household projection includes owner + guardian dependents only.
10. Stranger proximity does not create residency.
11. Existing IC1–IC3 regressions remain SAT.

## Next gate

IC6B after IC6A SAT:
- deterministic adult cohabitation candidate
- explicit move/share-home decision
- leave-home / leave-household transition
- then property/inheritance and cooperation/trade

UNKNOWN is never PASS.
