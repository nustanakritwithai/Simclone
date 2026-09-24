# WM4.2 — Shadow Food Regeneration Impact

WM4.2 does not change food regeneration and deliberately does not invent a
replacement unit formula.

It compares the current K6 contract:

- food +3 every 120 ticks, capped by node.max

against the normalized regeneration potential produced by the WorldSim
Climate → Soil → Hydrology → Vegetation evidence chain.

The report classifies food nodes into diagnostic ecology bands using the observed
shadow scale: very-low < 0.04, low < 0.08, medium < 0.12, high >= 0.12.
These bands are visualization/evidence only and are not a regeneration-unit formula.
The authoritative writer remains WorldSim WM4.1 with the unchanged +3/120 parity behavior.

This evidence is required before any ecology-sensitive food regeneration gate.
The next behavior gate must define and separately verify a bounded conversion
from normalized ecology evidence into actual units; that conversion is not part
of WM4.2.


## Canonical impact fixture

The canonical multi-seed report samples ticks 120 / 240 / 360 and sets food
nodes to a depleted test fixture before observation. This makes the
missing-capacity weighted metric meaningful without changing production state.
