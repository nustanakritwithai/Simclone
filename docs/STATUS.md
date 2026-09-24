# Simclone — Skill Provenance 0.4.0 candidate

Engine/UI and save schema target 0.4.0 on top of Historical Identity 0.3.6. The storage key remains `simclone:world:v1`; archive/history semantics remain bounded and deterministic.

## Implemented

The existing four skills remain FORAGE, WOODCUT, MINE and BUILD. Their balance formulas are unchanged.

Every person now carries exact per-skill provenance buckets:

```text
current XP
= initial XP
+ inherited XP
+ earned XP
+ legacy-unattributed XP
```

New Original starting XP is recorded as initial. Manual Clone and autonomous birth still copy exactly `floor(parent XP × 0.35)`, now with the parent's entity ID and child birth tick recorded as inheritance evidence. Successful productive work still grants +5 XP exactly where the previous engine granted it; the same transition increments earned XP and records action/target evidence. Zero-output work adds neither XP nor evidence.

Evidence is intentionally bounded: each skill retains structural origin plus the latest productive work evidence while cumulative counters remain authoritative. This prevents historical skill evidence from growing once per work action forever.

Old 0.3.0 saves cannot prove how existing XP was split historically, so migration records it as `legacyUnattributedXP` instead of reverse-engineering a fictional parent/work history. Earlier 0.2.0/0.1.0 migration keeps the established lifecycle/death/archive rules first, then attributes existing XP as legacy-unattributed.

Historical archive compaction preserves skill provenance and inheritance source IDs. The Skills inspector exposes inherited, earned, initial and legacy-unattributed XP and never calls inheritance teaching.

Contract: [SKILL_PROVENANCE_0.4.0.md](SKILL_PROVENANCE_0.4.0.md).

## Donor architecture used

This milestone borrows AstraLife's evidence/provenance discipline only. It does not import Astra providers or call an LLM per tick.

The next knowledge slice will adopt the stricter AstraLife principle:

```text
Agent cognition = Observation + Owned Memory/Belief + Delivered Messages
```

World truth remains authoritative in Simclone; cognition must not gain hidden global knowledge merely because the engine can access it.

## Verification limits

Exact candidate and exact main workflows remain release authority. Historical Identity 0.3.6 source is on main but its latest Pages deploy failed only at the final Pages action because that rerun contained two artifacts named `github-pages`; all source verification/browser/upload steps passed. A fresh main push must establish a new exact Pages result.

Native public-browser behavior and physical Android performance remain separate claims.

## Next

After exact V0.4 candidate/main release gates pass, build the first cross-generation Knowledge + Memory vertical slice before factions/economy. See [NEXT_STEPS.md](NEXT_STEPS.md).
