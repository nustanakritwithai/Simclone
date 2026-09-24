# Simclone — Knowledge + Memory 0.5.0 candidate

Engine/UI and save schema target 0.5.0 on top of the verified Skill Provenance 0.4.0 main release. The browser storage key remains `simclone:world:v1`; historical identity/archive and skill provenance remain bounded and deterministic.

## Implemented

The first personal-knowledge vertical slice adopts AstraLife's evidence/provenance boundary without importing its provider/LLM runtime.

```text
productive resource outcome
→ direct evidence
→ CONFIRMED personal belief
→ bounded personal episode
→ explicit SHARE_KNOWLEDGE
→ recipient UNVERIFIED belief with source provenance
```

FORAGE, WOODCUT and MINE create knowledge only after the existing engine produced non-zero output. Zero-output work creates neither XP nor knowledge.

Knowledge is personal. A person does not receive all resource nodes because the engine can see them. The first supported claim is `resource:<nodeId>` with resource type and observed coordinates.

The inspector now exposes a Knowledge tab. Direct claims show as confirmed from personal experience; relayed claims show as unverified and identify the source person. A confirmed living person can share one selected claim through an engine command; the engine validates sender, recipient and communication range and chooses the nearest valid recipient when the UI does not name one.

Each retained identity owns small bounded collections: 4 beliefs, 8 evidence records and 8 knowledge episodes. Existing historical archive compaction preserves this state because it retains the person record while omitting only transient decision trace data.

Save 0.4.0 migration adds an empty knowledge state. It does not infer old discoveries from skill XP, location, memory text or global world state. Older supported migrations run lifecycle/history/archive/skill provenance first and then add empty knowledge.

Contract: [KNOWLEDGE_MEMORY_0.5.0.md](KNOWLEDGE_MEMORY_0.5.0.md).

## Donor architecture

Source concepts were studied from AstraLife:

- cognition consumes observation / owned memory-belief / delivered messages
- belief is not world truth
- direct experience can confirm a claim
- relayed knowledge must carry source and origin evidence
- persistent memory/evidence must be bounded

Not imported in this slice: Astra provider calls, trust/reputation scoring, autonomous messaging, multi-step planning or LLM thought generation.

## Verification limits

Exact candidate and exact main workflows remain release authority. Do not treat this file as proof that 0.5.0 is deployed until those runs are green.

This first slice stores knowledge and transfer provenance but does not yet make job planning consume relayed knowledge. Belief aging/stale/refuted transitions, trust, mentor teaching and cultural archive are follow-up work.

Native public-browser behavior and physical Android performance remain separate claims.

## Next

After exact 0.5.0 release gates pass:

1. direct re-observation of a relayed claim confirms/corrects it
2. add stale/refuted lifecycle for claims
3. allow deterministic planning to consult only owned active knowledge rather than hidden global truth
4. add automatic/intentional agent communication only after the boundary is proven
5. then build the cross-generation cultural archive slice

See [NEXT_STEPS.md](NEXT_STEPS.md).
