# WM4.4 — Food Ecology Reference Evidence

This gate is **analysis-only**. It does not activate a new food regeneration
formula and does not change the existing WorldSim WM4.1 writer.

## Why the earlier candidate failed

Fresh worlds start with food nodes at full capacity. Formula Lab correctly caps
candidate output by each node's missing capacity, so every candidate produced
zero units. Requiring “changed nodes > 0” on a full world was an invalid proof
condition.

## Corrected evidence method

Two deterministic views are kept separate:

1. **Untouched observation world** — records real raw ecology distribution.
2. **Controlled-depletion scenario** — each food node is set to exactly three
   missing units on a fresh copy, only for Formula Lab comparison.

Reference matrix:

- seeds: 230926, 1, 42, 2026, 90001
- boundaries: 120, 240, 360, 480, 600, 720 ticks
- controlled formula scenario: 3 missing units per food node

The report records min, p10, p50, p90, max, relative bands and candidate-unit
summaries for conservative / balanced / strong absolute-threshold formulas.

## Boundary

Do not map relative quartiles directly to gameplay units. Do not activate any
candidate from this report alone. A later authority gate must compare
survival/crisis/population continuity under a selected formula before changing
the single WorldSim writer.

UNKNOWN is not PASS.
