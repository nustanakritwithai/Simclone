# RC4 Merchant Career V1 — Success Contract

## Provenance repair override — hardened #179 compatibility (2026-09-29)

This section supersedes conflicting transaction-progression wording below.

Hardened Pricing/Ledger PR #179 exact head `9b5e63e386f0543f9700237242b2c4f0745a8c2d` correctly proves that a caller can forge both a canonical-looking receipt and a matching `tradeReplay` object graph. Therefore Merchant Career MUST NOT treat plain non-duplicate `VERIFIED/COMMITTED`-looking evidence as transaction truth.

Locked Career behavior:

- structurally valid `duplicate:true` evidence remains a safe no-op;
- malformed/tampered receipt remains VIOL;
- Merchant party lock remains required;
- every non-duplicate caller-supplied transaction evidence object returns `UNKNOWN / trade-commit-provenance`;
- `noteVerifiedCommittedMerchantTransaction()` must not mutate `merchantTransactions` or `merchantExperience` from such evidence;
- no local nonce, signature, replay list, callback, `verified:true`, `committed:true`, or matching caller-provided `tradeReplay` may promote the evidence;
- Career remains non-monetary and never owns Revenue / COGS / Realized Profit.

A new pure `calculateMerchantProgressionAfterCommit(agent, receipt)` may calculate the next non-monetary counters without mutating state. It is NOT provenance authority. B8 Integration may use that calculation only after the trusted post-root orchestration has looked up the exact committed receipt from the authoritative live/persisted root.

Required integration sequence:

```text
canonical Trade staged settlement
→ approved market postconditions
→ ONE authoritative root replacement
→ authoritative-root receipt lookup
→ Ledger catch-up
→ pure Career progression calculation
→ trusted Career state commit
```

UI, AI, command payloads and arbitrary alternate state objects must have no route to make Career count a transaction.

Current-main sync for this repair must retain RC3.2 authority files byte-for-byte and requires new exact-head Verify including RC3.2 Iron/Steel smoke.

UNKNOWN is never PASS. This donor does not authorize B8 or merge.

---


Status vocabulary: **SAT / VIOL / UNKNOWN**.  
**UNKNOWN is never PASS.**

## Scope

RC4 Merchant Career owns only:

- pure Merchant qualification
- canonical profession transition through existing `adoptProfession(...)`
- Merchant profession continuity
- Merchant transaction progression hooks sourced from canonical committed transaction evidence
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

Career does **not** accept caller assertions such as:

```js
{ transactionId, verified:true, committed:true }
```

That shape is not canonical transaction evidence and MUST NOT increment progression.

### Canonical transaction evidence

Career consumes the exact projection vocabulary emitted by RC4 Merchant Ledger PR #179 function
`assessTradeKernelResult()`, which itself consumes the RC4 Trade Kernel committed result from PR #177.

A new committed transaction is eligible only when the projection has:

```js
{
  state: 'SAT',
  duplicate: false,
  verification: 'VERIFIED',
  commitStatus: 'COMMITTED',
  receipt: {
    transactionId,
    fingerprint,
    integrityFingerprint,
    eventId,
    marketId,
    listingId,
    reservationId,
    buyerId,
    sellerId,
    itemKind,
    itemInstanceId,
    itemIds,
    quantity,
    unitPrice,
    totalPrice
  }
}
```

A replay projected by the canonical transaction path is:

```js
{
  state: 'SAT',
  duplicate: true,
  receipt: { ...canonical committed receipt... }
}
```

and MUST be a no-op for Career progression.

Career validates the compatible committed-receipt structure before consuming it, including the Trade Kernel
proposal fingerprint and receipt integrity fingerprint over the exact canonical fields + sorted itemIds.
Career does not create, upgrade or infer transaction truth. In particular it does not turn arbitrary `verified:true` or
`committed:true` booleans into canonical evidence.

### Merchant party lock

Before progression can increase:

```text
agent.id === receipt.buyerId
OR
agent.id === receipt.sellerId
```

If neither is true, the evidence is VIOL and progression state remains unchanged.

### Replay authority

Transaction uniqueness, commit status and duplicate/replay status belong to the Trade Kernel / canonical transaction authority.

Career MUST NOT independently determine transaction uniqueness.

A legacy/recent local transaction-id collection, if present on an older candidate save, is ignored by Career progression.
It is neither validated as progression state nor consulted by `noteVerifiedCommittedMerchantTransaction()` and has zero idempotency authority.

