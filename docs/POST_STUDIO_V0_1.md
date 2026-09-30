# Post Studio V0.1 — Evidence-backed media layer

Status: **CANDIDATE / NOT PRODUCTION SAT**

Baseline: `main@9fdf3d9d2b9cfae24b78c880cc8122efbffabcad`

## Goal

Post Studio turns already-published Cultural Archive evidence into deterministic shareable post cards.

```
direct observation
→ personal confirmed knowledge
→ Cultural Archive entry
→ Post Studio
→ immutable post card
```

Post Studio is a presentation/publication layer only.

It does **not** create or modify:
- knowledge or belief truth;
- professions/careers;
- Wallet/currency;
- inventories/materials;
- market/trade state;
- tasks/navigation;
- world resources;
- simulation outcomes.

## V0.1 rules

- Independent world only.
- One Post Studio root per world.
- Hosted at the same completed owned home as the Cultural Archive.
- Only the living studio owner may publish.
- Publisher must be within 4 tiles of the studio home.
- Source must be a current Cultural Archive entry.
- A given `sourceKey + sourceRevision` may be published once.
- A newer Cultural Archive revision may create a new post.
- Posts are immutable snapshots with source evidence IDs.
- Capacity is 24 posts; old posts are never silently deleted.
- Text is deterministic from archived claim data.
- No `Math.random`, wall-clock `Date`, DOM, fetch, or LLM call in domain authority.

## Commands

- `CREATE_POST_STUDIO { agentId, houseId }`
- `PUBLISH_STUDIO_POST { agentId, key }`

## Persistence

The `postStudio` root is persisted by normal world serialization.

Old saves without `postStudio` remain valid.

## Acceptance

Candidate is SAT only after:
- `npm test` passes;
- Post Studio focused tests pass;
- runtime import-map pins match exact blobs;
- no regressions in Independent world, Cultural Archive, RC4 economy, crafting, Adventure;
- browser UI can open a home → Post Studio → publish an archive-backed post;
- save/load preserves published posts.

UNKNOWN is never PASS.
