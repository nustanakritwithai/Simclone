# Next build gates after the V0.3.5 death-history slice

These are implementation gates, not proof by themselves. The exact candidate and main workflows remain authoritative for release status.

## V0.3.5 Phase 1 — Death History + Migration

Implemented in the current 0.3.5 slice under [LIFECYCLE_0.3.5.md](LIFECYCLE_0.3.5.md):

- immutable death tick/cause/age-at-death for new age and starvation deaths
- explicit `historyVersion=0.1.0` while world save schema remains 0.2.0
- evidence-based migration for historical 0.2.0 deaths
- explicit `legacy-unknown` where retained evidence is insufficient
- legacy 0.1.0 rule that load-time age-18 adoption is not historical death-age evidence
- inspector disclosure of known versus unknown death history
- stable save/load continuation and retained corrupt/unreadable-save protection

This phase is not considered released until the exact candidate and exact main gates succeed.

## V0.3.5 Phase 2 — Historical identity / limits

Separate retained historical identity from active-worker limits. The current 200-agent history cap stops births eventually; do not fix it by deleting parents or merely increasing the number.

Measure save size, memory and runtime before choosing archive structures. Any archive must keep parent/generation/appearance/history resolution and the lineage + bornTick data used for deterministic reproduction pacing/cooldown.

Add boundary tests that deliberately reach retained-history limits. Define what happens when storage/history capacity is reached, including a bounded failure mode that does not silently erase ancestry.

## V0.3.5 Phase 3 — Extended proof / persistence

Add longer unmodified multi-seed runs and imported-age-cohort cases. Report population minima/extinction, births/deaths, starvation, lineage validity, save size and execution cost rather than only endpoint survivors.

Exercise native browser storage on a real HTTP origin when the environment supports it. Keep physical Android performance as a separate device test; offline Storage doubles are not evidence for either.

Definition of done for the broader V0.3.5 hardening phase: stable death history, lineage resolution across many deaths, deterministic save continuation, retained-history boundary behavior, and measured memory/performance/save-size evidence.

## V0.4 — Skill provenance before new skill families

Keep the existing four skills. Distinguish inherited XP from earned XP with source parent/event/tick and explicit work-outcome evidence. Demonstrate real productivity effects and no XP for zero output. Preview must remain read-only. Persistent provenance requires a documented migration and size budget.

Definition of done: inspector can explain where a character's current skill came from, and inherited/earned evidence survives parent death and save/load. Do not claim mentor teaching merely because XP was copied at birth.

## V0.5 — First cross-generation knowledge transfer

Start with one small teaching/archive vertical slice, not factions or a full economy. An agent learns a verified rule, records it with provenance, another agent acquires it through an explicit engine action, and it remains available after the original discoverer dies. Define permissions, costs, failure cases and verification before UI.

Definition of done: an automated test shows discoverer → recorded knowledge → learner → discoverer's death → knowledge still usable, with no unearned knowledge injection.

## Later gates

Local perception/belief, relationships and full replay are still required before the master's V1.0 claim. Do not expand 3D, faction, conflict or per-agent LLM calls to compensate for failures in lifecycle/persistence/knowledge contracts.
