# Temporal Command Bridge — stacked proof

This slice wires the existing Simclone app to the TemporalHistory adapter without exposing time-travel UI yet.

## Contract

Authoritative browser-session mutation paths now go through:

```text
UI / app action
→ executeWorldCommand()
→ TemporalHistory.executeCommand()
→ engine.command()
→ journal successful command
```

Autonomous simulation ticks now go through:

```text
frame()
→ advanceWorld()
→ TemporalHistory.advance()
→ engine.step()
```

Preview validation remains intentionally outside the journal because it mutates only a throwaway serialized copy.

## Session reset boundaries

A new temporal session is created when:
- the app boots from current loaded/new world
- user resets to a new world
- user imports a world

This prevents command history from one world being replayed into another.

## Persistence boundary

The bridge still does not write rollback/replay state into localStorage. Existing `save()` behavior remains the only persistent-save path.

## Not included yet

- timeline UI
- user-triggered rollback
- apply/confirm restored world
- checkpoint scheduling policy beyond session start
- cross-session persisted temporal history

Those remain blocked until this stacked branch and its parent adapter branch pass exact CI.


## Verification state

Candidate branch: `codex/temporal-command-bridge-v041-20260924`

This combined candidate targets `main` for exact GitHub Actions verification. Until that workflow succeeds, release verdict remains **UNKNOWN** even if local/static contract tests look correct.
