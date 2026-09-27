# Simclone Convergence Roadmap — AstraLife + TestGE Donor Integration

Status: ACTIVE  
Baseline: `main@5ddb4e00062100f025847ad0cbd0d14e01c421ff`  
VAL7–VAL10 Pages #84 = SAT.

Donor baselines:

- AstraLife `main@21dcf780d6666732af2ef27500e478871864a6ac` — P6.11 Snapshot Governor + Event Wakeups
- TestGE `main@0ca33d9655df31d69045e0a483465f3271928471` — R11.5c Offline Learning Quality

## Product goal

Keep Simclone as the Living Society Runtime while importing only proven concepts from donor projects.

Do not copy donor authority wholesale.

Target architecture:

```
Living Society World
→ personal evidence
→ bounded plan
→ prediction receipt
→ authoritative action
→ outcome
→ calibration / quality
→ bounded learning
→ optional higher reasoning provider
```

The deterministic Simclone authority remains:

```
candidates() → decide() → claim() → execute()
```

## CV0 — Evidence reconciliation

VAL9 now retains prediction receipts, but the older VAL5 read model still says
`predictionHistory = NOT_RETAINED`.

Repair the read model so it reports the actual retained VAL9 evidence without changing
simulation behavior.

Acceptance:

- read-only
- legacy remains null
- retained receipt count is factual
- no prediction accuracy is fabricated
- old-save compatibility remains intact

## CV1 — Prediction Calibration Shadow

Donor concept: AstraLife P3 prediction → actual → error.

Simclone adaptation is deliberately narrower.

Current VAL9 predicts a deterministic minimum travel time, not full completion time.
Therefore CV1 must not call the difference "prediction accuracy".

For each retained productive outcome with a matching VAL9 receipt, compute:

- receipt tick
- outcome tick
- actual elapsed ticks
- minimum travel ticks
- latency slack = elapsed - minimum travel
- SAT / VIOL / UNKNOWN outcome
- interruption evidence
- exact planId / kind / target linkage

Evidence states:

- `NO_OUTCOME_EVIDENCE`
- `RECEIPTS_MISSING`
- `CALIBRATION_EVIDENCE`
- `EVIDENCE_CONFLICT`

A negative latency slack is impossible under the current lower-bound model and is an explicit conflict.

CV1 is read-only and must not adjust scores or behavior.

## CV2 — Offline Learning Quality Gate

Donor concept: TestGE R11 offline validator / offline quality report.

CV2 evaluates evidence readiness for a future adaptive learner.

Per Clone status:

- `SAT` — at least 2 linked samples, zero conflicts, zero UNKNOWN linked outcomes
- `VIOL` — impossible evidence conflict exists
- `UNKNOWN` — insufficient or unresolved evidence

UNKNOWN is never PASS.

The gate is observation only. It must not block gameplay, mutate weights, or change candidate ranking.

## CV3 — Executable-step failure semantics

Donor concept: AstraLife P4 executable plans.

Adapt into the existing VAL7 step sequence:

- precondition class
- bounded timeout
- retry count
- failure class
- explicit invalidation
- replan / abort outcome

No second planner or executor.

## CV4 — Transactional action shadow

Donor concept: TestGE TWA Proposal → Verify → Commit.

Start as a shadow on one narrow mutation family, expected to be productive resource actions.

Produce a detached proposed write-set and compare it with the authoritative mutation.

No commit authority moves in this gate.

## CV5 — Atomic delta / replay slice

Only after CV4 shadow proves equivalence:

- authoritative bounded write-set for the selected domain
- deterministic delta record
- replay/rollback proof for that domain
- no global engine rewrite

Expand domain-by-domain only after evidence.

## CV6 — Optional event-driven higher reasoning provider

Donor concept: AstraLife P6.11 Snapshot Governor.

Optional and external to deterministic simulation truth:

- event-driven or periodic snapshots
- bounded batch reasoning
- cached reusable decisions
- all proposed decisions pass existing Simclone validation/claim/executor
- no per-tick LLM
- provider failure must degrade to deterministic local behavior
- no hidden World Truth beyond approved observation snapshot

CV6 is deferred until CV3–CV5 authority contracts are stable.

## Non-goals

- no direct merge from AstraLife or TestGE
- no donor save schema
- no second resource/item/household/governance writer
- no global TestGE engine replacement
- no per-tick LLM
- no behavior-changing calibration before CV2 quality SAT evidence exists

## Verification

Every phase uses:

`Success Contract → Candidate → Verify → SAT/VIOL/UNKNOWN → Repair → Prove → Merge → exact-main Pages`

UNKNOWN is not PASS.
