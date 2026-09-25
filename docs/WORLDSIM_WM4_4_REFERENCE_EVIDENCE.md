# WM4.4 Prep — Food Ecology Reference Evidence

Do not map relative quartiles directly to gameplay units.

Relative ranks are useful diagnostics, but a relative rule always creates a
bottom quartile even when the whole world is healthy. Before selecting an
absolute FOOD regeneration formula, collect a reproducible reference dataset
from the real engine.

Reference matrix:

- seeds: 230926, 1, 42, 2026, 90001
- food-regeneration boundaries: 120, 240, 360, 480, 600, 720

For each case record:

- food-node count
- average raw ecology potential
- min
- p10 / p50 / p90
- max
- relative quartile counts

The harness is analysis-only. It creates fresh deterministic worlds and never
touches runtime saves.

A later behavior threshold should be derived from verified reference evidence,
not from an assumed 0..1 uniform distribution and not from relative quartile
alone.
