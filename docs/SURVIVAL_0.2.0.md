# Simclone 0.2.0 — Survival Core

Base: `8cd2c877da99e77da4ba5dcea059a6db143693b7` (Observation UI 0.1.2).

## Success contract

Upgrade survival without replacing the UI or losing existing worlds. A resource node must have at most one worker, a construction site at most two builders, and a stored food unit at most one meal claimant. Choose reachable targets by actual walking distance. Invalid, interrupted, completed and dead-owner jobs must release claims. There must be no XP for zero output, no negative inventory, and no free meals.

## Delivered behavior

`survival.mjs` supplies one BFS distance field per decision and a derived reservation book. Claims are rebuilt from authoritative saved tasks, not stored in a separate mutable lock table. Existing valid jobs retain claims in start-tick/ID order; new assignments prioritize hunger, then exhaustion, with rotating tie order. Each resource family searches all reachable unoccupied alternatives before reporting that jobs are reserved or unreachable.

Food already reserved for eating cannot be spent on cloning. Clone costs remain food 8 and wood 4. House costs remain wood 12 and stone 6; at most two workers can build the same house. Completed housing still gates manual population expansion.

Stock targets: food `max(24, population × 4)`, wood `max(36, population × 3)`, stone `max(24, population × 2)`. Assigned production is included before assigning another worker. These are soft targets, not inventory capacities; a final harvest batch or an imported old stockpile can exceed them. Inventory remains capped at 999 per type. Original food/wood regeneration rates are unchanged and explicit; stone does not regenerate.

Hunger below 35 takes priority over optional work. A hungry forager consumes exactly one freshly harvested unit on site, putting the remainder into shared stock. Nothing is generated for free. An exhausted agent (energy below 12) can rest locally when a completed shelter is too far away; sheltered rest is faster and can heal a sufficiently fed agent. Hunger has precedence when both needs are critical. No food anywhere still causes starvation and death.

Task contracts are revalidated before walking and execution. Removed/depleted resources, completed buildings, conflicting claims, expired jobs and invalid next movement steps cause replanning. The selected decision's score is the exact sum of its displayed factors. UI reasons show actual route steps and blocked/reserved/stock-target explanations, with the selected choice always included.

Tap the food counter, or open **Menu → ภาพรวมการอยู่รอด**, to see available/reserved food, stock targets and active jobs. Opening an inspector tab also recenters the selected character, fixing an intermittent landscape framing failure found during this regression run.

## Save compatibility

Engine and UI are 0.2.0; `SAVE_VERSION` and saved `version` remain 0.1.0. The key `simclone:world:v1` is unchanged. Seeds, resources, completed construction, appearances, parent links and skill XP are preserved. Old in-flight tasks have no new policy marker: they are recomputed on the next simulation tick. Exact historical replay across engine versions is not promised. Existing damaged/unreadable-save protections are unchanged.

The compatibility fixture uses the actual old engine blob `fce6ac891246120f925c01fb9fd9e3f4a49c3855`, not a hand-invented save schema.

## Verification evidence

- `npm test`: 57/57 tests passed. This includes the previous 28 tests plus 29 survival-specific contracts.
- `npm run test:survival`: 18/18 scenarios passed. Five seeds (`230926`, `1`, `42`, `2026`, `90001`) × populations 6, 12 and 36 each survived 100 elapsed simulated days. Three more scenarios started with zero shared food and every agent at satiety/energy 5, then survived 10 days. Housing/population are initialized fixtures, not autonomous reproduction.
- Day-boundary validation and counters are sampled every 360 ticks. The dedicated crowded unit fixture checks exclusive reservations and resource bounds every tick for 2,000 ticks. End-of-run survival does not imply every possible seed or scarcity situation is solved.
- Offline Chromium: existing UI suite 42 checks, navigation/storage suite 36 checks, and new survival panel/legacy-load suite 10 checks passed (88 total). No uncaught JavaScript errors. The initial 844×390 framing failure was repaired and the full affected suites rerun.
- Results for the long-run scenarios are retained in `docs/verification/survival-0.2.0.json`.
- Pages now requires both unit/asset tests and the survival scenarios before deployment.

## Limits / next gate

Browser fixtures load the exact modules in memory and use an explicit Storage test double. Direct public-site navigation in the test browser was blocked (`ERR_BLOCKED_BY_ADMINISTRATOR`). Native browser persistence, live HTTP delivery and physical Android performance are not established by these tests; Pages deployment status is checked separately.

This is NOT the V1.0 100-day autonomous-world proof: there are still no autonomous births, childhood, aging, mentor/archive learning, social groups, factions or replay. Shared stock still transfers harvested output directly rather than simulating full logistics. Agents still have world-level resource knowledge; local perception is not claimed. Next is V0.3 lifecycle with separate birth/aging/save contracts.
