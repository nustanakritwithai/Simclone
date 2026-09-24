# WM4.3 — Shadow Food Ecology Formula

This gate proposes a **candidate only**. WM4.1 remains the authoritative writer
and continues the legacy +3 / 120 tick food behavior.

## Candidate conversion

Normalized ecology potential becomes a bounded integer proposal:

- [0.00, 0.25) -> 0
- [0.25, 0.50) -> 1
- [0.50, 0.75) -> 2
- [0.75, 1.00] -> 3

The proposal is also capped by the node's missing room.

## Why this first candidate is conservative

- It can never exceed the legacy +3 boundary increment.
- It can only reduce regeneration where ecology evidence is weaker.
- It does not change cadence.
- It does not mutate node.amount.
- It does not affect wood or stone.

The purpose is to measure survival impact before authority behavior changes.

## Promotion requirement

WM4.3 must report the projected unit delta and reduction ratio across multiple
seeds. A later Food Authority gate may activate a formula only if Survival,
birth, death and history-continuity acceptance remain inside an explicitly
approved envelope.
