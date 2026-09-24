# WM3.0 — Shadow Resource Ecology

This phase prepares the Resource Authority Gate without moving resource ownership yet.

WorldSim 20.9.4 vegetation suitability is limited by real environmental factors such as water, temperature, nutrients, solar radiation, soil health, salinity, acidity, compaction, flood state and root depth.

Simclone does not own those authorities yet on main, so WM3.0 deliberately uses only evidence that already exists in the WorldSim map view:

- terrain / biome
- elevation
- moisture

It computes read-only suitability for:
- food
- wood
- stone

It also reports a shadow regeneration pressure for existing K6 nodes based on:
`suitability × depletion`.

No resource amount, spawn, stock, task score, save state or regeneration rule is changed.

This is a proxy gate, not the full Living World vegetation runtime.

Promotion path:
WM3.0 shadow ecology -> Soil/Climate evidence -> shadow regeneration -> Resource Authority Gate.
