# Next build gates — Knowledge + Memory 0.5.0 candidate

These are implementation gates, not proof by themselves. Exact candidate and exact main workflows remain authoritative.

## Completed foundations

- V0.3.5 Death History + Migration — immutable death evidence and honest legacy UNKNOWN handling
- V0.3.6 Historical Identity — bounded retained ancestry separated from the living work set
- V0.4.0 Skill Provenance — initial/inherited/earned/legacy-unattributed XP with bounded evidence

## V0.5.0 — First personal Knowledge + Memory slice

Current candidate under [KNOWLEDGE_MEMORY_0.5.0.md](KNOWLEDGE_MEMORY_0.5.0.md).

Implemented scope:

- productive FORAGE / WOODCUT / MINE outcome creates direct resource evidence
- direct resource belief is CONFIRMED
- explicit engine-mediated share transfers only one selected claim
- recipient stores the claim as UNVERIFIED with sourceAgentId + originEvidenceId
- unrelated world nodes do not appear in recipient knowledge
- knowledge state is bounded and retained through historical archive/save-load
- 0.4.0 migration creates empty knowledge rather than invented historical discovery
- Inspector explains direct versus relayed knowledge

Release is still gated on exact candidate/main verification.

## V0.5.1 — Verification and belief revision

Add direct re-observation of relayed claims:

```text
UNVERIFIED message claim
→ recipient reaches/experiences target
→ CONFIRMED if supported
→ STALE or REFUTED if contradicted under the defined evidence rule
```

Do not infer dishonesty merely from an outdated resource claim. Time/change and false claims must remain distinguishable.

## V0.5.2 — Local knowledge affects planning

Replace remaining hidden-global resource choice with a staged boundary:

- known/observed resource candidates first
- exploration when personal knowledge is insufficient
- direct world validation still occurs at execution
- no planner access to arbitrary resource nodes solely because they exist in authoritative state

Definition of done: two agents with different experience can choose different plans under the same world truth for explainable reasons.

## V0.6 — Multi-step goals / learning

Borrow AstraLife's structured plan idea after the knowledge boundary is stable:

- goal
- ordered steps
- prerequisites
- interrupt conditions
- outcome verification
- bounded lessons

No LLM is required for the deterministic first implementation.

## Later society imports

Only after personal knowledge and cooperation contracts are proven:

- Kingdom Sandbox: occupation, scarcity/economy, governance, faction/rebellion
- Pirate Fruit Living Economy: adaptive production/trader memory/reputation patterns
- TestGE: proposal → verify → atomic commit → delta/replay hardening
- PocketMonster/MonsterLifeServer: shared identity/materialization/server-authority patterns where relevant

Do not copy whole donor repos into Simclone. Move contracts and verified behavior in vertical slices.
