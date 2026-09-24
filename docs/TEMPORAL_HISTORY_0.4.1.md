# Temporal History Adapter V0.1

Status: implementation candidate

This slice is the first Project Brain cross-repo reuse proof.

## Source capability

Architecture adapted from TestGE TWA rollback/replay:

```text
checkpoint
→ rollback
→ redo/replay
→ round-trip hash verification
→ bounded audit/history
```

Directly importing TestGE `twa-history.js` is intentionally rejected because that implementation is coupled to TWA TypedArrays and commit deltas.

## Simclone adapter

`src/temporal-history.mjs` uses existing Simclone boundaries instead:

- `serialize(world)`
- `restore(text)`
- `validate(world)`
- deterministic `step(world, count)`
- authoritative `command(world, type, payload)`

It does not change game rules and does not access browser storage.

## Current proof scope

- full-world checkpoint restore
- deterministic autonomous round trip
- manual successful command journal
- replay command ordering by tick + sequence
- bounded checkpoints
- rejected commands are not journaled
- invalid replay target fails closed

## Important boundary

UI/app code is not wired yet. Existing callers that invoke `command()` directly are not automatically captured.

Before a production time-travel UI, the app command bridge must route replay-relevant influence commands through TemporalHistory.

## Save safety

TemporalHistory never writes localStorage. Preview rollback/replay therefore cannot overwrite the user's persistent save by itself.

## Next

1. run exact branch CI
2. if green, wire app command bridge
3. add timeline preview without mutating persistent save
4. add explicit confirm-to-apply
5. browser acceptance for rollback + replay
6. update Project Brain evidence from UNKNOWN to SAT only after exact verified commit
