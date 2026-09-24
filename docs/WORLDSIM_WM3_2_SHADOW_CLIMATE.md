# WM3.2 — Shadow Climate Evidence

WM3.2 prepares Climate evidence without reintroducing the earlier full-authority Climate branch.

The Living World architecture treats Climate as its own deterministic scheduler and uses temperature, atmospheric moisture, cloud/rain and drought as inputs to Soil, Vegetation and Fire. WM3.2 adopts only the observable contract shape.

## Shadow inputs
- Simclone tick as a deterministic cycle proxy
- map latitude (row)
- elevation
- moisture proxy
- water-vs-land terrain

## Shadow outputs
- solar
- temperature proxy
- temperature comfort
- humidity
- cloud cover
- rain potential
- drought pressure
- weather label
- vegetation climate factor

## Authority boundary
WM3.2 owns:
- no world clock
- no atmospheric-water reservoir
- no cloud-water reservoir
- no rainfall mutation
- no scheduler
- no save state
- no hydrology coupling

The tick cycle is explicitly a Simclone integration proxy, not claimed to be the production Living World WorldTimeSystem.

Promotion path:
WM3.2 shadow climate -> Soil/Resource shadow evidence -> later Hydrology/Climate authority only after single-reservoir contracts are re-established.
