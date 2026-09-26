# IC6 — Social + Household Work State

Status: IMPLEMENTATION CANDIDATE  
Branch: `feature/ic6-social-household`  
Base: `main@0de96010dabd88776afc4dff6f5dbe790fb7cd58`  
Canonical contract: `docs/IC6_SOCIAL_HOUSEHOLD_SUCCESS_CONTRACT.md`

## Goal

Add the first evidence-backed social authority and household projection on top of Independent Clone World without inventing motives or creating a second home/person ledger.

## Implemented candidate

- `src/relationships.mjs`
  - bounded directed relationship state
  - trust / affinity / respect / fear / debt
  - bounded idempotent evidence
  - save validation
  - owner + guardian household projection
- Engine integration:
  - Mentor link → directed respect/trust/affinity
  - Knowledge share → mutual affinity
  - Locally verified received claim → verifier→source trust
  - Guardian meal → yearly-bounded child→guardian trust/affinity
- Existing independent 0.6.0 saves missing `social` gain an empty IC6 extension on restore.
  - Historical scores are not fabricated.
- No second resident registry.
- No partner/romance/trade/faction inference.
- No fear/debt writer yet because no authoritative harm/trade event owns those signals.

## Authored tests

`tests/relationships.test.mjs` proves:
- empty valid social state;
- knowledge-share affinity;
- verified-knowledge trust and idempotency;
- stale/depleted verification does not penalize source;
- Mentor directed scores once;
- guardian support once/year;
- save/load and old independent-save extension migration;
- invalid/duplicate social rows rejected;
- household projection uses owner + guardian dependents only;
- stranger proximity never creates residency.

## Runtime boundary

```text
authoritative event
→ recordRelationshipEvidence
→ bounded directed social signal
→ read-only household projection
```

No renderer/UI callback owns social rules.

## Next after IC6A SAT

IC6B:
- deterministic adult cohabitation candidate;
- explicit share-home / leave-home transition;
- relationship thresholds with evidence;
- no automatic cohabitation from proximity.

Then:
- property/inheritance;
- cooperation/trade;
- home-site social preference;
- neighborhood emergence.

## Validation state

Candidate only. Exact CI evidence is pending. UNKNOWN is not PASS.
