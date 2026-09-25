---
type: success-contract
project: Simclone
domain: simulation
feature: Independent Clone World IC3
status: active
canonical: true
owner: Project Brain
validation: local-proof-complete-exact-ci-pending
last_reviewed: 2026-09-26
---

# IC3 — Independent lives, personal resources and homes

## Product contract

The public fresh-world profile starts independent people in different viable locations, without Camp or Shelter. Each productive person gathers into their own balance, makes their own workbench and Hammer, constructs a modular home, and uses their own home for rest and meals. A settlement is not a precondition. Social groups, trade and emergent settlements remain later features.

## Authority and persistence

| Domain | Single authoritative owner |
|---|---|
| Identity, lineage, work, needs | existing engine/lifecycle/history |
| Materials | legacy `s.stock`, OR independent `rustMaterials.personalStores`; never both |
| Physical crafted items and equipment | existing Rust possessions ledger |
| Craft inputs | committed exactly once by existing order acceptance |
| Site intention | bounded per-person `homePlan`, not a building or ownership record |
| Actual home and owner | existing modular geometry; first Foundation `placedBy` |
| Construction | existing BUILD scheduler → command → Rust PLACE_STATION |
| Public world totals | read-only sums, not a spendable account |
| Optional archive | existing bounded cultural archive; explicit owner-hosted house in independent mode |

Legacy worlds keep save version 0.5.0 and existing behavior. Independent worlds use 0.6.0 plus `worldMode: {kind:'independent',version:'IC3-1'}` and `rustMaterials.personalVersion:'IC3-materials-1'`. Independent balances contain ownerId, food, wood, stone and charcoal. Shared stock and shared charcoal must be zero. Missing/duplicate/negative/malformed owners or balances are rejected; no migration guesses private ownership. Old engines reject the new schema rather than treating private resources as communal.

The runtime/import compatibility family remains 0.5.0; content hashes identify the exact implementation independently of save schema. Reset/import preserves the original until explicit confirmation.

## Initial life and construction

`createWorld(seed,{mode:'independent',population})` supports 1–6 initial adults. Public bootstrap uses six; the solo Original scenario is also tested. Spawns are deterministic, walkable, separated by at least five Manhattan cells and near food/wood/stone. World-generation suitability is not granted as personal knowledge. Independent terrain removes the old camp-oriented road/resource-exclusion and forced central-node layout. Initial food28/wood24/stone12 is distributed exactly once; no house, table, Hammer or free building pieces are created.

New adults use the existing local knowledge planner. Homes and workbenches must be reachable using the existing navigation terrain. Personal construction runs by default in independent mode; full RP1 remains an explicit legacy policy. A bounded rotating coordinator issues existing Rust commands; a blocked person does not monopolize the world. Hunger, rest, lifecycle eligibility and the original task validator remain authoritative. A selected home site is retained as an intention so gathering does not move the home target on every tick. Intention collisions are checked against other living people; physical placement is still finally revalidated.

A person's workbench/Hammer/piece is not satisfied by another person's inventory. Foreign founding foundations cannot be joined to steal ownership. Helpers may place later pieces through normal validation without changing the original owner. A complete owned house is a survival target, not a generic global +6 admission slot.

## Children and later generations

Autonomous births do not use global housing capacity in independent mode. Existing resource costs, four-year global pacing, four-year parent cooldown, living-population and retained-history limits still apply. A specific eligible parent pays from their own materials; another person's balance cannot fund that birth.

A child derives a living productive ancestor as guardian from retained lineage. Food sharing requires the child to reach that guardian's actual position; if the guardian moves, the task replans. A child may rest in the guardian's owned home and cannot take adult productive/building work. On reaching productive age, the child pursues their own home. No invented guardian or second reproduction/household registry is created. Manual adult Clone creation remains distinct from birth: exact parent payment, inherited XP, and a valid separated spawn before commitment.

## Optional knowledge continuity

A complete home may host the existing one bounded public Cultural Archive. Its owner must explicitly create it nearby, paying private wood6/stone2. The host is identified by houseId and evidenced owner. Publication/reading still enforce range, evidence and bounded history; merely reading grants no XP or confirmed truth. Old Camp-hosted archives stay unchanged in legacy worlds. This is a knowledge host, not a mandatory central village or shared-material store.

## Interface

The world identifies the independent profile and does not advertise a starting village. Top resource values show the selected person's balance, or clearly labeled aggregate totals. The personal inspector exposes its own home, resources and current intent. House/station contexts identify their actual owner. Resource/drop/event taps use actual screen-space targets and existing command/evidence APIs. The new-world dialog makes the profile explicit; existing saves are not silently converted. Compact landscape controls remain reachable.

## Verification and limits

Implemented deterministic tests cover five fresh seeds, solo start, exact owner/material constraints, real house completion, real REST/EAT, child/guardian eligibility, save/load/batch continuation, schema rejection and legacy compatibility. A separate untouched 120-year seed230926 proof checks founders housed, Original age death, descendants and descendant homes, zero shared stock and deterministic continuation. Browser tests use an earned 1,400-tick fixture with no prebuilt houses/free items; canvas taps, ownership, saving/restoring and responsive layout are tested.

Evidence scopes are separate: Node simulation; offline Chromium/Storage double; native HTTP/storage; exact public Pages; physical Android/GPU/performance. Never infer one from another. New CI steps add the 120-year proof and independent UI/native tests while retaining old gates. Send the run URL without polling.

Bounds remain 36 living people, retained identity budgets, finite 30×26 terrain, four bag slots and 512 stations for independent worlds (64 legacy). This is not unlimited civilization. Private raw balances of dead people remain attributed and conserved but are not automatically inherited/traded; no cohabitation, trust, trade, property transfer or settlement-formation system is claimed. Unknown legacy owners remain unknown, never guessed.

Exact candidate CI and exact-main deployment/public checks are still required before release. UNKNOWN is never PASS.
