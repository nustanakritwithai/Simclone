---
type: success-contract
project: Simclone
domain: simulation
feature: IC6C Closeout — Remove Independent Central Stock
status: active
canonical: true
owner: Project Brain
validation: implementation-candidate
last_reviewed: 2026-09-26
---

# IC6C Closeout — Remove Independent Central Stock

## Goal

Independent Clone World must have no spendable central material stock.

`s.stock` remains only as a zero-valued legacy/save compatibility placeholder in Independent saves. It is not a gameplay wallet, UI source, birth source, or economy authority.

## Authority

Independent resource reads/writes must resolve through:

```text
resourceAccount(agent)
  → temporary personal store
  OR
  → household store[houseId]

resourceStock(agent)
  → the one active spendable raw-resource account
```

World totals are derived read-only via `materialTotals()`.

## Legacy compatibility

Legacy mode keeps `s.stock` as its existing spendable inventory authority.

Do not remove or reinterpret legacy save semantics in this gate.

## Required Independent behavior

- selected HUD reads `resourceStock()`;
- unselected/world HUD reads `materialTotals()` only;
- autonomous birth planning/execution does not use `s.stock`;
- day events report aggregate material totals, not placeholder stock;
- survival/craft/process/archive paths continue through resource accounts;
- `s.stock` must remain exactly zero in valid Independent saves;
- changing placeholder stock to non-zero makes the save invalid but must not fund Independent gameplay.

## Acceptance

1. Fresh Independent world has zero placeholder `s.stock` and non-zero real material totals.
2. Independent birth planning is unchanged by arbitrary `freeFood` input / placeholder stock.
3. Independent day event reports aggregate food from personal/household accounts.
4. Selected Household members show the same HUD resource values.
5. Homeless selected Clone shows temporary personal resource values.
6. Independent validator rejects non-zero placeholder stock.
7. Legacy mode still spends and reports `s.stock` exactly as before.
8. Existing household economy, Leadership, WM4.8, save/load and browser regressions stay SAT.

UNKNOWN is never PASS.
