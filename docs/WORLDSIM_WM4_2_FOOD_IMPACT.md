# WM4.2 — Shadow Food Regeneration Impact

WM4.2 does not change food regeneration and deliberately does not invent a
replacement unit formula.

It compares the legacy K6 behavior now owned by WorldSim WM4.1:

- food +3 every 120 ticks, capped by node.max

against the normalized regeneration potential produced by the WorldSim
Climate → Soil → Hydrology → Vegetation evidence chain.

The report classifies food nodes into very-low / low / medium / high ecology
bands, and keeps the WM4.1 WorldSim authoritative writer plus the legacy unit increment unchanged.

This evidence is required before any ecology-sensitive food regeneration gate.
The next behavior gate must define and separately verify a bounded conversion
from normalized ecology evidence into actual units; that conversion is not part
of WM4.2.


## Decision evidence

The report also records:
- p10 / p50 / p90 ecology regeneration potential
- depleted food-node count
- depleted nodes whose ecology potential is below 0.5

These fields are evidence for the later unit-conversion design only. WM4.2 still
has no candidate increment and cannot mutate a node.
