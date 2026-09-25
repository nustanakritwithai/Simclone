# Production Planning RP1 — candidate

RP1 is an opt-in deterministic coordinator layered on the Rust Survival RS1–RS4 command contracts.

## Goal

Turn accepted physical crafting from player-issued commands into a bounded autonomous production chain without creating a second work executor.

```text
survival stock
→ Stone Axe
→ Stone Pickaxe
→ Crafting Table Lv1
→ Hammer
→ Furnace
→ Charcoal target (4)
```

## Authority boundary

RP1 may only issue existing validated engine commands. It does not:
- mutate craft progress directly
- create items or stations directly
- spend materials outside Rust command acceptance
- bypass hunger, energy, lifecycle or path validation
- call an LLM
- read wall-clock time or randomness

The fixed-step engine and Rust runtime remain the execution authority.

## Persistence

`productionPlan` is a bounded optional 0.5.0 extension:
- enabled: explicit opt-in
- current goal/outcome
- last attempt tick
- at most 12 history rows

Older valid 0.5.0 saves that do not contain RP1 receive a disabled empty plan.

## Verification contract

- disabled RP1 must preserve the pre-RP1 deterministic baseline
- enabled RP1 must autonomously complete the bounded chain
- save/load mid-chain must resume without duplicate recipes or stations
- committed materials must never be spent twice
- hunger/energy may interrupt a task without deleting the accepted Rust order
- final state must pass authoritative save validation

Exact candidate CI and exact merged-main Pages remain release authority. UNKNOWN is not PASS.
