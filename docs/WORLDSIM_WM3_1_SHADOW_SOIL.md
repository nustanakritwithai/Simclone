# WM3.1 — Shadow Soil Evidence

Source reference: Living World Physics Simulator 20.9.4 Phase 5 Soil architecture.

The production WorldSim classifies soil deterministically from terrain, elevation/slope/coast context, humidity/fertility and seeded detail. It then derives health from nutrient, organic matter, moisture comfort, compaction, salinity, acidity, temperature and depth.

Simclone WM3.1 adopts the **shape of that contract**, not the production constants or state ownership.

## Shadow soil types
- none
- coastal
- sand
- loam
- clay
- peat
- rocky
- wetland

## Current evidence
WM3.1 may read only:
- WorldSim presentation terrain
- elevation
- moisture proxy
- completed-building occupancy

It computes normalized read-only proxies for:
- depth
- porosity
- field capacity
- organic matter
- nutrient availability
- moisture comfort
- compaction
- salinity
- acidity stress
- soil health
- fertility

These values are integration proxies, not claimed as exact 20.9.4 profile constants.

## Authority boundary
WM3.1 owns no water, nutrients, soil mutation, scheduler, save state or gameplay output.

It is evidence for WM3.0 resource suitability only.

The next safe promotion is to let resource **shadow** suitability consume WM3.1 soil health/fertility while K6 still owns actual nodes and regeneration.
