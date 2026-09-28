# RC4 Navigation Arrival Evidence — Success Contract

## Provenance repair override — 2026-09-29

The first B3 candidate proved route shape and deterministic hashes but those facts were caller-reconstructible. The repaired producer therefore adds an ephemeral module-private capability boundary.

- issued Journey objects are registered in a private `WeakMap` against the exact live world object observed;
- issued Arrival Evidence objects are registered the same way;
- observe/verify require exact object identity plus exact world identity;
- byte-identical clones, recomputed hashes, caller-authored lookalikes, or evidence bound to another world object fail provenance checks;
- the capability is intentionally non-serializable, matching `EPHEMERAL_REGENERATE_AFTER_LOAD`;
- no nonce, secret string, wall clock, random value, second path ledger, or second position writer is introduced.

B8 must pass the actual live authoritative root object to the verifier. A fabricated alternate root cannot transfer capability to the live root.

UNKNOWN is never PASS.

---


Status vocabulary: SAT / VIOL / UNKNOWN. UNKNOWN is never PASS.

## Scope

This donor closes the pre-integration Navigation evidence contract only. It does not wire RC4 shared runtime, create a market travel command, move an Agent, teleport an Agent, mutate Home Market, or commit Trade.

Canonical movement remains the existing Simclone survival/navigation authority. `src/navigation-arrival-evidence.mjs` is a read-only observer over an already-authoritative, `taskValid(...)` walking task.

## Canonical evidence

After observing every canonical path step to the selected market range, the producer may emit:

```js
{
  version: 'RC4-navigation-arrival/1',
  producer: 'SIMCLONE_SURVIVAL_NAVIGATION',
  verification: 'NAVIGATION_VERIFIED',
  evidenceId,
  journeyId,
  routeFingerprint,
  agentId,
  marketId,
  x,
  y,
  tick,
  marketX,
  marketY,
  tradeRange,
  steps
}
```

The producer:

- starts only from a living Agent with an existing `taskValid` navigation task;
- freezes the exact remaining canonical path;
- requires the task destination to be in the selected canonical market range;
- observes one adjacent path cell at a time;
- rejects skipped cells, path drift, task identity changes and direct destination jumps;
- emits evidence only after the frozen path has actually been consumed by movement;
- validates current Agent coordinates against the evidence and canonical market projection.

A plain `{verified:true}`, UI/AI-authored lookalike, mismatched Agent, mismatched Market, mismatched market coordinates/range, changed current position, closed market or stale tick fails closed.

## Persistence

Journey/evidence is intentionally **ephemeral**:

```text
EPHEMERAL_REGENERATE_AFTER_LOAD
```

It is not a root save authority and does not add a replay/history ledger. Save/load invalidates outstanding journey/evidence; the current canonical navigation state must produce a new journey/evidence after restore.

This keeps B3 out of B7 production persistence and avoids a second position/history authority.

## Ownership rule

AI, UI and Integration may request/consume evidence but may not fabricate `NAVIGATION_VERIFIED` or write an alternative evidence format. The future B8 integration must route the Customer travel goal into the existing movement authority, then consume this producer. B8 itself remains out of scope here.

## Required proof

- real `engine.step()` movement consumes the canonical task path before evidence appears;
- teleport/deviation fails;
- fake `verified:true` fails;
- stale tick fails;
- mismatched Agent/Market/market coordinates fail;
- closed market fails;
- task outside market range fails;
- no second position writer exists;
- exact-head focused tests and repository Verify are required.

No exact-head CI result is assumed by this document. UNKNOWN is never PASS.
