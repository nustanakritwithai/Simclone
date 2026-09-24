# G1 — Possessions and stone axe

Date: 2026-09-24. User direction: tangible character gameplay before deeper cognition.
Reviewed released main: `c74319d431f300bed64aeba35dabc1d9b57e2568`.
Planning base: `02a9e1ce6fa598fb0d95253ab5648b102585790d` / PR #8.

## Status: G1-A component implemented; G1 is NOT playable or released yet

`src/possessions.mjs` is a dependency-free deterministic domain module. Its own
`tests/possessions.test.mjs` has 55 passing local tests on miniature domain
fixtures. These are NOT the real engine, movement scheduler, old-save migration,
browser, native storage or physical Android tests.

The live `src/engine.mjs`, runtime imports, UI, workflows and package/save versions
have not been changed by G1-A. `possessionCommand()` is not yet routed by the live
engine's `command()`. `advanceToolCraft()` does not run unless explicitly called.
The default live world therefore still has no usable tools or bag UI.

Execution slices of the existing G1 work package:

- G1-A: item identity/location, timed craft domain, reservations, equipment,
  handover/storage/drop recovery and isolated invariants (implemented here).
- G1-B: canonical engine integration, all shared-stock consumers, real movement,
  CRAFT task validation/execution, explicit migration and Inspector/world visuals.
- G1-C: controlled real-engine comparisons, complete baseline and browser gates,
  exact candidate/main verification and Pages release.

These substeps do not authorize starting G2 homes or the deferred C1/C2 cognition.

## Locked first recipe and prototype limits

Stone axe: Wood 4 + Stone 2, 24 units of crafting work. No food cost, no new skill,
no crafting XP, no durability/repair in this slice. Supplied adult work rate 1
requires 24 work ticks AT the camp; supplied elder rate 0.75 requires 32. Travel,
pauses and interrupted survival work are not counted as craft work.

A held-and-equipped stone axe exposes a WOODCUT work-rate multiplier of 1.25.
Bare hands and other jobs return 1.0. This is a work-progress modifier, NOT a 25%
yield, movement speed or per-action XP bonus and NOT necessarily 25% less elapsed
time. G1-A tests the factor only. Actual engine rate application/comparisons are
G1-B/G1-C, preserving the existing elder multiplier (0.75 x 1.25 = 0.9375).

Bag 4 tools, one equipped tool per living holder, camp storage 64 tools, maximum
128 existing tools PLUS promised craft outputs, maximum 12 craft orders, one
order per maker and per camp. Implicit dropped containers are bounded by item
count. Possession-state budget is 65,536 JavaScript string characters, not UTF-8
bytes. Do not raise the existing global save or retained-identity limits.

## One physical location, not duplicate inventories

`world.possessions` owns items, equipment references and orders. An item holds a
unique positive ID, catalog kind, creator ID, creation tick and one location:

- `{kind:'bag', agentId}`
- `{kind:'camp', buildingId}`
- `{kind:'drop', agentId, tick, x, y}`

Bags are derived by filtering item locations. Equipment is an `{agentId,itemId}`
reference to an item already in that holder's bag. No agent-side bag array is
stored. No ownership-law or automatic inheritance is claimed.

A drop's deceased ID/death tick/frozen coordinates identify an implicit physical
container; there is no second mutable list of its items. Creators and deceased
sources can resolve through `agents` or `archive`.

New identities have empty derived bags unless an explicit transfer supplies a
real item. This property is covered in domain fixtures; actual CLONE/autonomous
birth and archive integration must still be exercised in G1-B/G1-C.

## Craft order and cancellation contract

CRAFT_TOOL requires the engine's lifecycle eligibility, canonical route check and
global save-character budget. It reserves the catalog Wood/Stone quantities and
one output bag/registry slot. Stock remains in shared storage; reservation sums
are derived from orders, not another material ledger. Materials are paid exactly
once when a timed output commits. Output enters the maker's bag UNEQUIPPED.

Only the assigned CRAFT executor at the camp may call advanceToolCraft. Supplied
canonical readiness interrupts on urgent needs. Progress lives ONLY in the order
and survives hunger/rest interruption; same-tick repeated calls cannot advance it
again. Cancellation deletes the order and progress and releases reservations.
Because no payment occurred, it must NOT increment stock as a refund. Repeating
cancellation or completion cannot create items or spend/refund twice.

