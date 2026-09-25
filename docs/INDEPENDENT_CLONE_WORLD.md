---
type: gdd
project: Simclone
domain: simulation
feature: Independent Clone World
status: active
canonical: true
owner: Project Brain
validation: ic3-candidate-local-proof-complete
last_reviewed: 2026-09-26
---

# Independent Clone World

## Current implementation pointer

The approved individual-first direction now has a combined IC2/IC3 implementation candidate, not only the original IC1 projection. Its normative mode, private resource, birth/guardian, archive-host and save contracts are [IC3](IC3_INDEPENDENT_START_SUCCESS_CONTRACT.md). Current evidence and pending exact CI/deployment are [IC3 work state](IC3_WORK_STATE.md). The IC1 migration notes below describe the original incremental slice; later independent-mode changes explicitly supersede them. Legacy saves remain unchanged.

## Design goal

Simclone moves from a settlement-first colony model to an individual-first society simulation.

A Clone is an independent person before they are a member of any village. Each person may survive, learn, own physical items, choose a home site, build a home, form a household, cooperate, trade, and only later contribute to an emergent neighborhood or settlement.

The world must not require a pre-existing central village for individual survival or home construction.

## Core rule

```text
Individual
→ Survival
→ Knowledge
→ Personal possessions
→ Personal home
→ Relationships
→ Household
→ Cooperation / trade
→ Neighborhood
→ Settlement
→ Society
```

Settlement is an outcome of people and homes, not a prerequisite for them.

## IC architecture decisions

### 1. Individual identity is primary

Every living Clone has an identity independent of settlement membership.

Existing authoritative identity remains:
- `agent.id`
- lineage / `parentId`
- generation
- lifecycle
- permanent appearance
- skills + provenance
- personal knowledge/memory

Do not add a duplicate person registry.

### 2. Home ownership is individual

A modular house can be associated with one owner.

For the first migration-safe slice, ownership is **derived**, not stored twice:
- the owner is the `placedBy` of the lowest-id foundation in the connected house component;
- later builders may assist without changing ownership;
- a missing/deleted owner is explicit UNKNOWN, never reassigned by guess.

Future schema may introduce household/resident state, but only after migration rules are approved.

### 3. No global housing-capacity rule in the target architecture

Current `housingCapacity(world)` remains legacy/current-main behavior until its replacement slice is verified.

Target behavior:
- a Clone may exist without a home;
- a home is not a generic +6 global population slot;
- birth/existence is not authorized by a global settlement housing pool;
- children may reside with a parent/guardian until an age/rule permits an independent-home goal;
- adult/manual Clones may begin homeless and pursue their own home.

### 4. No mandatory central Camp

The target independent-world start does not require a Camp or "first settlement" as a gameplay authority.

Camp-dependent systems must be migrated deliberately:
- Cultural Archive needs a new explicit owner/location contract later;
- home-site selection must not use distance from Camp;
- production must not assume colony-wide housing pressure.

Legacy saves may retain a Camp for compatibility until a migration slice explicitly changes them.

### 5. Personal home-site choice

A person's home site is chosen deterministically from reachable legal cells around that person, then later may incorporate:
- owned/known resource access
- water
- travel cost
- terrain
- danger
- profession
- relationships
- personal preference

IC1 uses only deterministic legal placement + personal origin. It must not read hidden world truth to invent personal knowledge.

### 6. Reuse existing authorities

Do not build parallel systems.

Reuse:
- Rust possession ledger
- `CRAFT_ITEM`
- `EQUIP_ITEM`
- `PLACE_STATION`
- modular-house evaluator
- deterministic navigation
- lifecycle
- skill provenance
- knowledge provenance
- save validation

Player and AI must continue to converge on the same placement/execution authority.

## IC milestones

| Gate | Product maturity | Required proof |
|---|---|---|
| IC0 | Canonical individual-first rules | GDD + success contract + branch isolation |
| IC1 | Individual home identity | two Clones can have distinct derived home ownership; no duplicate housing ledger |
| IC2 | Personal home planning | homeless adult independently selects legal site and builds through existing Rust authorities |
| IC3 | Independent start | fresh mode has no central settlement dependency and remains survivable |
| IC4 | Personal/local resources | remove colony-wide assumptions from production while preserving conservation |
| IC5 | Household | co-residence/guardian rules with explicit membership and persistence |
| IC6 | Emergent neighborhood | neighborhood derived from spatial/social evidence, not manually seeded |
| IC7 | Settlement emergence | settlement/faction forms from people, homes, cooperation and rules |
| IC8 | Long-run proof | independent generations continue across death/save/load without player babysitting |

## IC1 normative contract

IC1 is intentionally small.

It adds a pure individual-housing projection:
- enumerate modular houses with deterministic owner evidence;
- resolve `homeOf(agentId)`;
- identify whether a person is homeless;
- choose a legal deterministic personal home site around an agent without consulting Camp;
- produce the next missing piece for that person's own home.

IC1 must **not**:
- change save version;
- change birth rules yet;
- remove Camp yet;
- change global stock yet;
- add a second building executor;
- add a second item ledger;
- mutate ownership from UI;
- merge into main merely because unit tests pass.

## Acceptance principles

Every milestone uses:

```text
Success Contract
→ Candidate
→ Verify
→ SAT / VIOL / UNKNOWN
→ Repair / Reselect
→ Prove
```

UNKNOWN is never PASS.

Runtime/visual claims require the matching evidence scope. Static code inspection alone is not public-browser, pixel, GPU, performance or physical-device proof.
