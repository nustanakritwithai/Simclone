# Current handoff — post Governor v1 closeout

Released baseline:

`main@3ab58da6289a28dbdde3656ce5d8285f1656ad8f`

Pages #79 = SUCCESS on the exact same SHA.

Governor v1 GOV0–GOV6 is closed and released. Do not reopen it during ordinary cleanup unless a regression is proven.

## Work currently in flight

Two independent agent workstreams are open:

1. PR #123 — `feat(khet): add separated adventurer rules`
2. PR #124 — `VAL4: add deterministic productive outcome verification shadow`

Before any new feature work:
- re-read current `main`
- inspect those PRs and their changed files
- do not overwrite their branches
- do not copy their authority into a parallel implementation

## Next product gates after active PRs settle

Re-audit the current main before choosing the next gate.

Candidate directions:

- Governance v2: council / collective decisions / later government forms
- Physical household trade rebuilt from current released main
- logistics and physical delivery
- property / inheritance v2
- richer settlement governance evidence

Do not start tax, treasury, elections, diplomacy or war until their underlying economy / organization authorities are ready.

## CI discipline

Routine PR gate:
- `npm test`
- active UI smoke
- Independent desktop smoke

Pages gate:
- active regressions
- native desktop release smoke
- deploy
- exact public bytes

Manual Full Regression:
- 120-year continuity
- full browser matrices
- archived heavy proofs

This split is deliberate: heavy proof remains available without blocking every PR.

## Stale/reference PR warning

Older non-current PRs must not be merged as-is merely because they remain open.

Notably:
- #102 physical household trade is based on an obsolete IC7A branch; rebuild on current main if resumed.
- #84 UX V1.0 is stale against the current UI line.
- #74 housing fix and #73 BM1 predate later world/social/governance releases; re-audit before reuse.

Draft/reference branches are evidence/history, not current source of truth.
