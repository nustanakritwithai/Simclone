---
type: success-contract
project: Simclone
domain: world-simulation
feature: WM4.7 Harvest Pressure
status: implementation-candidate
canonical: true
owner: Project Brain
validation: candidate
last_reviewed: 2026-09-26
---

# WM4.7 — Harvest Pressure Feedback

## Goal

Make renewable Food/Wood recovery respond to local extraction pressure without creating a second resource ledger or replacing the existing WorldSim regeneration writer.

## Authority

- single writer remains `applyWorldResourceRegeneration()`;
- writer id becomes `worldsim-wm4.7`;
- WM4.5 food ecology formula remains unchanged;
- WM4.6 wood ecology formula remains unchanged;
- Stone remains finite;
- legacy mode remains test-only historical A/B behavior.

## Pressure evidence

Harvest pressure is derived only from the canonical resource node:

```
pressure = 1 - node.amount / node.max
```

No history ledger is added. Pressure naturally falls as the same canonical node recovers.

Thresholds:

- pressure < 0.50: ecology increment unchanged;
- 0.50 <= pressure < 0.85: increments above 1 lose one unit;
- pressure >= 0.85:
  - increments above 1 lose one unit;
  - one-unit recovery uses a deterministic two-boundary gate keyed by regeneration epoch + node id.

This keeps severe depletion slower while preventing renewable nodes from being permanently dead.

## Invariants

1. No new save fields.
2. No Date/time, Math.random, DOM or external API.
3. No second Food/Wood writer.
4. Legacy A/B mode remains byte-compatible with historical K6 regeneration.
5. Same seed + same commands + same mode must replay byte-identically.
6. Pressure calculation is pure and bounded [0,1].
7. A renewable node with non-zero ecology potential receives recovery opportunities within a bounded two-boundary window under severe pressure.
8. Stone remains non-renewable.
9. UNKNOWN is never PASS.

## Deferred

- persistent biomass reservoirs;
- dynamic climate/hydrology schedulers;
- fire/erosion/nutrient mutation;
- resource-zone authority;
- direct weather modifiers on Clone needs/productivity.
