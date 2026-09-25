# Simclone — implementation status

Current feature set: **Knowledge Continuity 1 + Rust Survival RS1–RS4 + Production Planning RP1 + Mentorship KF1 + WorldSim WM4.5 food ecology + WM4.6 wood ecology**, on the `0.5.0` engine/UI/base-save family. This file describes code and limits. The exact candidate verification run and the exact main Pages deployment are the release authority; neither a green older run nor this document proves a newer commit.

## Completed foundations retained

Deterministic Survival Core, actual routing and task-derived reservations; biological lifecycle and autonomous births; stable age/starvation death facts; bounded historical identities across hot and archived records; 35% parent XP inheritance with skill provenance; bounded personal knowledge and explicit knowledge sharing.

Main commit `171b05a210df22ff54a2fd91d0b9d9d02fbf19ee` merged the repaired WM4.3 calibration after candidate `1a496e5976e6af63fa846fcaf5ee0e9e4b53a761` passed Verify run `36070721630` (#280). The missing `createFoodEcologyCalibration` export was reproduced and fixed. A native ESM-link test now checks all runtime named imports without evaluating DOM code. A merge alone is not deployment proof.

## Knowledge Continuity 1

- **Revision:** owned received claims can be verified within four cells. Presence confirms; actual local mismatch/absence refutes; temporary depletion and 720-tick age make claims stale. XP and stock are unaffected. Co-located resource IDs are distinguished.
- **Personal planning, opt-in:** only visible resource nodes or owned investigation targets enter resource choice. Unseen depletion/removal is not exposed. Remembered targets become visit/verify steps before productive use. Generic exploration has a bounded soft distance penalty so idle does not permanently block information gathering.
- **Structured goal outcomes:** visit/work/explore phases, interruptions and four retained outcome lessons. Productive resource/build results record success; verification alone does not grant skill. This is not arbitrary long-horizon planning or physical hauling.
- **Cultural archive, paid camp upgrade:** wood 6 + stone 2, 16 publications, three prior revisions each, 32,000-character culture budget. Near-camp publication/reading, independent verification, original-source retention and automatic one-operation/120-tick boundary. Authors may die without deleting published knowledge.
- **Persistence:** versioned optional planner/culture extensions. Legacy policy stays selected until explicit opt-in. Existing identities and resource/birth rules are not reset. Malformed new metadata is rejected, not guessed.
- **UI:** food summary offers policy/archive controls; Knowledge tab verifies, publishes and explains archive sources; Reason tab displays the current goal and actual K5 scoring.
- **Loading/tests:** complete source-hash import map prevents stale runtime mixtures. `node scripts/pin-assets.mjs` regenerates pins. Offline browser fixtures use one data URL per module, not recursively duplicated dependency graphs.

Contract and evidence rules: [KNOWLEDGE_CONTINUITY_1](KNOWLEDGE_CONTINUITY_1.md).

## Rust Survival RS1–RS4

Merged at `769e684` after exact candidate `235200d` passed Verify #293; Pages #36 succeeded. Physical crafting/possessions/stations and the first furnace process are wired into the authoritative fixed-step scheduler. Materials commit once at order acceptance, task interruptions retain accepted work, save/load preserves it, placed stations are visible in-world, and tools affect matching productive work. See [RUST_SURVIVAL_RS1_RS4_INTEGRATED](RUST_SURVIVAL_RS1_RS4_INTEGRATED.md).

## Production Planning RP1

Merged at `48722b7` after exact candidate `5127931` passed Verify #296; Pages #37 succeeded. RP1 is an explicit opt-in deterministic coordinator over the Rust command layer. It requests the bounded tool → station → charcoal chain while material commitment, movement, work completion, placement and interruption remain owned by the existing authoritative systems. See [PRODUCTION_PLANNING_RP1](PRODUCTION_PLANNING_RP1.md).

## WorldSim WM4.5 food + WM4.6 wood ecology authority

`src/worldsim-resource-authority.mjs` is the single regeneration writer. Food uses `wm4.5-conservative-v1`. Wood uses `wm4.6-conservative-v1` (`woodYieldPotential < 0.08 → 0`, otherwise `+1` / 720 ticks). Stone remains finite. WM4.2–WM4.4 remain evidence/Formula Lab. Harvest pressure and spawn/distribution are not in this release. See [WORLDSIM_WM4_6_WOOD_ECOLOGY](WORLDSIM_WM4_6_WOOD_ECOLOGY.md).

## Mentorship KF1

Merged at runtime main `f51138d` after exact candidate `b7413d9` passed Verify #303. Mentor → Student links are bounded and persistent; confirmed Mentor claims enter the student as UNVERIFIED, teaching grants no Skill XP, the same Mentor-link + key is idempotent, and death closes active links while preserving history. The Social tab exposes the relationship without inventing trust/affection/motives. See [MENTORSHIP_KF1](MENTORSHIP_KF1.md).

## UX legibility release line

UX V0.6 is released at `main@038318ac2ab8ced68896b8dcf4d3742df8640605`. Exact candidate `6f35fb77d9148bdf44448f08a6b20e9ce89f44e6` passed Verify #546 and exact main Pages #56 succeeded. The released UI keeps the world low-chrome, exposes an AI Decision Feed with direct Clone → Why navigation, shows seven primary system cards, and keeps the full 40+ runtime catalog behind Advanced disclosure.

UX V0.7 World Feedback is released at `main@32317ef226932747333d0b3f74cda1b314d9f6f2`. Exact candidate `6ef207fd3ffc6c6d437d9ec0ad7b658960009221` passed Verify #555 and exact main Pages #57 succeeded. Selected/emergency/persistent productive actions remain visible, newly started tasks receive a bounded icon-first marker for 12 simulation ticks, equipped tools remain visible, and incomplete modular housing gets a derived progress chip. The progress and task markers are recomputed from authoritative state; they do not create a task/building ledger or write simulation state.

UX V0.8 Event → Cause is the current candidate. Chronicle event detail is evidence-first and read-only: it resolves historical cause only when the event tick can be matched to retained authoritative evidence such as lineage, immutable death history, career/skill provenance, Rust placement/item records, knowledge evidence, mentorship links or Cultural Archive records. Missing historical cause remains explicit `UNKNOWN`; the UI never substitutes a Clone's current decision trace for historical intent. No replay authority or new event-history ledger is introduced.

## Authority map

| Area | Actual owner / activation |
|---|---|
| Lifecycle, task execution, stock, births, building | Simclone engine, deterministic |
| Resource regeneration | WorldSim WM4.6 single writer; ecology-sensitive food and wood policies active, stone finite |
| Ecology calibration / alternative formula evaluation | WM4.2–WM4.4 remain evidence/Formula Lab; food and wood production policies are active |
| Occupation history | K1 actual winning-job profession/career state |
| Labor-choice premium | K5 active within existing task eligibility and survival constraints |
| Demand, production efficiency, labor offers, market price | K2/K3/K4/K6 observational projections, not money or trade |
| Personal belief | Owned evidence; never equated with global world truth |
| Cultural publication | Explicit camp archive, not an omniscient library |
| Mentorship KF1 | Bounded Mentor→Student links; teaching sends UNVERIFIED evidence, no teaching XP |
| Rust crafting / possessions / stations | RS1–RS4 integrated command + scheduler path; bounded physical items and stations |
| Production chain RP1 | Opt-in deterministic coordinator; issues validated Rust commands only |
| Charcoal | Furnace authority: committed Wood 2 -> timed work -> Charcoal 1 |
| Tool speed | Stone Axe WOODCUT ×1.25; Stone Pickaxe MINE ×1.25; Hammer BUILD ×1 |
| UI | Observation and validated command dispatch, not simulation rules |

## Remaining and unclaimed

Harvest-pressure ecology and resource-zone placement; production planning beyond the bounded RP1 chain; richer information goals; event-driven trust/affinity/respect/fear/debt, family links and factions; actual currency/trade; conflict and mediation; researched technology; optional external novelty reasoning; private terrain memory and richer spatial risk; full replay and the complete Original-only autonomous V1.0 acceptance proof.

The current new long-run fixture starts with the existing six-person seed worlds and explicitly enables the local planner and buys the archive. It is not proof of a world starting with only Original, autonomous initial archive construction, autonomous settlement expansion, an unlimited civilization, or the whole master game plan.

Native HTTP/storage, public Pages behavior, physical Android performance and other external scopes require separate evidence. UNKNOWN is never counted as PASS.
