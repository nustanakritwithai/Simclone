# RC4 — Merchant / Customer AI Success Contract

Status: candidate  
Owner: RC4 Merchant / Customer AI workstream  
Base: `main@a3c98ecd4023e0b7e8dbec2a1e2d8970f594d19e`  
Branch: `feature/rc4-merchant-customer-ai`

## Goal

Add deterministic decision policy for two actors only:

1. Customer
2. Merchant

The AI may create **intent / proposal objects only**. It is never a transaction, wallet, item, ledger, housing, market, or profession writer.

## Authority locks

This workstream must not write or create a competing authority for:

- wallet / currency
- Rust possession / item ownership
- transaction state or settlement
- merchant ledger / revenue / COGS / profit
- home / housing ownership
- profession / career
- listing or HomeMarket lifecycle
- path / position

The policy consumes already-authoritative snapshots supplied by the integration layer. Every output carries `authoritative:false`.

No `Math.random()`, `Date.now()`, or wall-clock rule is permitted.

## Customer policy contract

Canonical loop:

```text
Need item
→ find known market
→ evaluate known listing
→ check canonical wallet affordability
→ select market/listing deterministically
→ create travel-goal intent
→ canonical navigation walks
→ verified arrival + verified current position
→ re-check current local market/listing
→ submit purchase intent
→ wait for VERIFIED transaction result
→ propose use / equip / carry follow-up
```

### Knowledge boundary

Customer discovery reads only:

- `knowledge.knownMarkets`
- `knowledge.knownListings`

A leaked `worldMarkets`, `worldListings`, global price table, or other World Truth field is ignored.

Remote knowledge is sufficient to choose a destination, but **never sufficient to buy**. At purchase time the policy additionally requires:

- current `localMarkets` view
- market status `open`
- current active listing
- canonical wallet balance sufficient for current price
- current position within trade range
- `positionEvidence.verified === true`
- `arrivalEvidence.verified === true`
- matching agent/market/coordinates/ticks

A fake arrival record cannot override current coordinates or trade range.

### Deterministic purchase identity

Purchase intent ID is derived only from canonical snapshot data:

```text
buyer + need + listing + quantity + listing snapshot token
```

Same snapshot → same ID and same decision.

If the same intent already exists in the supplied intent journal, policy returns a wait intent instead of a second purchase proposal. Final idempotency/commit remains the RC4 Trade Kernel's responsibility.

### Post-purchase gate

Use/equip/carry intent is emitted only when the supplied transaction result is:

```text
verificationStatus/status = VERIFIED
outcome/result = COMMITTED
```

Pending / UNKNOWN never advances the loop.

## Merchant policy contract

Canonical loop:

```text
Inspect canonical Rust-owned stock
→ observe allowed demand evidence
→ detect shortage
→ create bounded restock intent
→ obtain stock through verified trade
→ wait for canonical Rust materialization
→ physically return stock home
→ propose listing
→ request/open HomeMarket
→ observe own VERIFIED sales
→ next bounded restock cycle
```

### Stock truth

Merchant stock is a **projection of canonical Rust possessions** supplied by the caller. There is no `merchantInventory` or second item ledger.

A listing proposal can reference only an item instance currently owned by that merchant in the canonical Rust bag snapshot. Missing item → no listing proposal.

### Knowledge lock

Merchant policy may use only:

- own verified transaction history
- markets/listings the merchant has observed
- nearby/local demand observations
- own supplied memory/knowledge fields

Global market tables and global price oracles are ignored.

Listing policy does **not** calculate authoritative price. It emits a `pricingRequest` containing only allowed evidence IDs for the RC4 Pricing / Merchant Ledger authority.

### Bounded restock / replay rule

Each demand evidence row defines one deterministic restock cycle key:

```text
merchant + item kind + demand evidence id
```