The engine integration is incomplete until BUILD, manual CLONE, autonomous birth
and their previews all respect the reserved Wood/Stone. Wiring only the craft
button would be incorrect: the present live consumers still read ordinary stock.

Admission rejects full bags, item/order limits, unavailable materials, unreachable
camp and insufficient save budget without mutation. If the overall save grows
before output completion, completion can remain blocked without payment or loss
of order/progress. G1-B must explain this reason in the UI and allow cancellation.

## Equipment, transfer and death

Equip changes a reference, not item count. Unequip requires the currently equipped
item ID so a stale request cannot remove a replacement. Giving or storing an
equipped tool removes its old equipment reference atomically; the receiver must
explicitly equip it. Exchanges require live participants within Manhattan range
1, and camp operations/pickup require proximity to the actual physical location.
Incoming items count pending craft output against the recipient's bag limit.

Death cleanup drops carried tools at the death position, clears equipment and
cancels craft reservations without payment. It must happen in the death
transition before archive compaction or subsequent work, even at item capacity.
Existing lifecycle writes the death facts and bounded event/memory note. G1-A
provides the cleanup function but has NOT hooked that transition into the engine.

## Required engine integration map (NEXT)

1. Read current main, AGENTS.md, STATUS.md and the gameplay roadmap again. Preserve
   PR #8 planning changes; do not treat the old belief-verification queue as next.
2. Add `possessions:createPossessions()` to NEW worlds. Add an explicit migration
   from supported legacy world schemas, especially 0.5.0, producing empty property.
   Missing or malformed possession state in the NEW current schema is corruption,
   not silently repaired. Never invent tools from old XP or resource totals.
3. Pass real `canPerformProductiveWork`, `RULES.hungry/exhausted`,
   `productiveWorkRate`, `pathTo`, `walkable` and the existing global save limit.
   Do not use the test fixture's synthetic `stage` field or always-true route
   callback in production. Module callbacks must be pure.
4. Route TOOL_COMMANDS in authoritative `command()`, with truthful Thai messages.
   All previews remain read-only. Protect reserved stock in every other spend
   path and reproduction preview; no duplicate stock subtraction.
5. Add one real CRAFT task to candidate selection/taskValid/claim/execute, with
   orderId + camp destination. Move with existing route machinery, never teleport.
   Consume `order.work` as the ONLY progress authority; no duplicate persistent
   task-work counter. Hunger/rest priorities and pending order resumption remain.
6. Multiply only WOODCUT's productive work progress by toolWorkMultiplier. Do not
   modify the underlying skill/XP/yield or the bare-handed baseline. No tools
   means no old gameplay change.
7. Call releasePossessionsOnDeath after death facts are fixed and before archiving.
   Validate item/source references across retained history. Keep the real storage
   overwrite protection and archive/save admission guards.
8. Add a functional Possessions tab and a small canvas axe/drop visual. Show
   recipe, reserved materials, work progress, held/equipped distinction, recipient
   choice, proximity/capacity failure and camp/drop recovery. No empty placeholder
   tabs. Preserve compact mobile inspector, close/back and permanent appearance.
9. Bump engine/UI/cache pins together and world save schema explicitly as part of
   G1-B; proposed release number 0.6.0 avoids reusing the deferred cognition 0.5.1
   label. G1-A's separate sub-schema is 0.1.0, not a released game version.

## Verification boundaries

Local command: `node --test tests/possessions.test.mjs` (Node v22.16.0).
55 passed, 0 failed, 0 skipped. Source/test hashes are retained in
`docs/verification/possessions-g1-a.json`.

Coverage includes read-only preview/rejected command equality, timed payment and
output, repeated tick calls, missing engine context, reachability rejection,
child/dead/need checks, elder-rate adapter, material/output-slot reservations,
cancellation at full stock, equip/unequip, wrong/stale holder, proximity/capacity,
creator continuity, death cleanup at item cap, recoverable drops, deterministic
JSON copy/continuation, malformed data rejection and 1,000 full item-transfer
cycles without duplication. This does NOT prove engine `restore()` migration,
actual movement or time spent in the browser.

The 55 tests are new tests; do not add them to the earlier released 121-test count
and claim a fresh combined CI result without reading the exact new run.
Full unchanged Survival/Birth/Death/120-year/1800-year/browser/native-storage
checks remain release requirements. G1 also needs real engine tool/no-tool and
concurrent material-spend regressions. Physical Android remains separate.
