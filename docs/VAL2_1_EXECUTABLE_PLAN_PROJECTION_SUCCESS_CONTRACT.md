# VAL2.1 — Executable Plan Projection Success Contract

Status: FROZEN FOR IMPLEMENTATION  
Base: `main@e24b55ab86601f38ae0ff9715013013aca7c36b5` (VAL2 public exact-release SAT).

## Goal

Expose the already-authoritative VAL2 personal plan as one read-only projection that UI/Inspector code can consume later without reading or rewriting planning internals directly.

This slice deliberately does **not** modify `engine.mjs`, `src/autonomous-life-view.mjs`, `src/independent-ui.mjs`, `index.html` or browser smoke because Governor v1 PR #117 currently owns those surfaces.

## Authority boundary

- Reads only `agent.planning.goal`.
- Never creates, advances, retries, completes or cancels a plan.
- Never writes tasks, resources, households, relationships, settlements or knowledge.
- No LLM/model call.
- Legacy mode returns no projection.
- Old/pre-VAL2 goals remain readable as legacy planning evidence, but missing VAL2 metadata is reported explicitly rather than invented.

## Projection

For a living Independent Clone return:
- goal
- status
- factual outcome
- target
- current step kind/phase
- planId
- attempt / maxReplans
- startedTick / updatedTick
- evidence status: `VAL2`, `LEGACY_PLAN`, or `NO_PLAN`

## Acceptance

1. Legacy mode returns null.
2. Projection is byte-read-only.
3. VAL2 plan identity and step exactly match `agent.planning.goal`.
4. Attempt/maxReplans are copied exactly, never recomputed.
5. No plan returns explicit `NO_PLAN`.
6. Pre-VAL2 goal returns `LEGACY_PLAN` without fabricating planId/step/replan values.
7. Save/load produces an identical projection.
8. No files owned by in-flight Governor v1 PR #117 are modified.
9. Existing full regression remains SAT.

UNKNOWN is not PASS.
