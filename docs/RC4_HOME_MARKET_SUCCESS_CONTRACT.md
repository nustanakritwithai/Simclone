# RC4 — Home Market Success Contract

## Source and branch

- Repository: `nustanakritwithai/Simclone`
- Exact starting `main`: `a3c98ecd4023e0b7e8dbec2a1e2d8970f594d19e`
- Branch: `feature/rc4-home-market`
- Workstream: Home Market component only
- Verification rule: `SAT / VIOL / UNKNOWN`; **UNKNOWN is never PASS**.

This candidate must not be merged by the Home Market workstream. A later integration/release gate decides whether and how the component is wired into runtime persistence, Merchant behavior, trade, and UI.

## Success contract

A Merchant market is a component attached to an already-existing personal modular home:

```text
Existing Home
+ HomeMarket component
```

The market is **not** a new building and is **not** a housing authority. The existing home remains defined by `src/housing.mjs`; ownership remains evidence-derived by `src/individual-housing.mjs` from the founding foundation provenance.

Canonical component record:

```js
{
  marketId,
  homeId,
  ownerAgentId,
  status,              // closed | open | invalid | archived
  listingIds,          // references only
  buyOfferIds,         // references only
  storefrontSocket,    // existing physical doorway edge + facing
  reputation,
  invalidReason?       // reconciliation evidence only
}
```

`storefrontSocket` is projected from the existing house's single physical `WOOD_DOORWAY`. It retains the canonical Rust edge socket (`N`/`W`) and adds the doorway's outward `facing` as seen from that house component. It creates no station, wall, doorway, Shelter, orientation writer, or building record.

## Authority locks

The Home Market module may read but must not replace these authorities:

- House completeness and housing capacity → `src/housing.mjs`
- Home ownership / home identity → `src/individual-housing.mjs`
- Doorway edge/socket topology → `src/rust-stations.mjs`
- Physical item ownership / transfer → existing Rust possession authority, untouched
- Wallet / currency → untouched
- Trade validation / settlement → untouched
- Profession writer → untouched
- Merchant AI / Customer AI → untouched
- Production UI → untouched

Home Market owns only market identity, market lifecycle, reference lists, storefront projection, reputation field, and reconciliation status. The schema rejects extra authority fields such as embedded `wallet` or `items`.

## Invariants

1. One home has at most one **active** market. `closed` and `open` are active records; `invalid` and `archived` are inactive.
2. Creation requires a living owner and the owner's canonical completed home from the existing home authority.
3. `createHomeMarket` is idempotent. Repeating the same create request returns the same market and does not create a duplicate.
4. Creation starts `closed`; lifecycle is `create → closed → open → closed → archive → remove`.
5. An `open` market must be closed before archive.
6. A market never changes `buildings`, Rust station pieces, housing capacity, wallets, or item locations.
7. `listingIds` and `buyOfferIds` are references only. Closing, invalidation, and reconciliation do not delete referenced trade/item state.
8. If the home becomes incomplete/missing, the market reconciles to `invalid: home-invalid`.
9. If founding ownership changes, the old market reconciles to `invalid: ownership-changed`; the new owner may create their own market on the same home without producing two active markets.
10. If the owner is dead, the market reconciles to `invalid: owner-dead`; a dead owner cannot create/open a market.
11. Storefront identity is derived from the existing doorway and home geometry. A missing/ambiguous physical doorway fails closed.
12. Missing Home Market state from an old save normalizes to `{version:'RC4-HM-0.1', markets:[]}` without crashing.
13. Same Home Market state JSON round-trips deterministically.
14. No `Math.random`, wall-clock time, DOM, network, second inventory, second wallet, or hidden housing-capacity rule is introduced.

## Required proof matrix

