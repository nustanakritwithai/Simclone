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


## Kingdom Sandbox utility import — K1 candidate

The first Kingdom Sandbox extraction is intentionally narrow. It does **not** copy the donor simulator or enable its economy, migration, bandits, military, governance or factions.

Imported behavior:

- productive work computes a **shadow** scarcity premium derived from Simclone stock targets;
- the donor's +8 profession-continuity bonus is preserved in the shadow utility model;
- the donor's small random utility variation is replaced by deterministic seed/agent/tick jitter in the same -4..4 range;
- living agents now carry a current worker profession and a bounded eight-entry career tail based on the authoritative task they actually win;
- Kingdom K1 does **not** override Simclone's existing task ranking yet; this preserves the historical continuity baseline while collecting explainable evidence for a later authority switch;
- Decision Trace exposes scarcity, profession and deterministic-jitter shadow factors separately from the authoritative score.

Authority remains with Simclone: existing task ranking, task eligibility, path reachability, reservations, lifecycle, stock mutation, skill provenance and personal knowledge are unchanged owners of their rules. This shadow-first boundary is intentional after an authoritative K1 attempt changed the 0.3.5 pre-archive continuity baseline; the gate was kept intact rather than rewritten. Existing 0.5.0 saves may omit profession/career; those fields are optional and are initialized deterministically when the agent next plans. Save version therefore remains 0.5.0 for this K1 candidate.

Verification is provided by `tests/kingdom-utility.test.mjs` plus the existing full regression suite. This is occupation/scarcity utility only, not the later Kingdom economy/faction/governance import.


## Kingdom Sandbox economy import — K2 shadow candidate

K2 extracts the donor settlement-economy signals without giving them simulation authority yet.

Implemented as a read-only projection:

- Kingdom village demand adapted to Simclone goods: food, wood and stone (donor ore);
- scarcity ratio with the donor 0.25–6 bounds;
- labor premium target with the donor 1.0–1.8 bounds;
- current worker specialization counts/shares and missing high-pressure roles;
- unfinished construction produces a builder pressure signal;
- the Survival dialog exposes these values as `Kingdom K2 · shadow economy`.

K2 does **not** add money, prices, treasury, wages, trade, caravans, decay, tax, factions or migration. Calling the projection is required to be read-only and must not affect seed/replay/continuity. Authority remains with existing Simclone survival scoring while K1/K2 shadow evidence is verified.


## Kingdom Sandbox production/labor import — K3 shadow candidate

K3 extracts the donor `WorkSystem` productivity structure while preserving Simclone authority.

Read-only factors:

- skill multiplier: `1 + skillLevel × 0.15`;
- satiety-derived hunger penalty: 1.0 / 0.8 / 0.5 using donor thresholds;
- occupation crowding using donor ideal staffing and 0.2–1.0 bounds;
- biological work-rate multiplier from Simclone lifecycle (adult 1.0, elder 0.75, child 0);
- tool multiplier is explicitly fixed at 1.0 until possessions/tools are integrated;
- effective worker units, average profession efficiency, labor gaps and a recommended high-pressure role.

K3 does not change harvested amount, build progress, XP, stock, reservations or task ranking. The projection is surfaced in the Survival dialog and must remain observationally pure under repeated calls.
