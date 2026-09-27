# VAL6 — Preparation Work State

Status: IMPLEMENTED CANDIDATE / VERIFY PENDING

## Baseline

Prepared from:

`main@388ddaf32f81429edcb24ba6b6f62ef6135734c7`

VAL5 is merged on this SHA.

VAL5 exact-main release at preparation time:

- Pages run #82
- status: SUCCESS
- VAL5 public release: SAT

Dependency gate satisfied. VAL6 implementation is now present on this branch; merge remains blocked until exact candidate CI is SAT.

## Audit question

Where can bounded outcome learning affect behavior without creating a second decision or execution authority?

## Runtime evidence

Current candidate pipeline:

```
candidates()
→ add()
→ factors
→ score = sum(factors)
→ decide()
→ claim()
→ rememberPlanSelection()
→ execute()
```

Observed active candidate factors include:

- base
- need
- goal
- skill
- distance
- laborMarket
- householdCooperation
- governorPolicy

The existing score writer is centralized in `src/engine.mjs`.

The existing Inspector reads arbitrary non-zero `trace.factors` and separately verifies `score === factorSum`.

## Classification

- Existing centralized candidate scorer: Matches design.
- VAL5 outcome evidence: Matches read-only design.
- Historical prediction receipts: Validation gap / not retained by VAL3.
- Negative learning from VIOL evidence: Design ambiguity; causal failure class is unavailable.
- Safe initial learning authority: positive-only bounded reinforcement from repeated SAT productive evidence.

## Prepared decision

VAL6 initial authority will use:

```
outcomeLearning = min(4, satCount)
```

only when at least two matching productive retained samples are all SAT, with no VIOL/UNKNOWN and no survival emergency.

No negative penalty is allowed in this gate.

## Collision check

Active separate work remains outside this prep scope:

- Khet Sila PR #123
- stale/reference Household Trade #102
- stale UX #84
- stale Housing #74
- stale BM1 #73

VAL6 prep changes docs only.

Future implementation is expected to touch the candidate scoring path, so current main and open PR changed files must be re-read immediately before coding.

## Implemented candidate

- pure authority: `src/outcome-learning-authority.mjs`
- VAL5 retained-evidence helper exported read-only
- one `outcomeLearning` factor added to the existing candidate score
- positive-only cap = 4
- survival emergency / VIOL / UNKNOWN / conflict suppress the factor
- no persisted learning ledger
- runtime pins refreshed
- targeted authority/integration tests added

## Next action

1. Re-read exact current `main` before PR/merge.
2. Verify diff ownership remains isolated.
3. Run exact candidate CI.
4. Repair only from evidence if VIOL.
5. Merge only after candidate SAT.
6. Run exact-main Pages/public gate.


## Repair evidence — candidate CI

Verify #1335 failed in npm test with two concrete defects:
- synthetic VAL6 test lessons used ticks greater than state.tick; validator correctly rejected the fixture
- new authority imported read-model modules without the repository runtime version suffix

Those were repaired without changing VAL6 scoring semantics.

Verify #1339 then passed all Node tests (572/572) but failed active Chromium boot. Root cause: the offline browser fixture rewrites top-level `./...` module dependencies into data URLs; pulling `src/read-models/*` into the hot runtime introduced nested `../...` relative imports that cannot resolve from a data URL.

Repair:
- extracted shared pure retained evidence into `src/outcome-learning-evidence.mjs`
- VAL6 authority now imports only top-level runtime modules
- VAL5 read model consumes the same shared helper
- no browser-fixture weakening or gate removal
- runtime pins refreshed

Scoring formula and cap remain unchanged.
