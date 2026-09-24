# WorldSim Full Map Replacement — WM1

Source reference: Living World Physics Simulator 20.9.4 full source.

This replaces Simclone's old hand-authored river/grass generator with a deterministic WorldSim-style physical map.

## New canonical map cell
Each 30x26 Simclone cell now has:
- terrain: deepWater / shallowWater / sand / grass / forest / rock
- elevation
- temperature
- humidity
- fertility
- sea depth
- surface water
- soil moisture
- groundwater
- flood state
- climate: temperature / atmospheric humidity / rainfall / drought / weather type

## Authority
`worldMap` is canonical terrain/environment data.
`tiles` remains a temporary compatibility projection for existing renderer/path contracts and is derived from `worldMap`.

No DOM, Math.random or wall-clock time exists in map generation.

## Resource placement
Wood/food/stone nodes derive from terrain/fertility/elevation plus deterministic seeded detail. Starter resources remain guaranteed but are relocated to nearest valid land when needed.

## Migration
Existing saves will receive the new map from their original seed. Agents/buildings/nodes on invalid water cells must be relocated deterministically before validation.

Later map phases:
- WM2 engine migration + path authority
- WM3 renderer/minimap terrain palette
- WM4 climate/water gameplay modifiers
- WM5 ecology/resource regeneration from WorldSim state
