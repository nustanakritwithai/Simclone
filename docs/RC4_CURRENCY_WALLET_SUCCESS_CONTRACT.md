---
type: success-contract
project: Simclone
domain: economy
feature: RC4 Canonical Currency Wallet
status: candidate
canonical: true
owner: RC4 Canonical Wallet Agent
last_reviewed: 2026-09-28
---

# RC4 Canonical Currency / Wallet Success Contract

## Goal

Provide exactly one deterministic, saveable and auditable money authority for Simclone so later RC4 integration can settle Customer → Merchant and Merchant → Producer trades without inventing merchant/shop/customer/market-specific wallets.

This donor does **not** integrate trade into production runtime.

## Exact starting source

Branch `feature/rc4-canonical-wallet` is cut from:

`main@a3c98ecd4023e0b7e8dbec2a1e2d8970f594d19e`

The pre-code audit covered `AGENTS.md`, `GAME_PLAN.md`, `docs/STATUS.md`, `docs/NEXT_STEPS.md`, PR #174–#180, household economy/trade shadows and repository searches for wallet/currency/money/cash/coin/wealth/balance/payment/trade/debt.

Result:

- no canonical currency/wallet writer exists on the starting main;
- `src/kingdom-household-economy.mjs` is explicitly pure/read-only;
- `src/kingdom-household-trade.mjs` is explicitly a pure shadow with no money mutation;
- PR #177 independently records the same missing-wallet dependency;
- PR #179 owns accounting read models (Revenue / COGS / Realized Profit), not money balances.

Therefore creating a single canonical wallet authority is permitted. If a competing monetary writer appears before integration, this donor must be re-audited and must not be merged blindly.

## Authority boundary

Canonical writer:

`src/currency-wallet.mjs`

Thin compatibility facade only:

`src/trade-wallet-adapter.mjs`

The authority owns balance, account creation, explicit credit/debit, transfer, monetary replay receipts, validation, deterministic bootstrap/migration and wallet serialization shape.

It does not own Listing, Buy Offer, market, Merchant profession/career, pricing, Revenue, COGS, Realized Profit, Rust item ownership, Merchant/Customer AI, UI or production Trade integration.

No `merchantWallet`, `shopWallet`, `customerWallet`, `marketWallet`, `adventureWallet` or household-specific spendable wallet is created.

## State model

```js
currencyWallet: {
  version: 'RC4-wallet-1',
  accounts: [
    { agentId, balance }
  ],
  receipts: [ ... ],
  bootstrap: null | {
    version: 'RC4-wallet-bootstrap-1',
    initialBalance,
    agentIds,
    totalGranted
  }
}
```

Rules:

- `agentId` is the canonical numeric Agent identity; display names are never keys;
- balance is a non-negative safe integer;
- floats, NaN, Infinity, negative balances and silent overflow are invalid;
- duplicate accounts fail closed;
- wallet accounts may remain after death, but a dead Agent cannot initiate a transfer/debit;
- balance is not silently reassigned to another Agent.

## Integer money

V1 uses one integer canonical currency unit. No decimals and no floating money are allowed.

## Normal transfer

Canonical API:

```js
getBalance(state, agentId)
transfer(state, {
  transactionId,
  fromAgentId,
  toAgentId,
  amount,
  evidence
})
```

A transfer validates the complete operation before committing.

Example:

```text
A = 100
B = 20
transfer 30
A = 70
B = 50
```

For every normal transfer:

```text
Σ money before = Σ money after
```

Self-transfer, missing accounts/identities, dead sender, insufficient funds and receiver overflow fail without changing source state.

## Credit / debit boundary

Standalone credit/debit changes total money, therefore it is never the ordinary trade path.

Public `credit()` requires explicit evidence operation `INITIAL_GRANT` or `SYSTEM_MINT`.

Public `debit()` requires `SYSTEM_BURN`.

RC4 V1 adds no autonomous mint/burn policy and exposes no AI/UI path to these operations. Ordinary exchange must use `transfer()` or an approved atomic settlement kernel.

## One-time bootstrap / legacy migration

`migrateLegacyCurrencyWallet(state)` is also the explicit V1 initialization path for a root state that has no wallet yet.

Default V1 seed capital:

```text
100 canonical units per current Agent ID
```

This amount is explicit and provisional for RC4 V1 market testing. It is not hidden production income.

The bootstrap:

- sorts canonical Agent IDs;
- creates one account per Agent;
- grants exactly 100 units by default;
- records bootstrap metadata;
- records an `INITIAL_GRANT` receipt per positive grant;
- uses deterministic IDs `MIGRATE:RC4-wallet-bootstrap-1:<agentId>`;
- never uses Date, random or UUID;
- runs only when `state.currencyWallet` is absent;
- returns duplicate/no-op when the valid wallet already exists;
- fails closed instead of replacing a corrupt/duplicate wallet.

Repeated load/migration therefore cannot grant money twice.

New Agents after integration should receive a zero-balance account through `createCurrencyAccount()` unless a separately approved economic policy authorizes another explicit grant.

## Replay safety

Every authoritative monetary mutation stores a persistent receipt with a stable transaction ID and canonical payload fingerprint.

Rules:

