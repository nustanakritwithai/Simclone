# V0.5.0 — First Knowledge + Memory Vertical Slice

Status: implementation contract. This document is not release proof.

## Donor architecture

This milestone adopts selected contracts from AstraLife, not its runtime wholesale.

Transferred principles:

```text
Agent cognition
= direct observation / experienced outcome
+ owned memory/belief
+ explicitly delivered messages
```

World truth remains authoritative in Simclone. The fact that the engine can see all resource nodes does not mean every person knows them.

AstraLife provider/LLM scheduling, trust scoring, remote model calls and free-form planning are explicitly out of scope.

## Scope

Keep existing Survival, Lifecycle, Historical Identity and Skill Provenance behavior unchanged.

The first knowledge domain is intentionally narrow:

```text
productive FORAGE / WOODCUT / MINE outcome
→ direct resource evidence
→ confirmed personal belief
→ bounded memory episode
→ explicit SHARE_KNOWLEDGE command
→ recipient gets unverified belief with source provenance
```

No automatic teaching, mentor role, faction knowledge or cultural archive is part of this slice.

Runtime target:

```text
Engine/UI: 0.5.0
Save schema: 0.5.0
Knowledge schema: 0.5.0
Storage key: simclone:world:v1
```

## Knowledge state

Each retained person owns a bounded state:

```js
knowledgeState: {
  version: "0.5.0",
  evidence: [...],
  beliefs: [...],
  episodes: [...]
}
```

Limits are small from the first release because this state survives historical archive compaction.

### Evidence

Direct productive work may create/update evidence for the exact resource node that produced output:

```js
{
  evidenceId,
  type: "observation" | "message",
  ownerAgentId,
  sourceAgentId,
  tick,
  key,
  originEvidenceId
}
```

### Belief

A resource claim contains only what the person actually learned:

```js
{
  beliefId,
  key: "resource:<id>",
  value: {resourceId, type, x, y},
  status: "CONFIRMED" | "UNVERIFIED" | "STALE" | "REFUTED",
  confidence,
  sourceKind: "direct" | "message",
  sourceAgentId,
  originEvidenceId,
  evidenceIds,
  observedTick,
  receivedTick
}
```

Direct productive outcome creates a CONFIRMED belief. A delivered message creates an UNVERIFIED belief. This slice does not promote a relayed claim to CONFIRMED without direct evidence.

### Episode

A bounded episode records the event from that person's perspective:

```js
{
  episodeId,
  tick,
  kind: "discovery" | "knowledge-share",
  event,
  perceivedOutcome,
  evidenceIds,
  sourceAgentId
}
```

Repeated work on the same node updates the existing direct claim instead of appending unbounded duplicate beliefs.

## Explicit transfer

`SHARE_KNOWLEDGE` is an engine command.

Preconditions:

- sender is alive
- recipient is alive and not the sender
- sender owns an active CONFIRMED resource belief
- recipient is within the deterministic communication range
- no resources are charged by preview/failed share

The engine copies only the selected claim. It must not copy the sender's whole knowledge state or reveal unrelated world nodes.

The recipient stores:

- sourceAgentId = sender
- sourceKind = message
- status = UNVERIFIED
- originEvidenceId inherited from the original observation
- a new local message evidence ID and memory episode

## Historical continuity

Knowledge state is part of retained identity. Existing archive compaction must preserve it.

If a discoverer dies and later becomes archived, a recipient's sourceAgentId must still resolve through `findPerson()`.

## Migration

### From save 0.4.0

Add an empty `knowledgeState` to every active and archived person. Do not infer old knowledge from current position, skill XP, memory text or global resource state.

### From older supported saves

Run existing lifecycle/history/archive/skill-provenance migrations first, then add empty knowledge state.

This intentionally leaves historical knowledge UNKNOWN rather than fabricating discoveries.

## Definition of Done

1. Productive FORAGE/WOODCUT/MINE output creates one evidence-backed CONFIRMED resource belief for that exact node.
2. Zero-output work creates no knowledge evidence, belief or episode.
3. A second person does not gain that resource claim until an explicit engine transfer occurs.
4. SHARE_KNOWLEDGE transfers only the selected claim and records sender/origin provenance.
5. Recipient belief is UNVERIFIED, not CONFIRMED.
6. Unrelated resource nodes remain unknown to the recipient.
7. Discoverer can die/archive while recipient knowledge and source resolution survive.
8. Save/load continuation preserves deterministic knowledge state.
9. Save 0.4.0 migration creates empty knowledge without reverse-engineering history.
10. Inspector can explain direct vs relayed knowledge and evidence source.
11. Collections are bounded and archive/save guards remain active.
12. Existing Survival/Birth/Death/Continuity/History/Skill Provenance and browser gates remain green.

## Verification

```text
npm test
npm run test:survival
npm run test:lifecycle
npm run test:death
npm run test:continuity
npm run test:history
python tests/ui-smoke.py
python tests/navigation-smoke.py
python tests/survival-smoke.py
```
