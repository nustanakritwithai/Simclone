# WS3 — Dynamic Climate

Stack: `K6 -> WorldSim Full Map -> WS2 Hydrology -> WS3 Climate`.

Source concepts adapted from Living World Physics Simulator 20.9.4:
- WorldTimeSystem
- TemperatureSystem
- AtmosphericMoistureSystem
- CloudSystem
- RainfallSystem
- closed atmospheric water accounting

Climate owns atmospheric/cloud water and time metadata.

Hydrology remains owner of surface/soil/groundwater. WS2 evaporation transfers into WS3 atmospheric water; WS3 rainfall leaves cloud water and is consumed by Hydrology on the following tick.

This closes the water cycle without duplicate reservoirs.

WS3 still does not change Clone needs or productivity. Weather remains world authority/presentation until a separate gameplay-modifier gate is proved.
