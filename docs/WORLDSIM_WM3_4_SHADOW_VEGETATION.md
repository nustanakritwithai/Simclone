# WM3.4 — Shadow Vegetation / Ecology Evidence

WorldSim architecture keeps Vegetation as the owner of real living, dead and litter biomass plus plant nutrient stores. Fire and other systems must use bounded ports rather than duplicating those stores.

WM3.4 adopts only the **evidence shape**. It creates no biomass reservoir.

## Inputs

- WorldSim terrain/elevation presentation
- WM3.2 climate shadow
- WM3.1 soil shadow
- WM3.3 hydrology shadow

## Read-only outputs

- ground-cover potential
- woody biomass potential
- wetland biomass potential
- living biomass potential
- dead biomass potential
- litter potential
- food yield potential
- wood yield potential
- regeneration potential
- disturbance stress
- carrying capacity

## Authority boundary

WM3.4 owns:
- no living biomass
- no dead biomass
- no litter store
- no plant nutrient store
- no scheduler
- no save state
- no growth/death mutation
- no seed dispersal
- no resource spawn/regeneration mutation

Actual Simclone resource nodes remain K6 authority.

Promotion rule:
Only after Climate/Soil/Hydrology/Vegetation shadows all pass continuity may WM4 start moving **resource regeneration authority** one bounded resource type at a time.
