# Remaining build gates

Read STATUS and the exact current main/Actions/open PRs before changing code. Plan entries below are unfinished goals, not proof of implementation. Preserve existing tests, explicit migration, single writers and bounded history. UNKNOWN is not PASS.

## First release gate

Knowledge Continuity 1 is merged at `main@09260a3` and its exact main deployment job completed successfully. The active release gate is now the Rust RS1–RS4 integrated candidate; do not mark it released until its exact candidate and exact merged-main workflows pass.

## Gameplay and integration order

| Gate | Remaining concrete work | Required proof |
|---|---|---|
| WM4 ecology | Select an ecological food amount formula using calibration/Formula Lab; activate only the existing WorldSim writer | Survival/crisis/population/replay comparisons, no second writer, explicit policy/save compatibility |
| Rust survival RS1–RS4 | **Implemented in PR #52 candidate:** physical crafting/possessions/stations, atomic committed materials, scheduler work, tool speed and Wood 2 -> Charcoal 1 | Exact candidate CI + offline Chromium + exact merged-main Pages; then move to autonomous production-chain planning |
| Knowledge follow-through | Intentional person-to-person teaching, richer observation, cultural retrieval and explicit information goals | No hidden-world leak, no XP from merely being told, source preserved across deaths |
| Production planning | **RP1 candidate implemented:** opt-in deterministic tool → station → charcoal chain using existing Rust commands | Exact combined CI, save/load continuation, no duplicate output, then expand beyond the bounded chain |
| Kingdom authority | Move the remaining production/economy projections to gameplay individually; K5 labor scoring is already active | Baseline continuity before/after each switch; no blanket shadow-to-authority conversion |
| Social | Event-based trust/affinity/respect/fear/debt and mentor/family links | Bounded provenance, actual behavioral effect, no fabricated motives from stale claims |
| Faction and governance | Membership, leader/collective goals, rules and change/split conditions | Resource ownership, explainable membership/decisions, persistence and bounded history |
| Economy | Real wallets/inventory, prices, wages/trade and production chains | Conservation, atomic transactions, no money/material duplication, survival reserves protected |
| Cooperation/conflict | Joint work, disputes/mediation and later territorial conflict | Outcomes change behavior through real rules; no arbitrary narrative-only victories |
| Culture/technology | Versioned techniques, teaching, experiments and adopted improvements | Discovery -> evidence -> publication -> uptake -> changed production, not renamed static levels |
| Spatial maturity | Route memory, richer local exploration, danger/travel cost and settlement placement | Reachability and visibility boundaries, no teleportation, deterministic navigation |
| Optional novelty layer | Bounded proposal queue, externally configured reasoning adapter, validator/approval/outcome verification | No keys in static frontend, no per-agent per-tick model calls, UNKNOWN does not promote a skill |
| Full V1.0 acceptance | Original-only fresh start, autonomous expansion/building, generations, knowledge continuity and save/load without repeated player orders | Separate exact 100-day proof, long-run generation proof and public/native browser evidence |

## Release discipline

Use a new branch from the verified current main, or continue the exact existing PR when repairing it. Re-check branch heads before writes, use non-forced updates, and preserve other branches. Keep native HTTP tests separate from offline Storage doubles. Regenerate browser source pins after runtime changes. Release only after exact candidate checks and exact main Pages test/upload/deploy succeed.