- same transaction ID + same payload → duplicate/no-op;
- same transaction ID + different payload → `transaction-conflict`;
- receipt field tampering invalidates wallet state;
- receipt IDs are never pruned by this authority;
- there is no bounded replay window that makes old IDs spendable again;
- evidence is canonicalized with sorted object keys for deterministic fingerprints.

## Save / load

The wallet is plain JSON-safe state and is designed to live inside the canonical root state.

Required donor proof:

- JSON round trip preserves balances;
- JSON round trip preserves replay receipts;
- duplicate replay after reload is still a no-op;
- legacy migration runs once;
- repeated migration does not change total supply.

This donor intentionally does not wire the component into production engine restore/save. That integration remains the Integration Lead's responsibility after donor acceptance and post-RC3.2 rebase/rebuild.

## Trade Kernel #177 compatibility

PR #177 expects a wallet facade with:

```text
balance(state, agentId)
debit(state, agentId, amount)
credit(state, agentId, amount)
```

`src/trade-wallet-adapter.mjs` exports:

```js
createTradeWalletAdapter({
  transactionId,
  fromAgentId,
  toAgentId,
  amount,
  evidence
})
```

The returned facade matches #177's three method signatures while every actual balance mutation still routes through `currency-wallet.mjs`.

Authority repair rule:

- `debit(state,buyerId,amount)` is validation-only and performs **zero monetary mutation**;
- `credit(state,sellerId,amount)` must match the transaction-bound seller and amount, then commits exactly one canonical `transfer()`;
- the adapter cannot expose a unilateral trade debit or trade credit that destroys or creates currency;
- calling `credit()` without a preceding `debit()` is still safe because it performs the complete conserved transfer, never a mint;
- redirected buyer/seller/amount values fail closed;
- exact replay is handled by the canonical transfer receipt.

This shape matches #177's actual staged call order: validate → debit → credit → item transfer → trade receipt → wallet postconditions. The intermediate debit step leaves balances unchanged; after credit, buyer and seller balances already equal the final conserved result expected by #177.

Final end-to-end Trade Kernel compatibility is still **UNKNOWN** until RC4 Integration Lead combines this donor with the accepted #177 candidate and reruns the integrated atomic settlement proof.

## Determinism

Forbidden in wallet gameplay rules:

- `Math.random()`;
- `Date.now()`;
- `new Date()`;
- wall clock;
- random UUID identity;
- floating monetary values.

Identical inputs and identical transaction IDs must produce byte-identical wallet JSON.

## Adversarial proof

Focused tests cover:

1. deterministic bootstrap;
2. duplicate account rejection;
3. get balance;
4. explicit valid credit;
5. explicit valid debit;
6. overdraw immutable failure;
7. zero invalid;
8. negative invalid;
9. float invalid;
10. NaN invalid;
11. Infinity invalid;
12. overflow invalid;
13. A → B transfer;
14. conservation;
15. self-transfer rejection;
16. missing sender;
17. missing receiver;
18. exact replay no double transfer;
19. same ID/different payload conflict;
20. save/load balance continuity;
21. save/load replay continuity;
22. migration once;
23. repeated migration no new grant;
24. failed operation source immutability;
25. byte-identical deterministic result;
26. multi-Agent 600-unit conservation proof;
27. duplicate-wallet corruption fail-closed;
28. dead-sender lock with estate balance retained;
29. receipt tamper detection;
30. thin #177 adapter routes mutation through canonical transfer;
31. adapter debit alone cannot alter supply or balance;
32. redirected adapter party/amount fails without mutation;
33. adapter credit without prior debit remains conserved and cannot mint;
34. no random/wall-clock source rule.

Red-team fixture:

```text
A = 100
B = 200
C = 300
Total before = 600
multiple transfers
Total after = 600
```

## Repair note — Verify #1948

The first exact-head GitHub Verify (#1948 / run `36441744460`) failed **only** the runtime cache-pin invariant:

```text
currency-wallet.mjs: regenerate source cache pins
expected rev=f46d37f1cf9391fa
candidate rev=0e7a0d899055c8f1
```

The pin was corrected from the exact source SHA-256. During this repair the adapter authority boundary was also tightened so trade debit/credit can no longer change currency supply independently. A new exact-head Verify is required; UNKNOWN is not PASS.

## RC3.2 dependency / merge rule

This is an isolated donor built on pre-RC3.2 main.

Before production integration:

```text
RC3.2 #174
→ merge
→ exact merged SHA Verify
→ Pages
→ public proof
→ Integration Lead rebase/rebuild donor from post-RC3.2 main
```

Do not use this stale pre-RC3.2 donor head directly as a production integration candidate.

Keep the PR Draft. Do not merge from this workstream.

## Acceptance matrix

| Area | Candidate state |
| --- | --- |
| Currency account authority | SAT after focused proof |
| credit | SAT as explicit mint/grant only |
| debit | SAT as explicit burn only |
| transfer | SAT |
| replay | SAT |
| save/load component continuity | SAT |
| migration/bootstrap | SAT |
| conservation | SAT |
| Trade Kernel adapter shape | SAT |
| Trade Kernel end-to-end combined integration | UNKNOWN |
| production engine/save integration | UNKNOWN |
| post-RC3.2 integration candidate | UNKNOWN |

UNKNOWN is not PASS.
