# WM4.6 — Wood Ecology Authority

Baseline: `main@3096da3b50864c74aa0870511ac09f3845aeeb08`

Status: **CANDIDATE on feature/wm4.6-wood-ecology**

## What moves

Wood regeneration amount, still written by `applyWorldResourceRegeneration()`, becomes ecology-sensitive.

```
woodYieldPotential
        ↓
potential < 0.08 → 0
otherwise        → 1
        ↓
capped at node.max every 720 ticks
```

Food remains `wm4.5-conservative-v1`. Stone remains finite. Write order remains food then wood.

## What must NOT change

- no second regeneration writer
- no node spawn / despawn / relocation
- no harvest-pressure (`node.amount` still unused by the ecology signature)
- no biomass / nutrient / water reservoir
- no routing, weather, Kingdom or Rust recipe changes
- no new required save fields

## Modes

- production default: `woodMode='ecology'`
- `woodMode='legacy'` is A/B only and restores historical wood `+1` / 720
- engine `resourceRegenerationMode` sets food and wood together

## Verification

- unit thresholds and per-node mapping in `tests/worldsim-resource-authority.test.mjs`
- compact A/B plus replay/save in `scripts/worldsim-wood-ecology-authority-proof.mjs`
- existing food ecology and continuity proofs remain mandatory
- exact candidate Verify and exact merged-main Pages remain release authority

UNKNOWN is not PASS.
