---
type: success-contract
project: Simclone
domain: emergent-society
feature: MX6 Settlement Candidate
status: implementation-candidate
canonical: true
owner: Project Brain
validation: candidate
last_reviewed: 2026-09-26
---

# MX6 — Settlement Candidate

## Goal

Derive deterministic Settlement candidates from qualified MX5 Communities without creating persistent Settlement state.

## Candidate requirements

- qualified MX5 Community;
- at least 2 Households;
- at least 2 residents;
- at least 1 social link;
- at least 2 retained relationship evidence records;
- at least 60 ticks of retained relationship continuity.

## Output

A candidate exposes stable source IDs, current owners/residents, center, region and current spatial boundary.

All output is derived/read-only. No save fields are added.

UNKNOWN is never PASS.
