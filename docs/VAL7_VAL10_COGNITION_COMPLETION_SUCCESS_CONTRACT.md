# VAL7–VAL10 — Cognition Completion Success Contract

Status: FROZEN FOR IMPLEMENTATION  
Base: `main@babea1d1e4b0390fc223338a84d60a1309c34139`  
Dependency satisfied: VAL6 exact-main Pages #83/public exact-release = SAT.

## Goal

Close the current Visible Autonomous Life cognition line without adding a second planner, scorer, scheduler, executor, knowledge ledger, or hidden-world reader.

Target flow:

```
Goal
→ bounded step sequence
→ current task
→ retained prediction receipt
→ authoritative execution
→ retained outcome
→ receipt-backed learning
→ visible reasoning
```

The existing runtime remains authoritative:

```
candidates() → decide() → claim() → execute()
```

## VAL7 — Bounded executable step sequence

Extend the existing personal plan, not a second planner.

Each current productive plan may carry an optional `sequenceVersion = VAL7-0.1` with at most 3 bounded steps:

1. target evidence / visit-and-verify
2. productive work
3. outcome verification

A directly visible target may start with step 1 already completed.
A remembered target starts at verification.
The existing `planId`, `attempt`, `maxReplans`, `status`, and current `step` remain authoritative and backward-compatible.

Out of scope:
- no new production coordinator
- no replacement for RP1 Rust/home chain
- no arbitrary long plans
- no LLM planning

## VAL8 — Visible reasoning

The existing read-only Autonomous Life projection exposes:

- current action
- current personal plan / step sequence
- latest retained prediction receipt
- latest retained outcome lesson
- current `outcomeLearning` score factor

The Inspector renders those facts compactly.

UI never invents motive, outcome, prediction, or learning state.

## VAL9 — Bounded prediction receipts

Prediction history is retained inside the existing personal-planning state.

Limit: 4 receipts per Clone.

A receipt is created only after a productive task is successfully claimed and selected.

Receipt fields:

- version
- receiptId
- planId
- tick
- taskKind
- targetId
- minimumTravelTicks
- moveTicksPerStep
- remainingRouteSteps
- selectedScore
- revalidate
- interruptionNow

The receipt uses the same pure prediction evidence helper as VAL3.
No second prediction formula is allowed.

## VAL10 — Receipt-backed negative learning

VAL6 positive learning remains bounded at +4.

Negative learning is allowed only when all are true:

- survival emergency is false
- productive family matches
- the current terminal plan is a verified bounded VIOL
- the terminal lesson belongs to the same planId
- a retained prediction receipt exists for the same planId + taskKind + targetId
- the receipt was created before/equal to the terminal outcome tick
- receipt had no immediate survival interruption

Then:

```
outcomeLearning = -1
```

No receipt => no negative penalty.
UNKNOWN/conflict => no negative penalty.
The negative cap is exactly -1.

This is receipt-backed failure avoidance, not a claim of full causal attribution.

## Authority boundaries

Must remain unchanged:

- one candidate scorer
- one `decide()`
- one reservation/claim path
- one executor
- resource/item/household/relationship/settlement/governance writers
- Skill/Knowledge provenance
- existing save authority

No:
- per-tick LLM
- Math.random rule
- wall-clock simulation rule
- hidden World Truth in personal cognition
- second learning ledger
- duplicate RP1 production planner

## Acceptance — VAL7

1. Existing VAL2 saves remain valid.
2. New productive plans carry at most 3 deterministic steps.
3. remembered target starts in verify-target step.
4. confirmed target advances to productive-work step.
5. productive SAT completes work + outcome verification.
6. bounded replan VIOL preserves step sequence and terminal failure state.
7. save/load retains sequence identically.

## Acceptance — VAL8

8. Autonomous Life snapshot is byte-read-only.
9. Inspector can show current plan step X/Y.
10. latest prediction receipt is factual or explicit UNKNOWN.
11. latest outcome is factual or explicit UNKNOWN.
12. learning factor shown equals actual selected trace factor.
13. existing score === sum(factors) remains true.

## Acceptance — VAL9

14. receipt is written only after successful claim/selection.
15. no receipt for EAT/REST/IDLE.
16. max retained receipts = 4.
17. receipt prediction equals VAL3 evidence for the same selected task.
18. save/load retains receipts deterministically.
19. validator rejects malformed receipts.

## Acceptance — VAL10

20. receipt-backed verified terminal VIOL gives exactly -1.
21. VIOL without matching receipt gives 0.
22. UNKNOWN/conflict gives 0.
23. survival emergency gives 0.
24. positive learning remains capped +4.
25. negative learning cannot exceed -1.
26. candidate score still uses one optional `outcomeLearning` factor.
27. no task/status/hard-validation path is bypassed.

## Regression / release

28. routine candidate CI must be SAT.
29. active Chromium UI smoke must be SAT.
30. Independent desktop smoke must be SAT.
31. exact-main Pages/public exact release must be SAT before VAL7–VAL10 is closed.

UNKNOWN is never PASS.
