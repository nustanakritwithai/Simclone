# Simclone — Runtime 0.5.0 / Gameplay First planning

Runtime baseline: engine/UI and save schema 0.5.0. The browser storage key remains `simclone:world:v1`; historical identity/archive and skill provenance remain bounded and deterministic.

## Current planning decision — 2026-09-24

The user requested tangible character/gameplay systems before further cognitive architecture. The revised queue is **possessions/tools → home/furniture → production/food → daily life/preferences → small social life → deeper knowledge/planning**.

Read [GAMEPLAY_FIRST_ROADMAP.md](GAMEPLAY_FIRST_ROADMAP.md) and [NEXT_STEPS.md](NEXT_STEPS.md) for current delivery order. `GAME_PLAN.md` retains the original long-term vision and acceptance requirements; its old future version ordering is not the active implementation queue.

This is a documentation/planning change only. Personal bags, equippable tools, home assignment, beds, cooking, hygiene, recreation and social relationships are NOT implemented by this revision. No engine/UI/save version has been bumped.

**Next implementation package: G1 only — a personal tool bag, a stone axe, timed crafting, equip/use/transfer, and death/save continuity.** The former immediate belief-revision/knowledge-planning milestones are deferred as C1/C2, not removed. Existing knowledge bug fixes remain in scope when necessary.

## Implemented baseline

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

The inspector exposes a Knowledge tab. Direct claims show as confirmed from personal experience; relayed claims show as unverified and identify the source person. A confirmed living person can share one selected claim through an engine command; the engine validates sender, recipient and communication range and chooses the nearest valid recipient when the UI does not name one.

Each retained identity owns small bounded collections: 4 beliefs, 8 evidence records and 8 knowledge episodes. Existing historical archive compaction preserves this state while omitting transient decision trace data.

Save 0.4.0 migration adds an empty knowledge state. It does not infer old discoveries from skill XP, location, memory text or global world state. Older supported migrations run lifecycle/history/archive/skill provenance first and then add empty knowledge.

Contract: [KNOWLEDGE_MEMORY_0.5.0.md](KNOWLEDGE_MEMORY_0.5.0.md).

## Donor architecture and limits

Source concepts studied from AstraLife: observation/owned memory-belief/delivered messages; belief is not world truth; direct experience can confirm a claim; relayed knowledge carries source and origin evidence; persistent evidence is bounded.

Not imported: provider calls, trust/reputation scoring, autonomous messaging, multi-step planning or LLM thought generation. The current slice stores knowledge and transfer provenance but does not yet make job planning consume only owned/relayed knowledge. Deferring cognition work does not change or conceal this limitation.

## Baseline release evidence

The 0.5.0 release checkpoint was closed at source SHA `c74319d431f300bed64aeba35dabc1d9b57e2568` by exact-main Pages run [36007630124](https://github.com/nustanakritwithai/Simclone/actions/runs/36007630124), which completed verification, upload and deployment. Detailed results and limitations were recorded in [PR #3 release checkpoint](https://github.com/nustanakritwithai/Simclone/pull/3#issuecomment-5815513149).

These are historical results for that source revision, not proof that the newly planned item/home/social mechanics work. Exact candidate and exact-main workflows remain required for subsequent code releases. This planning edit does not itself publish a new game version.

Native loopback Chromium storage evidence, public live-browser play and physical Android are distinct claims. Do not infer physical Android performance from CI. Do not equate the bounded 120/1800-year baseline proofs with unlimited history or the complete future V1.0 society proof.
