# Next build gates — Historical Identity 0.3.6 candidate

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

Phase 1 was deployed by main f2edda01af049ca8090f651d84376c29a8f32490, Pages run 35960844010. Its historical schema notes above describe that release, not current save 0.3.0.

## V0.3.5 Phase 2 — Historical identity / limits

Implemented as the 0.3.6 candidate in [HISTORY_LIMITS_0.3.5.md](HISTORY_LIMITS_0.3.5.md). Explicit save 0.3.0 migration, buffered dead archive, shared parent/lineage resolution and bounded 1024 retention replace the old 200-hot-record coupling. Exact candidate/main verification is still required before release. No unlimited history claim.

## V0.3.5 Phase 3 — Extended proof / persistence

The 0.3.6 candidate includes five unmodified 1800-year runs crossing the old 200-history boundary. Next add imported-age-cohort cases and evaluate the new full-retention exhaustion path over longer horizons. Do not synthesize new adults to repair extinct saves. Report population minima/extinction, births/deaths, starvation, lineage validity, save size and execution cost rather than only endpoint survivors.

The candidate adds a separate native HTTP/localStorage/process-restart check to the existing CI navigation entry point. Local HTTP is blocked by administrator policy, so do not infer local PASS; inspect exact CI output. Keep physical Android performance as a separate device test; offline Storage doubles are not evidence for either.

Definition of done for the broader V0.3.5 hardening phase: stable death history, lineage resolution across many deaths, deterministic save continuation, retained-history boundary behavior, and measured memory/performance/save-size evidence.

## V0.4 — Skill provenance before new skill families

Keep the existing four skills. Distinguish inherited XP from earned XP with source parent/event/tick and explicit work-outcome evidence. Demonstrate real productivity effects and no XP for zero output. Preview must remain read-only. Persistent provenance requires a documented migration and size budget.

Definition of done: inspector can explain where a character's current skill came from, and inherited/earned evidence survives parent death and save/load. Do not claim mentor teaching merely because XP was copied at birth.

## V0.5 — First cross-generation knowledge transfer

Start with one small teaching/archive vertical slice, not factions or a full economy. An agent learns a verified rule, records it with provenance, another agent acquires it through an explicit engine action, and it remains available after the original discoverer dies. Define permissions, costs, failure cases and verification before UI.

Definition of done: an automated test shows discoverer → recorded knowledge → learner → discoverer's death → knowledge still usable, with no unearned knowledge injection.

## Later gates

Local perception/belief, relationships and full replay are still required before the master's V1.0 claim. Do not expand 3D, faction, conflict or per-agent LLM calls to compensate for failures in lifecycle/persistence/knowledge contracts.
