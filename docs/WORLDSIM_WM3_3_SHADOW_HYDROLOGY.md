# WM3.3 — Shadow Hydrology Evidence

Source reference: Living World Physics Simulator Hydrology + Phase 5 Soil/Hydrology integration contracts.

The production simulator uses real surface-water, soil-water and groundwater reservoirs, downhill flow, infiltration/drainage and evaporation with strict accounting.

WM3.3 intentionally does **not** recreate those reservoirs in Simclone.

## Read-only evidence

Derived from:
- WorldSim map terrain/elevation/moisture
- WM3.2 climate shadow
- WM3.1 soil shadow

Per cell:
- downhill cardinal target / slope
- surface-water potential
- infiltration potential
- runoff potential
- drainage potential
- groundwater recharge potential
- evaporation potential
- flood risk
- soil-water comfort
- water availability

## Single-source-of-truth rule

WM3.3 owns:
- no surface-water store
- no soil-water store
- no groundwater store
- no atmospheric-water store
- no scheduler
- no conservation ledger
- no save state

Because it has no reservoirs, conservation is explicitly **not applicable** at this stage. Conservation becomes mandatory only when real water authority is introduced.

## Purpose

Provide verified water evidence for Soil/Vegetation/Resource shadow layers before any Hydrology authority migration.

Actual K6 resources, pathing, stock and survival rules remain unchanged.
