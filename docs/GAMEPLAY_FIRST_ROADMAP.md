# Simclone — Gameplay First / Character Life Roadmap

Planning revision: 2026-09-24 (Asia/Bangkok).
Source baseline reviewed: `c74319d431f300bed64aeba35dabc1d9b57e2568`.
Status: revised delivery plan; the new mechanics below are proposed work, NOT implemented features.

## 1. Direction change

ผู้ใช้ขอปรับแผนให้เพิ่มระบบเกมและสิ่งต่าง ๆ ให้ตัวละครก่อน แทนการเดินต่อไปที่ระบบความเชื่อ/สมองอย่างเดียว

**ให้ตัวละครมีชีวิตให้เล่นก่อน แล้วค่อยทำให้ฉลาดขึ้น**

เป้าหมายใกล้ตัว: ตัวละครมีของใช้ เครื่องมือ ที่อยู่ ที่นอน อาหาร กิจวัตร ความชอบ และคนที่มีปฏิสัมพันธ์ด้วย ผู้เล่นมองเห็นได้ว่าการเพิ่มสิ่งเหล่านี้เปลี่ยนชีวิตตัวละครอย่างไร ไม่ใช่เพียงเพิ่มช่องข้อมูลใน Inspector

This revision changes implementation order, not the long-term autonomous-society vision or its acceptance requirements. `GAME_PLAN.md` remains the original vision/backlog; use this document and `NEXT_STEPS.md` for delivery order when old future version headings conflict. G1–G5 are work packages, not runtime versions or release claims.

## 2. Existing foundations to retain

At the reviewed source revision, `src/engine.mjs` declares engine/save 0.5.0. It has HP/satiety/energy, four productive skills, lifecycle/lineage, historical identity, shared Food/Wood/Stone, camp/shelter, personal resource knowledge and explicit knowledge sharing.

Source basis: `AGENTS.md`, `GAME_PLAN.md`, `docs/STATUS.md`, `docs/KNOWLEDGE_MEMORY_0.5.0.md`, and `src/engine.mjs` at the revision above. A plan entry elsewhere is not proof that its proposed mechanic exists.

Keep all existing functionality. Knowledge recording/sharing stays available; this pivot is not a rollback. Its remaining limitation is unchanged: the current job planner is not yet fully restricted to personal knowledge.

## 3. New delivery order

| Gate | What the character gains | Playable outcome |
| --- | --- | --- |
| G1 — Possessions and tools | A bounded personal tool bag and one equipped tool | Make, carry, equip, use, unequip and transfer a stone axe; see a measured work-rate effect |
| G2 — Home and usable furniture | Home assignment, a sleeping place, furniture and storage | Return to a chosen shelter, use an available bed and retain possessions without losing identity |
| G3 — Production and meals | More tools, a workshop, one farming/cooking chain and repairs | Produce useful goods and improve meals through actual inputs, work and outputs |
| G4 — Daily life and individuality | Hygiene, recreation, social need, a few preferences and routines | Wash, relax, socialize and work for visible reasons; urgent survival still interrupts routines |
| G5 — Small social life | Familiar people, gifts, household ties and simple personal goals | Shared activities and transfers produce bounded relationship changes and observable choices |
| C1/C2 — Return to cognition | Re-observation, belief revision and knowledge-limited planning | Knowledge changes choices about the tools, homes and resources that already exist |

Do not start every gate together. Each gate must ship an engine action, visible world interaction, explanatory UI and regression evidence before opening the next major gate. Basic deterministic action selection is allowed throughout; advanced belief/planning work is deferred, not required to make a bed usable.

## 4. G1 — First implementation contract

### Player-visible loop

```text
Choose a living adult
→ order one stone axe at the existing camp
→ an eligible worker performs a timed crafting job
→ consume declared materials exactly once
→ place the unique axe in a personal tool bag
→ equip it
→ WOODCUT work progresses faster under the declared tool modifier
→ unequip / transfer to a nearby living person / store at camp
→ save and reload without duplication
```

The first tool is a **stone axe**. Baskets, pickaxes and building hammers follow after this loop is proven. A full workshop, durability, tool repair, clothing stats, money, trading and general resource hauling are NOT prerequisites for G1.

### Small scope

