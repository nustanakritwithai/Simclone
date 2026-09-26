---
type: success-contract
project: Simclone
domain: emergent-society
feature: MX7 Settlement Authority
status: implementation-candidate
canonical: true
owner: Project Brain
validation: candidate
last_reviewed: 2026-09-26
---

# MX7 — Settlement Authority

## Goal

Promote qualified MX6 candidates into a bounded persistent Settlement identity while preserving all existing ownership/resource authorities.

## Persistent record

A Settlement record stores provenance only:

- Settlement ID;
- source candidate/community/neighborhood IDs;
- anchor owner ID;
- created tick;
- last qualified tick;
- active/dormant status.

It MUST NOT persist copied owner lists, resident lists, house lists, inventories, stocks or resources.

Current population, owners, homes, region and boundary are resolved from current source authorities.

## Writer

`src/settlement-authority.mjs` is the single Settlement writer.

Cadence: once per 360 ticks.

- qualified unseen candidate → create Settlement;
- existing candidate remains → refresh last-qualified tick;
- evidence disappears → mark dormant;
- same candidate never duplicates.

Maximum persistent records: 64.

## Save compatibility

Independent saves missing `settlementState` migrate deterministically to an empty MX7 state. Legacy village worlds do not require the extension.

No global save-version bump is required because the extension is additive and migration is explicit.

## UI

Only active promoted Settlements may change the Independent-world heading to `EMERGENT SETTLEMENT · MX7`.

## Final gate

MX7 is closed only after:
- unit tests SAT;
- full browser smoke SAT;
- 120-year continuity SAT;
- save/load + migration SAT;
- exact candidate CI SAT;
- merge to main;
- Pages exact-main public verification SAT.

UNKNOWN is never PASS.
