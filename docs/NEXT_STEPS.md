# Remaining build gates

Read STATUS and the exact current main/Actions/open PRs before changing code. Plan entries below are unfinished goals, not proof of implementation. Preserve existing tests, explicit migration, single writers and bounded history. UNKNOWN is not PASS.

## Closed release line

The September 25 line has merged Knowledge Continuity 1, Rust RS1–RS4, Production Planning RP1, Mentorship KF1, **WM4.5 food ecology authority**, and the dedicated Rust item/crafting UI. Old parallel Rust/formula/roadmap PRs were closed as superseded; their branches are reference-only and must not be merged stale.

Future work starts from the verified current `main`, not from the archived branches.

## Gameplay and integration order

| Gate | Remaining concrete work | Required proof |
|---|---|---|
| WM4 ecology authority | **Released:** WM4.5 conservative ecology-sensitive food regeneration is active through the existing single WorldSim writer | Preserve five-seed long-run/crisis/replay/save-load proof when ecology changes |
| **R1 Rust Survival Complete** | Add the next bounded physical-survival slices: fiber/rope → food/water processing → durability/repair → storage/chest. Re-port useful donor ideas from current main; do not merge stale Rust branches | Conservation, exact-once commitment, bounded ledgers, death/save migration, station/recipe prerequisites, offline UI and long-run regression |
| **R2 Autonomous Production** | Expand RP1 only after each R1 material/item authority exists; planner coordinates existing commands and never becomes a second executor | Disabled baseline equivalence, no duplicate outputs/stations, save/load continuation, survival priority |
| **R3 Daily Life** | Connect processed food/water, personal possessions, shelter/comfort/safety and ownership to deterministic needs/decision scoring | Needs have real behavioral effects, no free resources, explainable traces and generation continuity |
| Knowledge follow-through | **KF1 released:** Mentor teaching exists; next add richer observation, cultural retrieval and explicit information goals | No hidden-world leak, no XP from merely being told, source preserved across deaths |
| Production planning | **RP1 released:** opt-in deterministic tool → station → charcoal chain | R2 expands this after R1; no second executor/material ledger |
| Kingdom authority | Move the remaining production/economy projections to gameplay individually; K5 labor scoring is already active | Baseline continuity before/after each switch; no blanket shadow-to-authority conversion |
| Social | Build event-based trust/affinity/respect/fear/debt and family links on top of released KF1 mentorship | Bounded provenance, actual behavioral effect, no fabricated motives from stale claims |
| Faction and governance | Membership, leader/collective goals, rules and change/split conditions | Resource ownership, explainable membership/decisions, persistence and bounded history |
| Economy | Real wallets/inventory, prices, wages/trade and production chains | Conservation, atomic transactions, no money/material duplication, survival reserves protected |
| Cooperation/conflict | Joint work, disputes/mediation and later territorial conflict | Outcomes change behavior through real rules; no arbitrary narrative-only victories |
| Culture/technology | Versioned techniques, teaching, experiments and adopted improvements | Discovery -> evidence -> publication -> uptake -> changed production, not renamed static levels |
| Spatial maturity | Route memory, richer local exploration, danger/travel cost and settlement placement | Reachability and visibility boundaries, no teleportation, deterministic navigation |
| Optional novelty layer | Bounded proposal queue, externally configured reasoning adapter, validator/approval/outcome verification | No keys in static frontend, no per-agent per-tick model calls, UNKNOWN does not promote a skill |
| Full V1.0 acceptance | Original-only fresh start, autonomous expansion/building, generations, knowledge continuity and save/load without repeated player orders | Separate exact 100-day proof, long-run generation proof and public/native browser evidence |

## Release discipline

Use a new branch from the verified current main, or continue the exact existing PR when repairing it. Re-check branch heads before writes, use non-forced updates, and preserve other branches. Keep native HTTP tests separate from offline Storage doubles. Regenerate browser source pins after runtime changes. Release only after exact candidate checks and exact main Pages test/upload/deploy succeed.


## R1 execution contract — Rust Survival Complete

Start from verified `main@84b42ef`. R1 is not one giant merge. Ship it as bounded authority slices so failures can be isolated and rolled back.

1. **R1A Fiber + Rope** — add one authoritative fiber source/ledger path and Rope as a physical/material input. Update selected recipes only after conservation proof.
2. **R1B Food + Water processing** — add bounded raw/processed consumables and furnace/camp processing without bypassing existing hunger authority.
3. **R1C Durability + Repair** — deterministic wear only from productive tool use; repair consumes authoritative materials and never clones an item.
4. **R1D Storage** — physical bounded chest/storage with explicit ownership/location transfer; no invisible infinite inventory.
5. **R1E Integration proof** — save migration, death/drop/storage behavior, autonomous production compatibility, long-run survival and mobile UI.

R1 Definition of Done: every new material/item has one writer/ledger, accepted work commits inputs exactly once, outputs cannot duplicate across interruption/save/death, all state is bounded and validated, old saves migrate explicitly, exact candidate CI passes, exact merged-main Pages passes, and STATUS/NEXT_STEPS match the released code.