- A tool definition catalog plus uniquely identified tool instances.
- Proposed starting UI: four tool-bag slots and one tool slot. These are design defaults to validate, not existing limits.
- A minimal timed crafting action at the existing camp; no free instant item button. Recipe costs and crafting duration must be specified and tested in the implementation contract before code ships.
- Keep the existing four productive skill totals and provenance rules. Do not award a new crafting skill or attach invented XP to a crafting job.
- Equip/unequip, nearby handover and camp storage through authoritative commands. Storage/transfer requires declared proximity; equipment must not teleport across the map.
- Tool effect applies only to matching productive work. Start with work progress rate, not a simultaneous change to speed, yield and XP. The exact bonus and cap remain balance decisions to prove.
- Bare-handed work retains the current baseline. Old worlds and characters without tools must still survive; tools are an upgrade, not a new mandatory failure condition.
- Show bag contents, equipped tool, item location and the actual derived work-rate difference. Add a small tool visual without replacing permanent character appearance.

### Item invariants

A physical item has exactly one authoritative location: camp storage, one person's bag, or one dropped-item container. Equipping is a reference to an item already in that person's bag, NOT a second copy.

Separate `holder/location`, `equipped reference` and any future ownership claim. Formal private property and inheritance law are out of scope. Do not create two mutable inventory authorities.

Food/Wood/Stone remain shared stock in G1. Bags initially carry tools, not a second representation of the same shared material units. Any later movement of material into personal storage must debit the shared stock or source container atomically.

Manual CLONE and autonomous birth keep their existing skill inheritance rules but do NOT duplicate the parent's bag, tool or home claim. A new person starts with an empty bag unless an explicit, paid transfer supplies an item.

On death, release tool-use claims and move carried items into a dropped container at the death position. Retain a bounded historical note; do not delete physical items, keep them equipped on a dead worker, or silently gift copies to descendants. Automatic inheritance is later work.

Declare global item/container/save-size bounds. A full bag, full registry or storage budget must reject creation without spending materials or deleting existing property. Do not merely raise existing history/save limits to make the feature fit.

### Completion evidence

1. Craft preview and rejected commands leave authoritative state byte-identical.
2. A completed timed craft consumes its declared recipe once and creates exactly one item. Cancellation/refund/reserved-material behavior must be explicitly defined and tested; no spending reserved meals.
3. Equip/unequip preserves item count and respects exclusive holder/slot rules.
4. Controlled adult WOODCUT comparisons show the declared tool effect; unrelated jobs, zero-output XP and elder modifiers remain correct.
5. Transfers enforce proximity and capacity; stale or repeated commands cannot duplicate the axe.
6. Parent cloning/birth does not copy possessions; death leaves one recoverable item and no work reservation.
7. Save/load preserves item identity/location/equipment and deterministic continuation. Legacy migration adds empty bags without inventing past possessions.
8. Mobile and desktop Inspector/world visuals agree with engine state. Physical Android remains a separate test.
9. Existing unit, survival, birth, death, continuity/history and browser/storage gates remain mandatory and unchanged unless a separately documented gameplay contract genuinely changes their expectation.

## 5. G2 — Home and furniture

Start with existing shelters and exterior/anchor interactions rather than a new multi-floor interior simulation.

Introduce home assignment, a bed or sleeping mat, and a storage chest. Add a table/seat only when eating or resting can use it. A home label alone is not completion.

A home assignment, a bed assignment and current bed occupancy are distinct. Occupancy/reservations must be exclusive and derived from current action contracts; assigning a home does not guarantee that every furniture slot is available.

REST should prefer an eligible reachable assigned bed, recover energy according to a declared comfort modifier and fall back safely when no bed exists. Missing homes or furniture in old saves must not block baseline rest.

Do not silently change the current shelter population/birth capacity when adding beds. Any later change from building capacity to bed capacity needs its own migration and demographic proof.

Acceptance example: two people cannot occupy one bed simultaneously; one uses the bed while the other selects a valid alternative. Save/load, death and reassignment release occupancy correctly.

## 6. G3 — Production, food and maintenance

Expand the proven G1 loop to baskets/pickaxes/hammers, then add a workbench, one crop and one cooked meal. Each object must have an action and measurable use before another family is added.

