# Remaining build gates

Read STATUS and the exact current main/Actions/open PRs before changing code. Plan entries below are unfinished goals, not proof of implementation. Preserve existing tests, explicit migration, single writers and bounded history. UNKNOWN is not PASS.

## Independent Clone World branch

IC1 is merged to `main@3139e979b4446fd3f9873bb8b6fbbfae5ee6248d`.

- **IC0 — SAT design baseline:** canonical individual-first architecture.
- **IC1 — SAT + merged:** evidence-derived personal home ownership and Camp-independent personal site selection.
- **IC2 — implementation candidate:** full RP1 now consumes a pure personal-home intent and routes craft/equip/BUILD placement through existing Rust/engine authority. Default housing-only autonomy remains legacy until IC3.
- **IC3 after IC2 SAT:** remove the default settlement-pressure prerequisite and establish an independent-start mode without mandatory Camp authority.

IC2 required proof:
- pure planner remains read-only;
- one person's bag/Hammer cannot satisfy another person's ownership path;
- coordinator Rust orders retain the intended `agentId`;
- founding Foundation `placedBy` resolves to the same IC1 owner;
- no second ledger/executor;
- existing regressions and exact candidate CI SAT;
- Game Studio capture remains separate evidence and UNKNOWN while `game-dev` is unavailable.

Do not merge old settlement/building branches into this line. Reimplement useful ideas from verified current main.

## IC3 preparation

IC3 is prepared on `feature/independent-clone-world-ic3-prep` and is not active runtime.

Order is locked as:
1. **IC3A Personal survival home** — owned modular home becomes REST/EAT destination.
2. **IC3B Default personal autonomy** — homeless productive adults start personal-home progression without global housing pressure.
3. **IC3C Birth independence** — remove global housing-capacity authorization after guardian/household semantics are explicit.
4. **Archive-host decision** — replace Camp-only Cultural Archive ownership.
5. **IC3D No-Camp fresh start** — deterministic separated start with no mandatory Camp/Shelter authority.

Do not remove Camp before the archive-host and survival-home dependencies are resolved.

## Closed release line

The September 25 line has merged Knowledge Continuity 1, Rust RS1–RS4, Production Planning RP1, Mentorship KF1, WM4.5 food ecology authority and WM4.6 wood ecology authority. Old parallel Rust/formula/roadmap PRs were closed as superseded; their branches are reference-only and must not be merged stale.

Future work starts from the verified current `main`, not from the archived branches.

## Gameplay and integration order

| Gate | Remaining concrete work | Required proof |
|---|---|---|
| UX legibility | **V0.6–V0.8 released; V0.9 candidate:** visual world/menu UI + structure context + interactive Knowledge Graph / event trend / authoritative bar charts | Prove graph nodes/edges come only from retained provenance, line charts use retained event ticks only, bars use current canonical values/targets, filters are UI-local, structure workflows remain reachable, mobile has no overflow, and no visualization becomes a second authority |
| WM4 ecology authority | **Released candidate:** WM4.5 food and WM4.6 wood ecology through the existing single writer | Next: harvest pressure (WM4.7), then shadow resource zones (WM4.8). Do not reselect the food formula |
| Rust survival RS1–RS4 | **Released:** physical crafting/possessions/stations, atomic committed materials, scheduler work, tool speed and Wood 2 -> Charcoal 1 | Preserve conservation and single-authority tests while expanding content |
| Knowledge follow-through | **KF1 released:** Mentor teaching exists; next add richer observation, cultural retrieval and explicit information goals | No hidden-world leak, no XP from merely being told, source preserved across deaths |
| Production planning | **RP1 released:** opt-in deterministic tool → station → charcoal chain | Expand beyond the bounded chain without adding a second executor/material ledger |
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
