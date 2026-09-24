# WM4.3 Prep — Food Regeneration Formula Lab

This is a safety harness for the later food-ecology behavior gate.

It does **not** select a production formula.

A candidate formula may inspect WM4.2 food-node evidence and must return an
integer increment from 0 to 3. The lab compares that proposal against the
legacy +3/120 behavior without mutating any node.

## Hard constraints

- cadence remains 120 ticks
- candidate increment must be integer 0..3
- node.max / missing capacity is respected
- stone and wood are outside this gate
- no save-state changes
- no authoritative mutation

## Outputs

- legacy units
- candidate units
- aggregate delta
- suppressed units
- changed node count
- per-node legacy vs candidate delta

The production WM4.3 formula must be chosen only after WM4.2 impact evidence is
verified. This module exists so the chosen formula can be evaluated before it
is allowed to write gameplay state.