A production chain is input reservation → work at the correct location → exactly-once output → delivery/use. It must handle interrupted jobs, full output storage and workers dying without double spending or free output.

Current `stock.food` is the baseline meal supply. Do not count it again as raw food plus cooked food. A raw/cooked representation needs explicit conversion, conservation of ingredient units, a declared nutrition rule and migration. Cooking benefits are a designed transformation, not free items appearing in both ledgers.

Only introduce durability after a repair/replacement path exists. Zero durability must have a defined fallback and must not trap a survival job indefinitely.

Work roles begin as preferences over available actions, not a new class tree or a claim that new skill families already exist.

## 7. G4 — Needs, preferences and routines

Extend the existing HP/satiety/energy model gradually. Introduce one new need together with an accessible object/action that satisfies it. Proposed first additions: hygiene with a washing point, recreation with a recreation spot, then social need with an explicit conversation action.

Comfort or mood should be derived from declared causes unless a separately designed persistence/smoothing contract requires stored state. Do not stack redundant meters without explaining their effects.

New soft needs initially affect comfort/preference rather than causing a new death spiral. Do not add thirst, disease, temperature damage or item breakage without a reachable remedy, migration defaults and emergency behavior.

Add a small set of visible preferences and deterministic work/rest/free-time priorities. Emergency eating and resting override a schedule. The game should work without per-person player micromanagement.

The existing compressed clock is 360 ticks = one simulated day = one biological year. Routine design must use that existing clock consciously; do not change aging or birth anchors to imitate a real 24-hour day in this milestone.

Acceptance example: comfortable characters choose different leisure/work options for disclosed reasons, but hunger or exhaustion interrupts those choices safely. Saved worlds resume the same routine decisions.

## 8. G5 — Small social life

Start with bounded familiarity/affinity changes from completed conversations, giving a real item, sharing a meal or helping with a real task. Add one simple personal goal such as obtaining a tool, improving a sleeping place or giving a gift.

Relationships and preferences must alter at least one observable choice; a list of labels or chat bubbles is not completion. Failed interactions do not award social credit. Gifts transfer the existing item rather than duplicating it.

Family/parent identity continues to use existing lineage. Household membership must not overwrite biological parent links. Romance, partnerships, complex families, money, markets, crime, factions and war remain later scope.

Basic affinity is not epistemic trust. An old resource claim is not automatically a lie; advanced trust/reputation remains deferred until belief verification is defined.

## 9. UI order

Put immediate life information before diagnostic cognition:

```text
Overview: portrait, needs, current action, home
Possessions: bag, tool and storage location
Skills/work: actual work effects and role preference
Social: only once relationships exist
Memory/knowledge/reasons: retain current diagnostic access
```

Do not show empty tabs as completed features. Preserve selected-person identity, compact mobile inspector, close/back behavior and unobscured world controls. Permanent face/colors remain identity; clothes and tools are separate overlays.

## 10. Deferred work and reuse policy

The former immediate V0.5.1 belief-revision and V0.5.2 knowledge-planning slots are parked as C1/C2. Multi-step goals, automatic teaching, cultural archive and complex trust follow tangible gameplay, not precede G1. Bug fixes to already shipped knowledge are still allowed.

AstraLife remains a future donor for evidence/observation/learning contracts, Kingdom-sandbox for later occupations/economy/society, and TestGE for transactional/replay patterns. These are study targets, not claims that their code can be copied unchanged. Re-read exact source/tests and adapt the smallest useful behavior when its gate is opened; do not merge whole engines or introduce a federation dependency for the first axe/bed.

No per-tick LLM calls. Do not remove validation, save protection, lineage resolution or deterministic testing in order to accelerate feature delivery.

## 11. Definition of progress

Each slice must answer: **What can the player now see a character own, use or do that was impossible before?**

Report three statuses separately: implementation, verification and deployment. Planning edits do not bump engine/UI/save versions, do not count as gameplay implementation, and do not imply a new release.

The original V1.0 autonomous-society proof is not waived. Existing 120/1800-year tests demonstrate their stated baseline contracts; they do not prove the new item/home/social systems or the whole future civilization simulation.

**Next implementation package: G1 only — personal tool bag + stone axe + equip/use/transfer/death/save loop.**
