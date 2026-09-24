# Next build gates after V0.3.4

These are plans, not implemented features. Complete the exact V0.3.4 candidate and Pages verification before starting another runtime feature.

## V0.3.5 — Save and historical lifecycle hardening

Define an explicit persistence contract for death tick/cause and age-at-death so a deceased person's displayed age cannot drift with the living world's clock. Any new persistent fields require a versioned migration with real 0.1.0/0.2.0 fixtures; no silent defaults that rewrite history. Confirm that corrupt/unreadable originals remain exportable and protected.

Separate retained historical identities from active-worker limits. The existing 200-history cap stops births eventually; do not delete parents or raise the cap without bounded-performance, lineage and save-size tests. Add a longer unmodified multi-seed run and imported-age-cohort cases. Report extinction or resource failures, not just survivors at the endpoint.

Definition of done: death history stays stable, lineage resolves after many deaths, save/load continuation is deterministic, and memory/performance/size bounds have measured evidence. Native browser persistence can be checked on a real HTTP origin; physical Android performance remains a distinct device test.

## V0.4 — Skill provenance before new skill families

Keep the existing four skills. Distinguish inherited XP from earned XP with source parent/event/tick and explicit work-outcome evidence. Demonstrate real productivity effects and no XP for zero output. Preview must remain read-only. Persistent provenance requires a documented migration and size budget.

Definition of done: inspector can explain where a character's current skill came from, and inherited/earned evidence survives parent death and save/load. Do not claim mentor teaching merely because XP was copied at birth.

## V0.5 — First cross-generation knowledge transfer

Start with one small teaching/archive vertical slice, not factions or a full economy. An agent learns a verified rule, records it with provenance, another agent acquires it through an explicit engine action, and it remains available after the original discoverer dies. Define permissions, costs, failure cases and verification before UI.

Definition of done: an automated test shows discoverer → recorded knowledge → learner → discoverer's death → knowledge still usable, with no unearned knowledge injection.

## Later gates

Local perception/belief, relationships and full replay are still required before the master's V1.0 claim. Do not expand 3D, faction, conflict or per-agent LLM calls to compensate for failures in lifecycle/persistence/knowledge contracts.
