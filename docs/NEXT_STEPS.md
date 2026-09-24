# Next build gates — Skill Provenance 0.4.0 candidate

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

Implemented as the current candidate under [SKILL_PROVENANCE_0.4.0.md](SKILL_PROVENANCE_0.4.0.md). Keep the existing four skills and their balance. Provenance distinguishes initial/inherited/earned/legacy-unattributed XP; source parent/tick and productive work outcome evidence are bounded and persistent. Old saves remain honest when the historical split cannot be proven.

Release is still gated on exact candidate and exact main verification. Do not call inheritance teaching.

## V0.5 — First cross-generation Knowledge + Memory slice

Use AstraLife as a donor for contracts, not as a code dump. Adopt the boundary `Observation + Owned Memory/Belief + Delivered Messages`; world truth stays authoritative and hidden global facts must not leak into cognition.

Start with one narrow verified rule tied to existing gameplay. Suggested first rule: a productive resource-work discovery creates evidence-backed personal knowledge; an explicit engine-mediated share transfers that claim to another agent; the recipient stores source/provenance and must not gain unrelated world facts. Then the discoverer dies/is archived and the recipient still resolves the knowledge.

Keep belief status minimal for this slice (`UNVERIFIED / CONFIRMED / STALE / REFUTED`) and bound evidence/memory from day one. Do not add LLM/provider calls yet.

Definition of done: discoverer → evidence-backed knowledge → explicit transfer → learner → discoverer archived → knowledge still usable/explainable, with no hidden global knowledge injection and deterministic save/load.

## Later gates

Local perception/belief, relationships and full replay are still required before the master's V1.0 claim. Do not expand 3D, faction, conflict or per-agent LLM calls to compensate for failures in lifecycle/persistence/knowledge contracts.
