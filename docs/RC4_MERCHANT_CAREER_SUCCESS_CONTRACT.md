# RC4 Merchant Career V1 — Success Contract

Status vocabulary: **SAT / VIOL / UNKNOWN**.  
**UNKNOWN is never PASS.**

## Scope

RC4 Merchant Career owns only:

- pure Merchant qualification
- canonical profession transition through existing `adoptProfession(...)`
- Merchant profession continuity
- bounded Merchant transaction progression hooks
- tests and verification evidence

RC4 Merchant Career does **not** own or implement:

- trade settlement
- wallet / currency authority
- Rust inventory
- Home Market
- pricing
- production UI
- autonomous Merchant policy
- shared runtime command integration

## Source authority

Canonical profession authority remains `src/kingdom-utility.mjs`.

Merchant code MUST NOT assign `agent.profession = 'merchant'` directly.  
The only Merchant transition path in this slice is:

```text
evaluateMerchantQualification(snapshot)
→ SAT
→ adoptMerchantProfession(agent, snapshot, tick)
→ adoptProfession(agent, 'MERCHANT', tick, explicitEvidence)
→ canonical career history
```

Legacy worker transitions continue to use the existing profession authority.

Special-profession lock for RC4:

- Adventurer cannot be overwritten by Merchant.
- Merchant cannot be overwritten by ordinary FORAGE / WOODCUT / MINE / BUILD selection.
- Merchant cannot be overwritten by the automatic Adventurer `explore-3` transition.
- A future explicit special-to-special transition policy is out of RC4 scope.

## Merchant Qualification V1

Pure function:

```js
evaluateMerchantQualification(snapshot)
```

Expected input projection:

```js
{
  alive,
  lifeStage, // CHILD | ADULT | ELDER | DEAD
  professionTransitionAllowed,
  homeControl: {
    status, // CONFIRMED | ABSENT | REJECTED | UNKNOWN
    houseId?, evidenceId?
  },
  operatingCapital: {
    status,
    amount
  },
  tradeKnowledge: {
    status,
    evidenceCount
  },
  evidenceId
}
```

### Required checks

| Check | SAT | VIOL | UNKNOWN |
|---|---|---|---|
| Alive | `alive === true` | `alive === false` | missing / invalid |
| Adult-capable | ADULT or ELDER | CHILD or DEAD | missing / invalid stage |
| Profession transition | explicit `true` | explicit `false` | missing / unresolved |
| Home control | CONFIRMED + evidence reference | ABSENT / REJECTED | UNKNOWN / malformed |
| Operating capital | CONFIRMED and amount >= 1 | confirmed amount < 1 / rejected | UNKNOWN / malformed amount |
| Trade knowledge | CONFIRMED and evidenceCount >= 1 | confirmed count < 1 / rejected | UNKNOWN / malformed count |
| Qualification evidence | non-empty bounded evidenceId | — | missing / malformed |

Overall result:

- any VIOL → **VIOL**
- otherwise any UNKNOWN → **UNKNOWN**
- all checks SAT → **SAT**

Only **SAT** may attempt Merchant adoption.

### V1 thresholds

```text
minOperatingCapital = 1
minTradeEvidence = 1
```

These are intentionally minimal authority-independent floors because RC4 does not define a wallet, currency denomination, pricing model or settlement rules. A later economy contract may raise them without changing the UNKNOWN rule.

## Replay / career history

Merchant qualification replay MUST NOT create duplicate career history.

Once an agent is already Merchant, the same qualification evidence returns unchanged profession state and does not append another Merchant career row.

Career history remains the existing bounded canonical `agent.career` tail.

## Save / load continuity

A Merchant profession written by the canonical profession authority MUST survive existing engine `serialize` → `restore` without:

- reverting to a legacy worker profession
- duplicating career history
- failing profession validation

No new save version is introduced by RC4 Merchant Career.

## Merchant progression hook

Prepared progression hooks:

- `merchantTransactions` — Career-owned non-monetary counter
- `merchantRealizedProfit` — read-only projection from canonical Merchant Ledger
- `merchantExperience` — Career-owned non-monetary counter

Only a fact with all of these may count:

```js
{
  transactionId,
  verified: true,
  committed: true
}
```

Rules:

- Merchant profession is required.
- `verified !== true` does not count.
- `committed !== true` does not count.
- missing verification/commit evidence is UNKNOWN.
- one accepted committed transaction increments `merchantTransactions` by 1.
- `merchantExperience` increments by 1 per accepted committed transaction.
- recent transaction IDs are retained only for bounded replay protection.
- Career MUST NOT store or accumulate Revenue, COGS or Realized Profit on the agent.
- `merchantRealizedProfit` progression support is satisfied only by a read-only projection of a valid Merchant Ledger snapshot.
- absent ledger evidence makes the projected profit UNKNOWN/null; malformed or mismatched ledger evidence is VIOL.
- a persisted `agent.merchantRealizedProfit` field is explicitly rejected as a duplicate monetary authority.
- authoritative monetary accounting belongs to the RC4 Merchant Ledger workstream.

## Required tests

- child does not qualify
- dead agent does not qualify
- no home-control evidence does not qualify
- capital below threshold does not qualify
- UNKNOWN evidence does not qualify
- replayed qualification does not duplicate career history
- Merchant profession survives save/load
- Merchant does not overwrite locked Adventurer
- ordinary worker actions do not overwrite Merchant
- automatic Adventurer qualification does not overwrite Merchant
- Merchant module contains no direct profession assignment
- progression counts only verified + committed transactions
- retained transaction replay does not double-count progression
- Career exposes `merchantRealizedProfit` only from a read-only Merchant Ledger projection
- Career does not create a second Revenue / COGS / Realized Profit authority
- absent ledger evidence stays UNKNOWN/null
- mismatched/drifting ledger totals are rejected
- a forged/legacy persisted `merchantRealizedProfit` field is rejected

## Verification contract

Routine candidate gate:

```text
npm test
```

Result interpretation:

- all required tests green and no scope violation → SAT
- failing assertion, direct Merchant profession writer, or forbidden subsystem edit → VIOL
- missing CI / unverified exact head / ambiguous evidence → UNKNOWN

## Known limitations

1. RC4 does not project runtime home, wallet/capital, or trade-knowledge state into the qualification snapshot. Integration must supply those authoritative facts later.
2. RC4 does not add a command or autonomous policy that triggers Merchant qualification in production.
3. Transaction replay protection is bounded to the most recent 32 transaction IDs; long-horizon settlement idempotency remains the Trade Kernel / Merchant Ledger responsibility.
4. Merchant progression fields are non-monetary additive save data and are not yet wired into engine-wide validation because shared runtime integration is outside this slice.
5. Revenue, COGS and Realized Profit are intentionally absent from Career state; Merchant Ledger is the accounting authority.
6. No pricing, market, wallet, inventory transfer or Home Market behavior is implied by Merchant profession SAT.

## Definition of Done

RC4 Merchant Career is SAT only when:

- exact branch head contains only in-scope changes
- Merchant profession is registered in the existing profession authority
- Merchant adoption uses canonical `adoptProfession`
- qualification tests prove required VIOL/UNKNOWN cases
- replay and save/load continuity tests pass
- progression only accepts verified + committed facts
- Career contains no monetary profit accumulator
- `merchantRealizedProfit` hook is available from a validated read-only Merchant Ledger projection
- duplicate persisted `merchantRealizedProfit` state is rejected
- `npm test` passes on the exact head
- PR is opened and remains unmerged