| Requirement | Proof | Candidate status |
| --- | --- | --- |
| Owner can create/open market on own existing home | `tests/rc4-home-market.test.mjs` | UNKNOWN until exact-head test execution |
| Other person's home rejected | focused test | UNKNOWN until exact-head test execution |
| Dead owner rejected / existing shop invalidated | focused test | UNKNOWN until exact-head test execution |
| Duplicate create idempotent | focused test + active-per-home validator | UNKNOWN until exact-head test execution |
| Close preserves listing/buy-offer refs and physical items | focused test | UNKNOWN until exact-head test execution |
| Invalid home → invalid market | focused test using real `evaluateModularHouses`/`homeOf` chain | UNKNOWN until exact-head test execution |
| Ownership change reconciles | focused test using founding `placedBy` provenance | UNKNOWN until exact-head test execution |
| Storefront follows physical doorway/orientation | focused exact socket/facing assertion | UNKNOWN until exact-head test execution |
| Housing capacity unchanged / no market building | focused test + module boundary | UNKNOWN until exact-head test execution |
| Save/load deterministic at component boundary | JSON round-trip focused test | UNKNOWN until exact-head test execution |
| Old save with no Home Market does not crash component | normalization/reconcile focused test | UNKNOWN until exact-head test execution |
| Wallet/trade/item/profession/AI/UI boundaries preserved | schema + changed-file audit | UNKNOWN until final diff audit |
| Repo-wide regression | `npm test` on exact head | UNKNOWN until GitHub Actions |

## Persistence boundary

This PR deliberately does **not** edit `src/engine.mjs` or production UI. The pure component provides deterministic `normalizeHomeMarketState`, lifecycle transitions, validation, and world reconciliation so a later integration can persist the component without inventing a second housing/trade authority.

Therefore:

- component-level old-save/default and JSON determinism are required here;
- production engine save wiring is **UNKNOWN / out of this isolated workstream**, not silently counted as PASS.

## Explicitly out of scope

- Wallet or currency changes
- Trade proposal/validation/settlement
- Listing item reservation or item transfer
- Merchant inventory / market inventory / shop wallet
- Merchant profession qualification/writer
- Merchant autonomous behavior
- Customer autonomous behavior
- Production UI
- New market building
- New Shelter or legacy Shelter creation
- Housing-capacity changes
- Integration/merge/release

## Acceptance

The Home Market workstream may report candidate SAT only for evidence actually executed against the exact candidate SHA. Any unexecuted integration, persistence, browser, or release behavior remains **UNKNOWN**. The PR remains unmerged.


## Master Gate closure repair — B1 / B2

This branch now owns the missing pre-integration contracts without wiring shared runtime.

### B1 — Home Market reference authority

Canonical owner-controlled APIs are:

- `attachHomeMarketListingReference`
- `detachHomeMarketListingReference`
- `attachHomeMarketBuyOfferReference`
- `detachHomeMarketBuyOfferReference`

They reconcile current Home/owner truth before mutation, reject dead/invalid/archived/wrong-owner markets, mutate references only, and make duplicate attach plus missing detach replay-idempotent. Integration/UI/AI must not push/splice `listingIds` or `buyOfferIds` directly.

### B2 — Home Market -> Trade Market projection

`projectHomeMarketForTrade()` is the canonical projection source:

```js
{ id, open, x, y, tradeRange }
```

- `id` = Home Market `marketId`.
- `open` = exact Home Market lifecycle state.
- `x/y` = physical doorway storefront trade cell derived from the canonical Rust doorway socket/facing.
- `tradeRange` = `HOME_MARKET_TRADE_RANGE`, owned by Home Market policy, currently one tile at/adjacent to the storefront.
- UI coordinates and integration defaults are not inputs.
- invalid/archived/missing physical storefront fails closed.
- closed markets project `open:false` so Trade Kernel rejects them without inventing a second lifecycle authority.

Focused tests prove duplicate attach/detach replay, owner/lifecycle locks, reference save/load continuity, deterministic projection, physical x/y provenance, positive safe-integer range and UI-coordinate non-authority.

Exact-head repo Verify is still required before this repair can be called donor SAT. UNKNOWN is never PASS.
