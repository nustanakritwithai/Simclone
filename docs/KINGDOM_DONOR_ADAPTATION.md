---
type: gdd
project: Simclone
domain: simulation
feature: Kingdom Sandbox Donor Adaptation
status: active
canonical: true
owner: Project Brain
validation: implementation-in-progress
last_reviewed: 2026-09-26
---

# Kingdom Sandbox → Simclone Donor Adaptation

Donor repository: `nustanakritwithai/Kingdom-sandbox`

## Migration principle

Reuse Kingdom's **system semantics and proven gameplay structures**, not its world assumptions.

Kingdom starts with settlements/factions/rulers. Simclone remains individual-first:

```text
Individual
→ Home
→ Household
→ Household economy
→ Followers / organization
→ Cooperation / trade
→ Neighborhood
→ Community
→ Settlement / faction
```

Do not reintroduce a mandatory central settlement.

## Donor system inventory

Kingdom runtime exposes major systems including:

- NeedSystem
- WorkSystem
- EconomySystem
- LaborMarketSystem
- AgentMemorySystem
- AmbitionSystem
- OrganizationSystem
- WarbandSystem
- MarketTradeSystem
- LogisticsSystem
- RouteSecuritySystem
- GovernanceSystem
- FactionLeadershipSystem
- DiplomacySystem
- SovereigntySystem
- CourtSystem
- MilitaryNeedSystem
- CampaignWarfareSystem
- TextCombatCore
- LargeBattlefieldSystem
- ObserverSystem

## Adaptation map

| Kingdom semantic | Simclone adaptation | Gate |
|---|---|---|
| Agent skills incl. leadership | Clone social skill `LEADERSHIP` with provenance | IC6D |
| relationship / loyalty gate for followers | IC6A trust/affinity/respect evidence gate | IC6D |
| leader selection via leadership + tactics | future organization leader selection via Leadership + relevant skill | IC8 |
| organization memberIds / leaderId | emergent Household → Organization projection/authority | IC8 |
| recruitment offers | follower/cooperation offers between independent Clones | IC7/IC8 |
| settlement stock/economy | **household resource pools** keyed by house | IC6C |
| village demand/scarcity | household demand/scarcity | IC6C/IC7 |
| labor offers | household/organization work requests | IC7 |
| market trade | trade between household stores | IC7 |
| logistics/supply | household → organization supply | IC8 |
| ambition | later personal ambition goals; do not invent random trait in IC6 | later |
| sovereignty | derived only after neighborhoods/organizations can control space | IC8+ |
| diplomacy | organization/faction relations after organizations exist | IC8+ |
| court/governance | settlement/faction governance after emergence | later |
| warbands/combat | optional later organization combat layer | later |

## IC6C — Household economy

Replace the current independent-mode material spending authority:

```text
personal store per person
```

with:

```text
homeless person
→ temporary personal store

complete home / household
→ one household store keyed by houseId
→ owner + dependents + explicit cohabitants read/write the same pool
```

Physical bag items and equipped tools remain personal.

### Resource ownership

Household pool owns:
- food
- wood
- stone
- charcoal

Individual owns:
- bag item instances
- equipped tool
- skills
- knowledge/memory
- relationships

### Transition rules

- When a home becomes complete, the founder's temporary raw balance moves atomically into the new household store.
- When an adult joins a household, their temporary raw balance moves atomically into that household store.
- Leaving a household does not split the household store. The leaver returns to an empty temporary personal balance and can gather again.
- Children consume from guardian household resources when available.
- World totals remain read-only aggregate views.

No resource may exist in both personal and household ledgers at once.

## IC6D — Leadership / followers

Kingdom donor semantics confirmed:

- `leadership` is a real agent skill.
- organization/warband formation is gated by leadership/ambition plus available followers.
- followers require relationship/loyalty toward the leader.
- leader selection uses leadership plus a domain skill such as tactics.

Simclone adaptation:

- add `skills.LEADERSHIP` as a social skill with normal provenance;
- it is **not** an action preference/profession;
- adult follower eligibility still requires IC6A relationship evidence;
- leadership controls maximum explicit adult followers in the owner's household;
- guardian/dependent children do not consume follower slots.

Initial capacity:

```text
Leadership level 0 → 1 adult follower
Level 1 → 2
Level 2 → 3
Level 3 → 4
Level 4 → 5
Level 5+ → 6
```

Successful first-time `JOIN_HOUSEHOLD` is authoritative leadership practice and awards Leadership XP to the host.
Repeated/idempotent JOIN never awards XP twice.

Relationship evidence and Leadership are separate:
- high leadership cannot force an unwilling follower;
- strong relationship cannot exceed host follower capacity.

## Systems deliberately not copied yet

Do not port Kingdom's settlement, faction, tax, ruler or sovereignty state ahead of emergence.

These systems become eligible only after:
1. households exist;
2. household economy exists;
3. cooperation/trade exists;
4. neighborhoods can be derived;
5. organizations can emerge from actual people.

## Evidence rule

Every donor adaptation must be tagged as one of:
- semantic reuse;
- Simclone-specific adaptation;
- intentionally deferred;
- rejected because it reintroduces colony-first authority.

UNKNOWN is never PASS.
