# WM4.3 Prep — Food Ecology Calibration

WM4.2 proved that food ecology evidence can be observed without changing
gameplay. Before choosing a food-regeneration formula, the raw scale must be
calibrated.

The current WorldSim shadow pipeline produces normalized regeneration evidence,
but absolute values are not assumed to span 0..1 uniformly. Therefore this gate
adds deterministic empirical ranks across the current food nodes.

## Outputs

- raw min / max
- raw p10 / p50 / p90
- per-node relative rank 0..1
- relative quartile band q1 / q2 / q3 / q4

Equal raw values receive the same midpoint rank, so deterministic ties do not
depend on node iteration order.

## Authority boundary

This layer is calibration-only:

- no node.amount mutation
- no cadence change
- no writer change
- no save-state change
- no candidate unit formula

A later behavior formula may consume calibrated evidence, but only after the
Formula Lab and calibration layers pass full verification.
