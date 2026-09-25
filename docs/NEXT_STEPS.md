# Remaining build gates

Read STATUS and the exact current main/Actions/open PRs before changing code. Plan entries below are unfinished goals, not proof of implementation. Preserve existing tests, explicit migration, single writers and bounded history. UNKNOWN is not PASS.

## First release gate

Finish exact candidate/main verification for Knowledge Continuity 1. Its implementation includes local belief revision, personal resource planning, an explicit paid archive, goal outcomes, source-cache pins and browser regression coverage. Do not mark it deployed from local tests alone.

## Gameplay and integration order

| Gate | Remaining concrete work | Required proof |
|---|---|---|
| WM4 ecology | Select an ecological food amount formula using calibration/Formula Lab; activate only the existing WorldSim writer | Survival/crisis/population/replay comparisons, no second writer, explicit policy/save compatibility |
| Rust survival RS1–RS4 | Reconcile open crafting/possession/station/charcoal stack against current main, instead of merging stale parallel copies | Real inventory costs, station proximity, timed work, reservation symmetry, exact-once completion and save/load |
| Knowledge follow-through | **KF1 candidate:** persistent Mentor links + intentional/periodic evidence-backed teaching | Exact candidate/main verification; then connect teaching to richer social trust and explicit information goals |
| Production planning | Multi-step resource -> station -> tool/processing chains with preconditions, interruption and verified completion | Failed steps spend nothing twice; hunger interrupts safely; plan continuation after save/load |
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
