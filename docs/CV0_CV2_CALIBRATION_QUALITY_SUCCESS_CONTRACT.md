# CV0–CV2 — Evidence Reconciliation, Calibration Shadow and Learning Quality

Status: FROZEN FOR IMPLEMENTATION  
Base: `main@5ddb4e00062100f025847ad0cbd0d14e01c421ff`

## Success contract

### CV0

The legacy VAL5 read model must stop reporting prediction history as absent when VAL9 receipts are present.

Allowed output:

- `predictionHistory = RETAINED_VAL9`
- factual receipt count
- factual latest receipt id/tick
- no accuracy field

### CV1

Pair retained productive lessons to the newest retained prediction receipt satisfying:

- same planId
- same task kind
- same targetId
- receipt.tick <= lesson.tick

Each lesson is paired at most once.

For every linked sample derive:

```
elapsedTicks = lesson.tick - receipt.tick
latencySlackTicks = elapsedTicks - receipt.minimumTravelTicks
```

Interpretation:

- slack >= 0: factual delay above the deterministic minimum-travel lower bound
- slack < 0: EVIDENCE_CONFLICT
- no matching receipt: unlinked outcome, never guessed

No claim of travel accuracy, completion ETA accuracy, causal delay, or success probability.

### CV2

Quality thresholds:

- minimum linked samples: 2
- maximum conflicts: 0
- maximum linked UNKNOWN outcomes: 0

Status:

- conflict > 0 → VIOL
- linked samples < 2 → UNKNOWN
- linked UNKNOWN > 0 → UNKNOWN
- otherwise → SAT

Quality status is read-only and cannot block runtime actions.

## Authority boundaries

Must not change:

- candidate score
- task selection
- reservations
- executor
- resources/items
- Skill/Knowledge
- Household/Relationship/Settlement/Governance
- planning receipts or lessons

## Acceptance

1. Legacy mode returns null.
2. CV0 reports RETAINED_VAL9 after a retained receipt exists.
3. CV0 never invents accuracy.
4. CV1 is byte-read-only.
5. CV1 pairs exact plan/kind/target only.
6. newest matching receipt wins.
7. unmatched lesson remains unlinked.
8. negative latency slack is EVIDENCE_CONFLICT.
9. linked SAT/VIOL/UNKNOWN counts are exact.
10. aggregation by productive kind is exact.
11. CV2 with 0–1 linked samples = UNKNOWN.
12. CV2 with 2 clean linked samples = SAT.
13. CV2 with conflict = VIOL.
14. CV2 with linked UNKNOWN = UNKNOWN.
15. save/load identical state yields identical CV1/CV2 output.
16. no scorer/executor/runtime mutation.
17. routine regression remains SAT.
18. exact-main Pages/public release is required before CV0–CV2 closeout.

UNKNOWN is never PASS.
