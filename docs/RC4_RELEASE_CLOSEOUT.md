# RC4 Merchant Economy — Production Closeout

Date: 2026-09-29

## Final production identity

- Repository: `nustanakritwithai/Simclone`
- Integration PR: #194 — merged
- Accepted candidate head: `582cc72668071e4c3e1f55fd43c143841a3bbaad`
- Production main: `1ff2907c4e69af8adc336792105894542576433b`
- Production tree: `82046c2deb47a218f85554b5a9d65864789899ea`
- Previous production baseline: `1b60b13394c11bd7b03d10227919f4bb509b02df`

## Production gates

- Exact-main Verify #2160 / run `36500493072`: SUCCESS
- GitHub Pages #113 / run `36500493069`: SUCCESS
- Production unit/persistence suite: PASS
- RC4 native Chromium desktop + mobile: PASS
- Active Observation UI: PASS
- Autonomous Adventure: PASS
- Independent desktop: PASS
- RC2 native crafting: PASS
- RC3.1 Blueprint: PASS
- RC3.2 Iron/Steel: PASS

Candidate evidence was not reused as production evidence; mandatory gates were rerun on exact merged-main.

## Released gameplay

```text
Producer A
→ canonical Rust item
→ Merchant B Home Market
→ BuyOffer / procurement
→ physical navigation
→ atomic Trade
→ Merchant resale Listing
→ Customer C physical navigation
→ atomic purchase
→ Wallet + item + Reservation + Listing + Ledger + Career commit
```

The accounting proof retains the same physical item identity through procurement and resale and verifies:

- acquisition cost = 70
- sale revenue = 100
- COGS = 70
- realized profit = 30
- replay-safe Career progression
- save/load continuity

## Authority locks retained

- housing/home truth remains existing Housing / Individual Housing
- item ownership remains Rust possessions
- money remains canonical Currency Wallet
- Reservation has one canonical authority
- settlement/replay remain Trade Kernel-owned
- Merchant accounting remains Merchant Ledger-owned
- profession transition remains canonical profession authority
- arrival proof remains Navigation-owned and non-forgeable from caller objects
- UI remains state-reader + validated-command dispatcher

No donor PR may be merged after this release merely because it contains an earlier isolated implementation. The production implementation in #194 is the canonical RC4 source.

## Superseded RC4 work

The isolated RC4 donor / blocker / prototype / acceptance PRs are closed as historical after production release. They remain useful as audit history only.

PR #195 is RC5 work and is not part of this closeout.

## Final verdict

`RC4 Merchant Economy = RELEASED / PRODUCTION SAT`

Future work starts from production main `1ff2907c4e69af8adc336792105894542576433b` or a later verified main. Do not restart RC4 from an old donor SHA.
