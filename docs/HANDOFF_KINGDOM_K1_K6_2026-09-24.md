# Simclone — Kingdom Sandbox Integration Handoff

Date: 2026-09-24
Stop point: Kingdom K1–K6 merged to main
Main at handoff: 84a78d7caa98c414312180ccc6084875205ee7db

## Product direction

Simclone remains an autonomous society / survival / colony simulation. Kingdom-sandbox is a donor system, not a replacement engine. Simclone keeps authority over deterministic stepping, lifecycle, pathing, reservations, save/history, skill provenance and personal knowledge.

## Completed Kingdom slices

### K1 — Occupation + Utility
- professions: forager, woodcutter, miner, builder
- bounded career history
- Kingdom utility factors retained as explainable shadow evidence
- deterministic jitter replaces donor Math.random
- profession follows productive work that actually wins Simclone validation

### K2 — Settlement Economy (shadow)
- village demand for food / wood / stone
- scarcity ratio 0.25–6
- labor premium 1.0–1.8
- specialization counts/shares
- high-pressure/missing-role signals

### K3 — Production + Labor (shadow)
- skill productivity multiplier
- hunger/satiety penalty
- occupation crowding
- lifecycle work-rate factor
- effective worker units and labor gaps
- tool multiplier intentionally remains ×1 until possession/tool integration

### K4 — Labor Market Proposal (shadow)
- specialist offers for woodcutter / miner / builder
- donor shortage threshold > 1.2
- quantity-needed cap
- priority and urgency
- no persistent recruitment, wages or forced reassignment

### K5 — Bounded Labor Authority
- first Kingdom signal allowed into authoritative task score
- WOODCUT / MINE / BUILD only
- hard cap +6
- disabled during hunger/exhaustion emergencies
- EAT / REST / FORAGE receive no K5 labor bonus
- path, lifecycle, reservation and resource gates remain authoritative
- verified PR #19 was merged before this handoff

### K6 — Shadow Market
- base-price analogues: food 10, wood 8, stone 15
- price curve: base × scarcity^0.75
- scarcity bound 0.25–6
- final price bound 0.3×–6× base
- UI shows shadow prices and hottest good
- no money, treasury, tax, wages, buying/selling, trader or caravan authority

## Verification history

Important regressions found and kept as gates:
1. Early authoritative K1 changed the historical archive boundary. The baseline was not weakened; K1 was returned to shadow-first behavior.
2. Adding Kingdom cards exposed a brittle Survival UI selector. The smoke test was fixed to target the primary survival summary instead of DOM order.
3. K6 tests initially assumed the price floor/ceiling must be reached. They were corrected to the actual Kingdom formula: at scarcity 0.25 food is 3.54; at scarcity 6 food is 38.34. The 0.3×/6× values are bounds, not forced outputs.

K1 and K2–K4 main verification passed before later merges. K5 candidate verification passed before merge. At this stop point the final K6 merge has triggered a fresh main GitHub Actions/Pages run; treat deployment as pending until that exact main run is green.

## Current authority map

Simclone authoritative:
- deterministic world tick
- survival emergency priority
- lifecycle / age eligibility
- path reachability
- task reservations
- stock mutation
- gather/build execution
- XP + skill provenance
- knowledge provenance
- save/history/archive validation

Kingdom authoritative:
- K5 bounded labor score only, max +6 on specialist productive work

Kingdom observational/shadow:
- K1 utility evidence
- K2 demand/scarcity/labor premium
- K3 productivity/crowding/labor gap
- K4 labor offers
- K6 market prices

## Explicitly not implemented

Do not claim these exist:
- money / personal wealth
- treasury
- wages
- taxes
- real buying/selling
- trader/caravan economy
- multiple settlements
- factions / governance / rebellion
- military / bandits
- persistent recruitment organizations
- Kingdom production multipliers changing actual harvest/build output

## Recommended next milestone

Do not start TraderSystem yet. Simclone currently has one settlement, so trade would have no meaningful origin/destination economy.

Recommended sequence:
1. verify exact final main + Pages after K6
2. establish multi-settlement identity/data contract
3. add settlement-local stock/demand/market projections
4. add route/travel contract between settlements
5. only then extract Kingdom trader/caravan flow
6. keep money/tax/faction as later independent gates

## Source / project links

Repository: https://github.com/nustanakritwithai/Simclone
Live: https://nustanakritwithai.github.io/Simclone/

## Restart instructions for next chat

Before editing:
1. read AGENTS.md
2. read docs/STATUS.md
3. read GAME_PLAN.md
4. read this handoff
5. inspect current main SHA
6. inspect latest GitHub Actions and Pages deployment
7. trust repository/current CI over this handoff if they differ
8. preserve existing verification gates; do not rewrite baselines to make new behavior pass

Work is intentionally stopped after finalizing K1–K6 and triggering final main deployment verification.