Long-horizon behavior:

```text
>32 canonical unique commits
→ progression counts each canonical new commit once
→ canonical replay of the oldest transaction returns duplicate:true
→ Career progression remains byte-stable
```

The same rule MUST survive save/load.

### Monetary separation

- Career MUST NOT store or accumulate Revenue, COGS or Realized Profit on the agent.
- `merchantRealizedProfit` progression support is satisfied only by a read-only projection of a valid Merchant Ledger snapshot.
- absent ledger evidence makes the projected profit UNKNOWN/null; malformed or mismatched ledger evidence is VIOL.
- a persisted `agent.merchantRealizedProfit` field is explicitly rejected as a duplicate monetary authority.
- authoritative monetary accounting belongs to the RC4 Merchant Ledger workstream.

### Progression mutation

Only canonical `state:'SAT'` + `duplicate:false` + `verification:'VERIFIED'` +
`commitStatus:'COMMITTED'` evidence for which the Merchant is a real party may:

- increment `merchantTransactions` by 1
- increment `merchantExperience` by 1

Canonical `duplicate:true` never increments either field.

## Required tests

- child does not qualify
- dead agent does not qualify
- no home-control evidence does not qualify
- capital below threshold does not qualify
- UNKNOWN qualification evidence does not qualify
- replayed qualification does not duplicate career history
- Merchant profession survives save/load
- Merchant does not overwrite locked Adventurer
- ordinary worker actions do not overwrite Merchant
- automatic Adventurer qualification does not overwrite Merchant
- Merchant module contains no direct profession assignment
- canonical VERIFIED + COMMITTED + duplicate:false Merchant buyer counts once
- canonical VERIFIED + COMMITTED + duplicate:false Merchant seller counts once
- canonical duplicate:true is a no-op
- transaction where Merchant is neither buyer nor seller is VIOL
- missing canonical verification is UNKNOWN / no mutation
- missing canonical commit status is UNKNOWN / no mutation
- malformed canonical receipt is rejected
- tampered Trade Kernel fingerprint/integrity evidence is rejected
- forged plain `transactionId + verified:true + committed:true` object cannot increment progression
- more than 32 canonical unique commits are accepted without using a bounded replay gate
- replay of the first transaction after more than 32 commits is a no-op
- save/load followed by canonical replay of an old transaction is a no-op
- any legacy/recent transaction-id list is ignored by progression and has zero idempotency authority
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

## Known limitations / integration dependencies

1. RC4 does not project runtime home, wallet/capital, or trade-knowledge state into the qualification snapshot. Integration must supply those authoritative facts later.
2. RC4 does not add a command or autonomous policy that triggers Merchant qualification in production.
3. Career depends on the canonical transaction projection contract from PR #179 `assessTradeKernelResult()`, sourced from PR #177 Trade Kernel committed results. Career does not duplicate those authorities.
4. Shared runtime integration must pass that canonical projection into Career; fabricating an equivalent-looking object outside the approved transaction path is an integration violation.
5. Merchant progression fields are non-monetary additive save data and are not yet wired into engine-wide validation because shared runtime integration is outside this slice.
6. Revenue, COGS and Realized Profit are intentionally absent from Career state; Merchant Ledger is the accounting authority.
7. No pricing, market, wallet, inventory transfer or Home Market behavior is implied by Merchant profession SAT.

Long-horizon replay is **not** an accepted limitation. A canonical replay of an old committed transaction MUST never increment Career progression.

## Definition of Done

RC4 Merchant Career is SAT only when:

- exact branch head contains only in-scope changes
- Merchant profession is registered in the existing profession authority
- Merchant adoption uses canonical `adoptProfession`
- qualification tests prove required VIOL/UNKNOWN cases
- qualification replay, >32 transaction replay and save/load old-replay tests pass
- progression only accepts canonical Merchant Ledger transaction projection with VERIFIED + COMMITTED + duplicate:false
- Career contains no monetary profit accumulator
- `merchantRealizedProfit` hook is available from a validated read-only Merchant Ledger projection
- duplicate persisted `merchantRealizedProfit` state is rejected
- Career does not use or validate recent transaction ids as replay/progression authority
- Merchant party lock is proven for buyer/seller/non-party paths
- `npm test` passes on the exact head
- PR is opened and remains unmerged
