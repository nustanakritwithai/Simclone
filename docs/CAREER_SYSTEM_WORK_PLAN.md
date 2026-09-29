# Simclone Career System — execution board

Reference: main `ea63cd7584f169b630b7c29b21b7fc18e2e6f80b`, 2026-09-29.
This board separates existing implementation, this repair, and unimplemented work. UNKNOWN is not PASS. Re-read main/open PRs before the next change.

## Product structure

Raw producers remain Forager / Woodcutter / Miner. Builder is the base manufacturing career and qualifies into the existing canonical `crafter` profession. Expert/Master are derived same-family capability grades, not new professions or another XP ledger. Merchant and Adventurer remain separate special professions. Governor remains an existing social office over a productive profession, not a new profession, inventory owner or resource writer.

## Completed work in this delivery

| Step | Result | Evidence / boundary |
|---|---|---|
| Inspect current source and concurrent work | DONE | #208 merged during this audit; repair rebuilt on exact merged main above |
| Reuse Builder -> Crafter / Tier / Quality / bounded autonomy | EXISTING, locally verified | These are #208's implementation, not newly authored here |
| Reproduce cross-career bug | DONE | Six new checks against unrepaired main: 4 fail / 2 pass |
| Protect Crafter from Merchant bootstrap | DONE, local SAT | Qualification, candidate selection and explicit market preparation agree with the canonical lock |
| Retain actual Producer -> Merchant trade | DONE, local SAT | Real crafted item, BuyOffer, travel, atomic payment, creator/quality retained, save/load |
| Correct active Tier text | DONE, local SAT | T0-T2 existing permissions; T3 Crafter / T4 Expert / T5 Master; only migrated recipes grandfathered |
| Targeted regressions | SAT | 362/362 tests; full command in repair handoff |
| Offline desktop/mobile crafting regressions | SAT | 1440px: 24 checks; 390px: 24 checks; not native/public deployment proof |
| Full repository / exact-head CI / production release | UNKNOWN | Not replaced by scoped tests. No merge or release is authorized by this report |

## Remaining implementation sequence

1. **Release this small coexistence repair.** Inspect exact candidate Verify including full npm and all existing browser gates. Merge only after exact-head SAT, then require exact-main Verify, Pages, deployed bytes and public browser proof. Preserve all existing gates.
2. **ER0 — representation and ownership contract.** Audit raw food/wood/stone/metal counters versus Rust item-instance trades. Specify how actual bulk resources can transfer through their existing owner without minting fake item instances, a second stock ledger, or silently expanding the current item-only Trade Kernel. Close this before claiming Miner -> Crafter raw-material sales.
3. **ER1 — observed demand projection.** Reuse existing market observation/BuyOffers/household needs. Output read-only, actor-scoped signals with origin, observed tick, expiry and units. Hidden or stale listings cannot become global knowledge. No purchases, career writes or global economic truth ledger.
4. **ER2 — producer reserve and surplus.** Compute saleable amounts after personal/household consumption and active reservations; revalidate when committing. Prove shortage, dependent household members, competing sales and save/load. No stock writer outside the existing resource authority.
5. **ER3 — demand-driven manufacturing.** Separate market production from the existing RP1 one-T5 training showcase. Use known demand -> valid recipe/grade -> affordable inputs -> real procurement -> station path -> ordinary accepted craft order -> output -> sale intent. One bounded obligation at a time; survival, housing and accepted work take priority.
6. **ER4 — Merchant stock loop.** Connect existing known-demand policy to canonical BuyOffer/Listing/travel/trade execution. Prove return-to-home stock handling, insufficient funds, unavailable goods, unsold stock and no duplicate settlement. Replace the current population-based bootstrap target only under an explicit demand-opportunity contract.
7. **ER5 — Adventurer purchasing and use.** Start with actual supported equipment needs and use/equip authorities. Food, medicine, durability and replacement sinks require their own explicit contracts where absent; do not invent consumption to balance tests. Prove no remote purchase, affordability, gear ownership, and loot returning to market.
8. **ER6 — career opportunity and anti-thrashing.** Use observed shortages and meaningful unmet demand. Address Builder commitment BEFORE Crafter qualification: this repair protects existing Crafters only. Do not permanently forbid all Builders from trade or change special-career locks without a deliberate transition contract. No random career allocation, forced quotas or fake qualification.
9. **GOV-E1 — extend existing Governor signals.** Keep existing leadership, household, settlement and office authorities. Governor may publish bounded incentives based on legitimate evidence; it cannot directly change profession, task, resources or wallets. Survival priorities remain authoritative.
10. **ER7 — complete autonomous economy acceptance.** At least four distinct actors: raw Producer, Builder-derived Crafter, Merchant, Adventurer. Prove actual input transfer -> crafting -> merchant purchase/resale -> equipment/use -> loot resale; then multiple cycles without manual career assignment. Add no-Merchant, scarce cash, blocked route, full bag, death, replay and save/load attacks. An item keeps its identity through trades; crafting consumes inputs and creates a new output with an auditable provenance chain, not the same input item ID.

## Work ownership

Career/grade owner preserves `adoptProfession` and existing mastery. Resource/trade owners resolve ER0 jointly before raw-resource trading. Demand/production policy owner creates intents only. Merchant/customer owner routes execution through canonical market/navigation/trade. Governance owner extends the existing office. Acceptance owner may write tests/fixtures but may not weaken runtime rules to pass.

Release order is dependency-based, not six agents editing `engine.mjs` simultaneously. Every phase needs an exact Success Contract, bounded diff, attack evidence, exact-head CI and post-merge proof. Keep the next phase blocked when its prerequisite is UNKNOWN.
