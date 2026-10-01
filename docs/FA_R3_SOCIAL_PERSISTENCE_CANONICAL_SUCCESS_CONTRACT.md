# FA-R3 — Social Persistence Canonical Confirmation

Base: `main@0f14e68aa0ab425a84e4bb4d5e65497085effdd3`

Status at creation: **UNKNOWN ≠ PASS**

## Research finding carried forward from TestGE

TestGE FA-R3 showed a grouping/persistence advantage over No-Social, but no robust
Resource→Production functional advantage for B238/S234 or B38/S123 over their own
persistence-matched controls.

Therefore this Simclone slice does **not** promote a Life-like rule. It tests the
simpler hypothesis:

> A deterministic persistence-based social candidate layer can help partner
> discovery while all real economic/material/crafting writes remain owned by
> current Simclone authorities.

## Scope

Research-only, read-only social projection:
- deterministic social groups from agent ids + seed + tick
- bounded cohort turnover
- same-group-first candidate ordering
- no profession/House feedback into group evolution
- no engine integration yet

Canonical confirmation path:

```text
Persistent Social Candidate
→ Raw Producer read-only decision
→ RC4_ACCEPT_BUY_OFFER
→ canonical Producer → Merchant bulk settlement
→ Merchant bulk Listing
→ Crafter material procurement decision
→ RC4_BUY_LISTING
→ demand-driven Crafter intent
→ CRAFT_ITEM
→ physical crafted item
```

## Authority lock

Social Persistence owns only:
- group projection
- candidate ordering
- retention metrics

It must not write:
- profession / Career
- task / movement
- resources
- Rust possessions
- BuyOffers / Listings
- reservations
- Wallet / Ledger
- craft orders or outputs

Canonical systems remain authoritative:
- Raw Producer policy validates surplus and observed demand
- RC4 market/navigation validates arrival
- Trade Kernel settles resource and money
- Wallet/Ledger record value movement
- Crafter procurement validates current observed listing/material need
- Rust Craft authority consumes material and creates physical output

## Acceptance

### Engineering
- deterministic same input → identical group projection
- one-quarter cohort turnover per epoch under the research configuration
- projection is frozen/read-only
- no forbidden authority imports or mutation tokens
- no `Math.random`, Date, DOM or network simulation rule

### Canonical chain
- social projection and supplier scanning do not mutate world state
- chosen supplier must independently return canonical `ACCEPT_BUY_OFFER`
- Producer→Merchant bulk trade produces a real receipt and exact resource transfer
- total currency conserved
- Merchant→Crafter purchase produces a second real receipt
- Crafter demand becomes `READY_CRAFT`
- `CRAFT_ITEM` creates a real physical `STONE_PICKAXE`
- final world validates
- save/load is byte-stable

### Safety
- no direct resource injection after the canonical chain starts
- no direct wallet/inventory mutation by the social module
- no teleport owned by the social module
- no duplicate economic authority
- no engine runtime integration in this slice

## Interpretation

Passing this slice proves only:

**CANONICAL SEAM SAT** — a persistence-based social candidate can feed existing
read-only decisions and canonical commands without bypassing Simclone authorities.

It does **not** prove:
- autonomous runtime utility
- production gameplay improvement
- five-house full-system utility
- that persistence grouping should ship
- that any Life-like rule should ship

Those remain **UNKNOWN** until a separately integrated autonomous candidate is
tested against No-Social and matched controls on current Simclone.
