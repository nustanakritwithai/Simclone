# Prepared next gate — IC7B Household Trade Authority

- Dependency: IC7A Recruitment + Cooperation / PR #101.
- Household surplus can become conserved in-transit cargo only with reciprocal owner relationship evidence.
- Carrier uses normal navigation; delivery writes destination Household stock exactly once.
- Successful delivery creates Trust/Affinity/Debt evidence; carrier death strands cargo without material loss.
- After IC7B SAT: stranded-cargo recovery + Logistics/risk, then Neighborhood derivation from repeated household interaction.

# Prepared next gate — IC7A Recruitment + Cooperation Authority

- Dependency: IC6C central-stock closeout / PR #100.
- Household food/wood/stone/building labor pressure now produces relationship-backed recruitment candidates.
- Autonomous acceptance runs every 60 ticks, max one JOIN per cycle, and reuses the existing JOIN_HOUSEHOLD writer.
- Real follower resource work records bounded owner→worker Trust/Respect evidence.
- After IC7A SAT: activate atomic Household Trade contract/cargo/delivery, then Logistics and Neighborhood derivation.

# Active gate — IC6C Central Stock Closeout

- Base: `main@e9a512ff` with Kingdom household integration + WM4.8.
- Independent gameplay authority is now `resourceAccount() → resourceStock()`; `s.stock` is retained only as an exact-zero save compatibility placeholder.
- Closeout removes remaining Independent reads from selected HUD, daily event and autonomous birth pre-read while preserving legacy `s.stock` behavior.
- Required proof: zero placeholder, non-zero derived totals, birth independence from placeholder/freeFood, aggregate daily event, homeless HUD, same-household HUD equality, validator rejection of non-zero placeholder, full regression/browser CI.
- After SAT: activate Recruitment/Cooperation authority, then atomic Household Trade + Logistics.

# Active gate — Kingdom Full Integration

- Integration base: `main@dc13e8f` with WM4.8 ecological resource zones preserved.
- Includes IC6C Household Resource Pool, IC6D Kingdom-style Leadership/Followers, K2–K6 household economy shadow, household Organization/Recruitment shadow, and household Trade shadow.
- Donor source: `nustanakritwithai/Kingdom-sandbox`.
- Independent raw resources are house-keyed once a home exists; homeless Clones retain temporary personal raw stores. Physical bag items/tools remain personal.
- Leadership is a provenance-backed social skill; relationship evidence remains mandatory; Leadership bounds adult follower slots.
- Recruitment and trade layers remain deterministic read-only shadows until their explicit mutation gates are approved.
- WM4.8 remains authoritative/current and is not replaced by this integration.
- Required proof before release: full regression CI, browser asset pins, exact-main Pages, then public live smoke.

# Active gate — IC6B Adult Cohabitation

- IC1–IC5 Independent Clone World core + IC6A relationship authority are on main `2c186fea`.
- **IC6B implementation candidate:** evidence-gated adult cohabitation, explicit JOIN/LEAVE, shared survival-home destination, personal resources unchanged, household Inspector evidence.
- Required proof: planner thresholds, JOIN/LEAVE authority, save migration, owner-death cleanup, personal-home pause/resume, browser Inspector/command smoke, all prior independent/legacy regressions unchanged.
- **After IC6B SAT:** property/inheritance → cooperation/trade → social home-site preference → neighborhood emergence.

# Active gate — Independent Clone World delivery

1. Complete exact candidate CI for PR #88. The new candidate includes IC2 repair and IC3 no-Camp/private-resources/personal-home/guardian/archive-host behavior.
2. Retain both the legacy compatibility suite and explicit independent-profile browser suite. Native HTTP/public Pages and physical Android are separate scopes.
3. After exact candidate success, merge and verify exact-main Pages/public bytes. A local pass or a merge alone is not release proof.
4. After publishing any candidate, obtain its run URL once, send it to the user, and stop polling. Do not sit waiting for CI or create a watcher.

Current source of truth: [IC3 contract](IC3_INDEPENDENT_START_SUCCESS_CONTRACT.md) and [IC3 work state](IC3_WORK_STATE.md).
Future gameplay: explicit inheritance/property transfer; relationship-based cohabitation/cooperation/trade; emergent neighborhoods. These are deferred, not completed by the current independent start.

## Historical release/backlog context

The remaining legacy backlog below is retained for context. Current independent-mode rules supersede its central-stock/Camp/housing assumptions, not the unchanged legacy save behavior.

## Closed release line

The September 25 line has merged Knowledge Continuity 1, Rust RS1–RS4, Production Planning RP1, Mentorship KF1, WM4.5 food ecology authority and WM4.6 wood ecology authority. Old parallel Rust/formula/roadmap PRs were closed as superseded; their branches are reference-only and must not be merged stale.

Future work starts from the verified current `main`, not from the archived branches.

## Gameplay and integration order

| Gate | Remaining concrete work | Required proof |
|---|---|---|
| UX legibility | **V0.6–V0.8 released; V0.9 candidate:** visual world/menu UI + structure context + interactive Knowledge Graph / event trend / authoritative bar charts | Prove graph nodes/edges come only from retained provenance, line charts use retained event ticks only, bars use current canonical values/targets, filters are UI-local, structure workflows remain reachable, mobile has no overflow, and no visualization becomes a second authority |
| WM4 ecology authority | **WM4.8 stacked candidate:** WM4.7 keeps the single Food/Wood regeneration writer; WM4.8 derives contiguous Food/Wood/Stone ecological zones read-only | Prove zone thresholds/connectivity/node accounting with WM4.7 SAT first; only then consider zone-informed placement authority. Do not create a second resource ledger |
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
