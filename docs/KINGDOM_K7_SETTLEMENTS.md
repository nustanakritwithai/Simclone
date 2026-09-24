# K7 — Multi-settlement identity/data contract

Baseline: `main@1c4954a9cccb41c9edace6100a4dda94bc31e02d`.

K7 is the first step after K6. It introduces a deterministic **derived settlement identity** without creating trade authority.

## Contract

- every complete `camp` is a settlement anchor
- stable ID: `settlement:camp:<buildingId>`
- living agents are assigned to the nearest anchor
- equal-distance ties resolve by anchor building ID
- current main therefore still has one settlement
- fixtures can represent multiple settlements now

## Still not implemented

- settlement-local stock
- settlement-local demand/market authority
- migration
- routes/caravans
- money, wages, tax
- buy/sell
- persistent settlement ownership state

K7 is derived/read-only, so save version remains unchanged.

Next: K8 settlement-local stock/demand/market projections, then route/travel contract, then trader/caravan extraction.
