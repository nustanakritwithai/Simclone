# VAL2 — Goal + Executable Plan Success Contract

Status: FROZEN FOR IMPLEMENTATION  
Base: `main@a81610c6b6a64dd157d5462420254ab734c0fca3` after VAL1 exact-main Pages SAT.

## Goal

Add a bounded persistent executable-plan layer above the existing deterministic candidate scorer **without adding a second executor**.

The retained control flow remains:

```
candidates() → decide() → claim() → execute()
```

VAL2 may preserve an already-selected productive intent across temporary interruptions and may add one bounded continuation factor to the existing score. It may not directly assign work or mutate task execution outside the existing scheduler.

## Donor concept

AstraLife P4 supplies the design pattern only:
- explicit goal;
- executable step;
- pre-execution revalidation;
- timeout;
- bounded retry/replan;
- stale-step invalidation.

SIM Clone remains the authority. No AstraLife provider/runtime is copied wholesale.

## Scope

VAL2 applies only to Independent mode and only to existing personal-planning actions:

- FORAGE
- WOODCUT
- MINE
- BUILD
- EXPLORE (including visit-and-verify)

EAT / REST / IDLE remain survival/runtime interruptions and never become a competing long-term plan authority.

## Plan contract

Each retained plan is bounded and contains:
- deterministic planId;
- goal derived from existing personal planning;
- status;
- created/updated tick;
- replan count and max replans;
- at most 4 retained steps;
- one current step with action, target, timeout, validation tick, attempt count and failure reason.

Allowed plan statuses:
`ACTIVE | REPLAN_REQUESTED | COMPLETED | ABORTED`

Allowed step statuses:
`ACTIVE | INTERRUPTED | COMPLETED | INVALIDATED | TIMEOUT`

## Scoring contract

A matching active/interrupted plan may contribute only:

`planContinuation = +18`

through the existing candidate factor sum.

Survival emergencies keep their existing priority. VAL2 does not bypass:
- task validity;
- reservation/claim;
- path reachability;
- resource authority;
- Rust placement validation;
- Household Cooperation;
- Kingdom labor scoring.

## Replan contract

- max replans per plan = 3;
- max retained steps = 4;
- step timeout = 180 ticks;
- a temporary survival interruption does **not** consume replan budget;
- an unavailable/invalid planned step consumes one replan;
- after budget exhaustion the plan becomes ABORTED;
- an aborted identical goal is cooled down for 60 ticks before a new plan may be created.

## Acceptance

1. Legacy mode never creates VAL2 plans or score factors.
2. First productive selection creates a deterministic plan from the existing personal goal.
3. Matching candidate gets exactly +18 `planContinuation`; mismatches get 0.
4. EAT/REST interruption preserves the current plan without consuming replan budget.
5. Missing/invalid planned target moves the plan to REPLAN_REQUESTED and increments replan count exactly once.
6. A replacement productive choice creates the next bounded step without a second executor.
7. Replan count never exceeds 3; exhaustion becomes ABORTED.
8. Personal-goal completion closes the current step and plan as COMPLETED.
9. Death aborts a live plan.
10. Save/load with VAL2 state remains deterministic and validates.
11. VAL1 Inspector shows Goal / Step / plan status from retained VAL2 state.
12. Candidate score remains exactly the sum of its factors.
13. Existing IC7B/MX7/Independent/Legacy/browser/120-year regressions remain SAT.
14. GOV1 files/authority are untouched.

UNKNOWN is not PASS.
