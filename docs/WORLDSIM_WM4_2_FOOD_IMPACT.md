# WM4.2 — Shadow Food Regeneration Impact

WM4.2 does not change food regeneration and deliberately does not invent a
replacement unit formula.

It compares the current K6 contract:

- food +3 every 120 ticks, capped by node.max

against the normalized regeneration potential produced by the WorldSim
Climate → Soil → Hydrology → Vegetation evidence chain.

The report classifies food nodes into very-low / low / medium / high ecology
bands, but keeps the authoritative writer and unit increment unchanged.

This evidence is required before any ecology-sensitive food regeneration gate.
The next behavior gate must define and separately verify a bounded conversion
from normalized ecology evidence into actual units; that conversion is not part
of WM4.2.
