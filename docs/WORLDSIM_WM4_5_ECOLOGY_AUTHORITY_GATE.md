# WM4.5 — Ecology Authority Selection Gate

Baseline: `main@11a85cf153cc581708336d2eb4fd316b317f2eb2`

Status: **EVIDENCE / BEHAVIORAL PROOF REQUIRED — NOT YET AUTHORITATIVE**

This gate follows WM4.4. It deliberately separates formula selection and behavioral proof from mutation of the single WorldSim regeneration writer.

## Selected candidate for proof

Use the WM4.4 **conservative** absolute-threshold candidate as the sole candidate entering behavioral verification:

```
potential < 0.003 -> 0
potential < 0.010 -> 1
potential < 0.025 -> 2
otherwise         -> 3
```

Cadence remains 120 ticks. Increment remains integer 0..3 and is capped by node missing capacity. Wood and stone behavior are outside this gate.

Selection here means **candidate under test**, not production approval. `applyWorldResourceRegeneration()` must remain WM4.1 K6-parity until every success condition below is SAT.

## Success Contract

Before changing gameplay food regeneration, prove all of the following on the exact candidate source:

1. **Single writer** — no second node.amount regeneration writer is introduced.
2. **Determinism** — identical seed + commands + save state produce identical results.
3. **Formula bounds** — food increment is integer 0..3, monotonic in ecology potential, cadence stays 120 ticks, and missing capacity is respected.
4. **Baseline safety** — existing unit, Survival, lifecycle, death, continuity/history and relevant browser suites remain SAT.
5. **Controlled food crisis** — depleted-food scenarios compare WM4.1 legacy against the selected candidate across locked seeds without hidden intervention.
6. **Population continuity** — long-run generation fixtures are compared under both policies; deaths/births/population and food availability are recorded, not summarized as PASS merely because the process completes.
7. **Save/load replay** — save/load continuation under the candidate matches uninterrupted continuation.
8. **No scope leak** — wood remains +1/720, stone remains finite, stock/crafting/RP1/KF1 are not given new writers.
9. **Compatibility decision** — if policy identity must persist for deterministic continuation, add an explicit policy/save migration before promotion; otherwise document why existing saves remain deterministic.
10. **Exact CI evidence** — exact candidate verification succeeds before merge; exact merged-main Pages succeeds after merge.

Any missing item is **UNKNOWN**, not PASS.

## Required comparison output

For every locked seed/scenario record at minimum:

- total food regenerated
- depleted-food-node count
- minimum/median food availability
- starvation deaths
- age deaths
- births
- living population at checkpoints
- retained population/history count where applicable
- save/load equality result
- deterministic replay equality result

The report must keep WM4.1 legacy and the selected candidate side-by-side. It must not silently tune thresholds during a run.

## Promotion rule

Only after the complete comparison is SAT may a later commit change the existing single writer in `src/worldsim-resource-authority.mjs` from `behavior: 'k6-parity'` to an explicitly versioned ecology policy.

WM4.5 itself does **not** activate ecology-sensitive food regeneration.

## Rejection rule

If the conservative candidate causes unacceptable collapse, removes meaningful ecology pressure, breaks replay/save compatibility, or lacks enough evidence to decide, keep WM4.1 gameplay unchanged and record the result as VIOL or UNKNOWN. Do not fall through to balanced/strong in the same authority gate; a different candidate requires a new explicit selection/evidence revision.
