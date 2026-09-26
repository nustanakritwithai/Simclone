---
type: success-contract
project: Simclone
domain: simulation
feature: IC7A Estate and Inheritance Preparation
status: active
canonical: true
owner: Project Brain
validation: preparation-candidate
last_reviewed: 2026-09-26
---

# IC7A — Estate / Inheritance Preparation

## Goal

Prepare inheritance without destroying existing provenance or inventing social rules that do not yet exist.

IC7A is read-only. It answers:

- what property/material evidence remains attributed to a dead person;
- which living descendants exist as deterministic heir candidates;
- which facts must remain immutable when title transfer is added later.

No asset or ownership transfer occurs in IC7A.

## Current runtime facts

When a person dies today:

- bag/equipped Rust items are released through the existing Rust death path;
- dropped items retain `sourceAgentId`;
- personal raw material balance remains in `rustMaterials.personalStores` under the dead owner's id;
- modular house geometry remains;
- house ownership projection still resolves from founding Foundation `placedBy`;
- hosted cohabitation residence links close when the owner dies;
- identity/lineage remains retained through hot/archive history.

## Provenance rule

`Foundation.placedBy` is **construction provenance** and must never be rewritten to implement inheritance.

Future property transfer must separate:

```text
construction founder / provenance
!=
current property title
```

A future title system may derive current title from bounded transfer evidence, but it must not duplicate physical building geometry or mutate the original construction evidence.

## IC7A estate projection

For a dead person, derive:

- deceasedId
- retained personal raw balance
- complete/incomplete modular houses founded by that person
- dropped physical item instances whose death source is that person
- living descendant candidates
- lineage distance for every candidate

The projection is read-only and serializes nothing.

## Heir candidate semantics

IC7A does **not** choose an inheritance law.

Candidate discovery is factual only:

- candidate must be alive;
- candidate must be a retained descendant through `parentId`;
- direct children have lineage distance 1;
- grandchildren distance 2, etc.;
- ordering is deterministic: smaller lineage distance → earlier bornTick → lower id.

Cohabitation, affinity, trust or proximity do not make a person an heir in IC7A.
Those may influence a later property policy only after explicit design authority exists.

## Explicit exclusions

IC7A does not:

- transfer food/wood/stone/charcoal;
- transfer house title;
- transfer dropped Rust items;
- rewrite `placedBy`;
- infer spouse/partner status;
- create wills;
- merge household stores;
- delete dead-owner balances.

## Future IC7B gate

Before mutation is enabled, define one authoritative property/title ledger:

- bounded transfer events only;
- houseId reference, never copied geometry;
- fromOwnerId / toOwnerId / tick / reason / evidence;
- current title derived from latest valid transfer;
- conservation for material transfers;
- explicit policy for no-heir estates;
- explicit policy for multiple heirs;
- save/load and historical provenance proof.

## Acceptance

1. Dead person's raw balance is visible in estate snapshot without mutation.
2. House remains attributed to founding deceased owner in construction provenance.
3. Dropped death items are listed by sourceAgentId.
4. Direct child ranks before grandchild.
5. Unrelated/cohabiting adult is not a lineage heir candidate.
6. Projection is byte-read-only.
7. Unknown/alive subject does not produce a dead estate snapshot.
8. Save/load preserves all facts needed to recompute the same estate.

UNKNOWN is never PASS.
