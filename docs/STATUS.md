# Simclone — implementation status

Current feature set: **Knowledge Continuity 1 + Rust Survival RS1–RS4 integrated candidate**, on the `0.5.0` engine/UI/base-save family. This file describes code and limits. The exact candidate verification run and the exact main Pages deployment are the release authority; neither a green older run nor this document proves a newer commit.

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

## Rust Survival RS1–RS4 integrated candidate

Physical crafting/possessions/stations and the first furnace process are now wired into the authoritative fixed-step scheduler. Materials are committed once at order acceptance, task interruptions retain the order, save/load preserves work, placed stations are visible in-world, and tools affect the matching productive work rate. See [RUST_SURVIVAL_RS1_RS4_INTEGRATED](RUST_SURVIVAL_RS1_RS4_INTEGRATED.md). This remains a candidate until exact-head CI and exact-main Pages are green.

## Production Planning RP1 candidate

RP1 is an explicit opt-in deterministic coordinator over the Rust command layer. It can autonomously request the bounded tool/station/charcoal chain, but all material commitment, movement, work completion, placement and interruption remain authoritative in the existing engine/Rust runtime. See [PRODUCTION_PLANNING_RP1](PRODUCTION_PLANNING_RP1.md). It is not released until exact-head CI and merged-main Pages are green.

## Authority map

| Area | Actual owner / activation |
|---|---|
| Lifecycle, task execution, stock, births, building | Simclone engine, deterministic |
| Resource regeneration | WorldSim WM4.1 writer, original food/wood amounts and cadence |
| Ecology calibration / alternative formula evaluation | WM4.2 / WM4.3 read-only, no activated ecological amount formula |
| Occupation history | K1 actual winning-job profession/career state |
| Labor-choice premium | K5 active within existing task eligibility and survival constraints |
| Demand, production efficiency, labor offers, market price | K2/K3/K4/K6 observational projections, not money or trade |
| Personal belief | Owned evidence; never equated with global world truth |
| Cultural publication | Explicit camp archive, not an omniscient library |
| Rust crafting / possessions / stations | RS1–RS4 integrated command + scheduler path; bounded physical items and stations |
| Production chain RP1 | Opt-in deterministic coordinator; issues validated Rust commands only |
| Charcoal | Furnace authority: committed Wood 2 -> timed work -> Charcoal 1 |
| Tool speed | Stone Axe WOODCUT ×1.25; Stone Pickaxe MINE ×1.25; Hammer BUILD ×1 |
| UI | Observation and validated command dispatch, not simulation rules |

## Remaining and unclaimed

A proven ecological food formula; autonomous production-chain planning beyond accepted Rust orders; fuller multi-step production plans; mentor/student relations; event-driven social relationships and factions; actual currency/trade; conflict and mediation; researched technology; optional external novelty reasoning; private terrain memory and richer spatial risk; full replay and the complete Original-only autonomous V1.0 acceptance proof.

The current new long-run fixture starts with the existing six-person seed worlds and explicitly enables the local planner and buys the archive. It is not proof of a world starting with only Original, autonomous initial archive construction, autonomous settlement expansion, an unlimited civilization, or the whole master game plan.

Native HTTP/storage, public Pages behavior, physical Android performance and other external scopes require separate evidence. UNKNOWN is never counted as PASS.