V1 requests at most one item per cycle. Replaying the same snapshot reproduces the same intent ID. Once a `SUBMIT_PURCHASE` for that cycle appears in the intent journal, the policy waits rather than creating another purchase. A new verified sale or local-demand observation may create a new evidence ID and therefore a new bounded cycle.

A VERIFIED committed restock is not treated as stock until the item instance appears in canonical Rust possession. This prevents the AI from inventing merchandise from transaction text alone.

### Physical return rule

A restocked or existing sellable item must be physically within the merchant's home/storefront range before `PROPOSE_LISTING` can be emitted. Otherwise the policy emits a path-required, `teleport:false` return-home travel goal.

## V1 outputs

Customer policy can emit:

- `CREATE_TRAVEL_GOAL`
- `WAIT_TRAVEL`
- `SUBMIT_PURCHASE`
- `WAIT_TRANSACTION_RESULT`
- `USE_PURCHASED_ITEM`
- `EQUIP_PURCHASED_ITEM`
- `CARRY_PURCHASED_ITEM`
- `WAIT`

Merchant policy can emit:

- restock variants of customer travel/purchase/wait intents
- `CREATE_TRAVEL_GOAL` for return stock home
- `WAIT_TRANSACTION_MATERIALIZATION`
- `WAIT_RESTOCK`
- `REQUEST_HOME_MARKET`
- `PROPOSE_LISTING`
- `OPEN_MARKET`
- `WAIT`

All are proposals only.

## Explicit V1 exclusions

Not implemented here:

- bargaining
- global exchange
- caravan
- futures
- intercity logistics
- macroeconomic prediction
- price authority
- transaction commit/settlement
- market/listing persistence
- profession adoption
- wallet/item/ledger mutation

## Acceptance matrix

| Gate | Expected | Candidate evidence | Result |
|---|---|---|---|
| no customer need → no buy | no purchase/travel | focused test | SAT |
| insufficient money → no valid purchase | no purchase/travel | focused test | SAT |
| unknown market is not learned from global truth | no decision from leaked globals | focused test | SAT |
| closed market → no buy | no purchase | focused test | SAT |
| remote customer must walk | travel goal, `pathRequired:true`, `teleport:false` | focused test | SAT |
| verified position + arrival required | proximity alone/fake arrival cannot buy | focused tests | SAT |
| merchant cannot sell missing item | listing only references canonical Rust-owned item | focused test | SAT |
| merchant restock is bounded | one-item evidence cycle + journal suppression | focused test | SAT |
| dead agent cannot trade | no customer/merchant decision | focused tests | SAT |
| same snapshot → same decision | deep-equal output | focused tests | SAT |
| replay intent does not create a fresh trade | stable ID + journal wait | focused tests | SAT |
| verified result required before post-purchase | pending waits; VERIFIED COMMITTED advances | focused test | SAT |
| merchant cannot use global prices | only allowed evidence forwarded | focused tests | SAT |
| restock result cannot invent stock | wait until Rust item materializes | focused test | SAT |
| stock returns home before listing | physical return travel first | focused test | SAT |
| `Math.random()` / wall clock absent | source grep | focused static check | SAT |
| full repository regression | `npm test` on GitHub candidate | not yet observed at document authoring | UNKNOWN |
| RC4 Trade Kernel integration | exact shared vocabulary + commit idempotency | parallel branch not yet implemented at base pin | UNKNOWN |
| RC4 HomeMarket integration | open/listing intents wired to canonical market authority | parallel authority not yet implemented at base pin | UNKNOWN |
| RC4 Pricing/Ledger integration | pricingRequest consumed by pricing authority | parallel authority not yet implemented at base pin | UNKNOWN |
| RC4 Merchant Career integration | profession authority supplies `merchant` | parallel authority not yet implemented at base pin | UNKNOWN |

UNKNOWN is not PASS. No merge is authorized by this candidate document.

## Focused verification

Command used against the candidate files:

```text
node --test tests/rc4-merchant-customer-ai.test.mjs
```

Candidate result before GitHub push: **25/25 PASS**.
