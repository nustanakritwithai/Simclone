# Next build gates — Gameplay First / Character Life

Replanned on 2026-09-24 at the user's request: add tangible character/gameplay systems before deeper cognition. Read [GAMEPLAY_FIRST_ROADMAP.md](GAMEPLAY_FIRST_ROADMAP.md) for scope, invariants and completion evidence.

G1-A now has an isolated possessions component and 55 passing local domain tests. It is not yet connected to the live engine or UI. All other new gameplay below remains planned. G1–G5 are work packages, not published version numbers. When old future version headings in `GAME_PLAN.md` or historical handoffs conflict with this order, use this revised queue while retaining the original long-term vision and acceptance requirements.

## Retained baseline

- V0.3.5: stable death evidence and honest legacy UNKNOWN handling.
- V0.3.6: bounded historical identities and cross-archive ancestry resolution.
- V0.4.0: initial/inherited/earned/legacy-unattributed skill provenance.
- V0.5.0: personal resource knowledge and explicit evidence-backed sharing.

Do not remove these systems. Current engine/save version remains 0.5.0; G1-A does not change the live runtime or save schema. Existing knowledge recording does not imply observation-limited planning.

## NOW — G1-B: Connect the tested possessions core to real gameplay

Read [POSSESSIONS_G1.md](POSSESSIONS_G1.md) before editing. `src/possessions.mjs` already implements unique physical locations, timed craft work, input/output-slot reservations, equipment references, transfers, camp storage and recoverable death drops. Its 55 tests use miniature domain fixtures, not the real engine; do not call G1 released or duplicate this module.

Next work is real engine routing/scheduling/movement, protecting reserved Wood/Stone in BUILD/manual CLONE/autonomous birth and their previews, explicit world-save migration, applying the tool multiplier to WOODCUT progress, death integration, and a working possessions Inspector plus world visual. Supply canonical lifecycle/routing/needs/save-limit functions, not the synthetic test adapters. Preserve all prior engine/browser gates and add genuine G1 end-to-end evidence.

First playable loop:

```text
Timed crafting at the existing camp
→ create one stone axe using declared shared materials
→ put it in a personal tool bag
→ equip it
→ show its measured WOODCUT work-rate effect
→ unequip / nearby transfer / camp storage
→ preserve item identity through death and save/load
```

G1-A prototype contract: four tool-bag slots, one equipped tool, stone axe costing Wood 4 + Stone 2 and 24 work units. Materials are reserved at order admission and consumed once on completion; cancellation releases reservations without adding a refund. WOODCUT work-rate factor 1.25 only, not yield/movement/XP. The full bounds and blocked-completion policy are in POSSESSIONS_G1.md. Real work-rate and balance verification remain G1-B/G1-C gates.

Keep Food/Wood/Stone in the existing shared stock; do not simultaneously count the same material in a bag. Equipping references a held unique item, not a copy. Cloning/birth does not duplicate possessions. Death moves possessions into a recoverable dropped container rather than erasing items or silently awarding inheritance.

No durability, full workshop, farming, new lethal needs, money or advanced belief work in this first package. Bare-handed survival remains available. Existing four skill totals/provenance remain authoritative; do not invent crafting XP.

Completion requires real commands, world/Inspector feedback, item conservation and exclusivity tests, atomic failure, migration, deterministic continuation and all existing mandatory regression gates. Stop and summarize implementation/verification/deployment separately after each closed step; do not open G2 before G1 is playable and verified.

## NEXT — G2: Home and usable furniture

Add home assignment, a bed/sleeping mat and storage chest using existing shelters first. Assignment differs from occupancy. One bed cannot be occupied by two people at once; missing beds keep the existing rest fallback. Do not silently replace current population capacity with bed count.

## THEN — G3: Production and food

Expand tools; add a workshop, one crop and one cooked meal with explicit input/work/output accounting. Introduce durability only together with repair/replacement. Raw/cooked food conversion must not duplicate the existing shared meal supply.

## THEN — G4: Daily life and individuality

Add hygiene/recreation/social needs one at a time with usable remedies. Add a few visible preferences and work/rest/free-time priorities. Emergency survival overrides routines. Do not change the compressed lifecycle clock as an incidental routine change.

## THEN — G5: Small social life

Conversations, actual gifts/shared activities, bounded familiarity/affinity, household ties and one simple personal goal. Every relationship/goal must affect observable behavior. Keep parent lineage separate from household membership; no full factions/economy/war yet.

## PARKED — C1/C2 and deeper cognition

The previously immediate V0.5.1 belief-revision and V0.5.2 knowledge-planning slots are deferred, not deleted:

- C1: direct re-observation supports/corrects a relayed claim; stale is not automatically dishonest.
- C2: personal knowledge and exploration drive resource choices without hidden-world shortcuts.
- Later: multi-step goals, intentional communication, trust, teaching and cultural archive.

Bug fixes to existing knowledge are still allowed. Basic deterministic selection for the new actions is required; a complete cognitive architecture is not a prerequisite for using an axe or bed.

## Later reuse and original goal

Study donor contracts at the point of use, not whole-repo mergers: AstraLife for cognition, Kingdom-sandbox for later occupations/economy/society, TestGE for transactional/replay hardening. No federation dependency or per-tick LLM is required for G1/G2.

The original autonomous-society/V1.0 acceptance requirements remain. The new priority is: **possess and use things → live and interact → learn and plan more deeply → society**.
