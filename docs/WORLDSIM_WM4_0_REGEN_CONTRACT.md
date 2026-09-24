# WM4.0 — Shadow Resource Regeneration Contract

This is the migration contract before WorldSim receives any real resource-regeneration authority.

## Current K6 truth

The authoritative engine currently performs:

- Food: +3 to each food node every 120 ticks, capped by node.max
- Wood: +1 to each wood node every 720 ticks, capped by node.max
- Stone: no regeneration

WM4.0 records this behavior exactly. It does not replace it.

## Ecology evidence

For renewable food/wood nodes, WM4.0 also records WM3.4 vegetation regeneration potential. That value is advisory only and has no unit amount yet.

Stone deliberately receives zero ecology regeneration potential because the current material is treated as finite geology.

## Authority boundary

- authoritative writer: Simclone K6
- WorldSim mutation: none
- node.amount: untouched
- save schema: untouched
- scheduler: untouched

## Promotion sequence

1. WM4.0 shadow contract proves exact legacy cadence.
2. WM4 Gate 1 moves the *writer* to a WorldSim resource function while preserving +3/120, +1/720, stone 0 exactly.
3. Continuity/history/browser gates must remain SAT.
4. Only a later gate may make food/wood regeneration depend on ecology evidence.

Ownership transfer and behavior change must never happen in the same gate.
