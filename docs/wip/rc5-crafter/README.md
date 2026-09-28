# RC5.0 — Builder → Crafter / Masterwork foundation

**DESIGN MODEL + TESTS ONLY. NOT PRODUCTION. KEEP DRAFT / DO NOT MERGE.**

User goal: develop the construction profession into a skilled item maker, able to
produce higher tiers and improve the chance of high-quality work through practice.

## Exact source audit

- Repository: `nustanakritwithai/Simclone`.
- Audited main: `1b60b13394c11bd7b03d10227919f4bb509b02df` (merged RC3.2 #174).
- RC4 #194 is OPEN / DRAFT / UNMERGED at the audit snapshot.
- Observed #194 head: `44e61dec7ad42c41e77a9198a234c6da43e9eedb`.
- Its body references evidence for `e615c2fbff7d26bd0d04e8ac4d2d381758cfa75c`.
  That is a different SHA. This work makes no RC4 exact-head or production SAT claim.
- `AGENTS.md`, `GAME_PLAN.md`, `docs/STATUS.md`, `docs/NEXT_STEPS.md`, RC2
  contracts, and the canonical craft/knowledge/profession code were consulted.
  Historical document headings do not override the actual main ref.
- No other agent branch was changed. No donor was merged or cherry-picked.

Current scope: this directory, `tests/rc5-crafter-model.test.mjs`, and
`verification/rc5/foundation-evidence.json`. NO `src/**`, engine, profession,
import-map, workflow, package, material, housing or persistence edits.

## Success Contract and honest verdicts

The foundation is successful when the proposed progression has no circular tier
lock, retains starter access, separates output-family expertise, has bounded and
explainable quality odds, and cannot write production state.

`modelVerdict: SAT` means only that a rule calculation passes for hypothetical
inputs. It NEVER means qualification provenance, integration or release is SAT.
Every decision also has `scope: DESIGN_MODEL`, `productionVerdict: UNKNOWN`, and
`commitAllowed: false`. Even a perfectly forged model input cannot mint an item,
promote a person, certify receipts, or authorize a production command.

The model intentionally does not import production code. Tests import the actual
canonical catalog and RC2 outcome functions to check compatibility/isolation.
Do not import this prototype into `src/**` as a hidden adapter. Port only accepted
rules into the existing owners after the integration gates below are closed.

## Gameplay decisions

Builder remains the construction profession. Crafter is a later explicit
productive profession, not a replacement for every person's ability to survive.
Use existing `adoptProfession()` for any eventual change. Do not overwrite
Merchant or Adventurer; ordinary resource work must not demote a qualified Crafter.

No `craftXP`, persisted `craftLevel`, inventory, item, money or recipe authority is
introduced. Grade is a read-only projection of validated existing recipe mastery,
including canonical retired completion counts. Blueprint/teaching grants knowledge,
not completed work. Owning or buying somebody else's item grants no mastery.

### Same-family grades — initial balance model, not released constants

| Grade | Required cumulative work in ONE output family | New maximum tier |
|---|---|---|
| Apprentice | No additional requirement | T2 for Builder/Crafter |
| Crafter | At least 6 completions, including 2 at T2 | T3 |
| Expert | Crafter requirements + 16 total, including 4 at T3 | T4 |
| Master | Expert requirements + 32 total, including 6 at T4 | T5 |

MASTER does NOT require an existing T5 item or a lucky Masterwork roll. The first
T5 is therefore reachable. A bounded HAMMER progression test uses the real catalog's
recipe-unlock prerequisites to prove the model has a path to its first T5. This is
not a real-world materials, navigation, lifetime or production proof.

Output families remain exactly `STONE_AXE`, `STONE_PICKAXE`, `HAMMER`,
`EMBER_BLADE`, `HIDE_ARMOR`, `EMBER_CHARM`. Toolsmith/Weaponsmith/Armorsmith/Artificer
are display groupings, NOT shared XP pools. A Master Hammer maker can still be an
Apprentice Sword maker. The model rejects tier-zero completion evidence for
families whose canonical recipes start at T1.

T0/T1 survival recipes remain available to any eligible person who knows them.
The NEW_WORLD model permits T2 to Builder/Crafter, T3 to Crafter, T4 to Expert,
and T5 to Master in the requested family. Recipe knowledge, physical ingredients,
station access and task constraints remain independently necessary.

Construction qualification is NOT proven merely by a profession label, a house
ownership claim, inherited BUILD XP or a caller's `verified: true`. A canonical
construction-evidence projection is still an explicit integration blocker.
The model's `construction: PRESENT` is hypothetical fixture data, not an attestation.

### Quality model

Crafting still produces an item through the existing successful completion path;
this proposal adds no random material-destroying failure, paid roll or reroll UI.

For one family and requested tier:

```
mastery = min(65535, sum(existing per-recipe completion counts in that family))
bonus = Apprentice:0 / Crafter:5 / Expert:10 / Master:15
floor = clamp(30 + min(40, 2*mastery) + bonus - 3*tier, 30, 80)
ceiling = min(100, floor + 30)
modelQuality = floor + suppliedUint32Roll % (ceiling - floor + 1)
```

Grade is derived inside the model; passing `grade: MASTER` cannot grant a bonus.
A Master T5 example has a 70..100 window: 11 of its 31 quality values are 90+.
`qualityOddsModel()` computes exact modulo bucket weights UNDER the assumption of
uniform uint32 input. That is a mathematical model, NOT measured hash uniformity,
production drop-rate evidence, balance approval or an assertion of live behavior.

Bands: Rough 30–49; Standard 50–64; Fine 65–79; Superior 80–89;
Masterwork 90–97; Exceptional 98–100. Quality and recipe tier remain different.
A quality label never changes an item's material kind, tier, stats or authority.

The eventual quality change belongs in the existing `craft-outcome.mjs`, reusing
its deterministic ticket and named channels. No new RNG or item factory is allowed.
Existing functional ability consumers and caps remain authoritative. Do not promise
unsupported effects such as durability or critical gather chance.

## Compatibility rules — mandatory before enabling anything

1. Keep the exact RC2-order/1 and RC2-outcome/1 evaluators for existing orders and
   items. A changed formula under the same version would invalidate old saves.
   Old in-flight work must finish under its originally frozen version and ticket.
2. New orders must freeze the approved rule version and validated mastery/grade
   snapshot at acceptance. UI timing, unrelated jobs and save/load must not reroll
   an accepted order. Cancel/requeue economics require a separate explicit test;
   ordinary deterministic replay is not proof against every pre-order save-scum.
3. Existing learned recipe permissions must not be silently revoked. Keep legacy
   gameplay behavior until a canonical one-time grandfather/migration contract is
   implemented and verified. Never accept a client `legacyGrant` flag. This model
   returns UNKNOWN for legacy-policy requests and does not activate a live gate.
4. Legacy items without craft metadata stay legacy/unknown. Do not assign them a
   retroactive quality, creator, completion count, grade or fictional achievement.
5. Do not derive lasting qualifications from an expiring local receipt list.
   Reuse canonical receipt watermarks/retired counts. Item sale, placement,
   consumption, receipt compaction, archival and save/load must not erase earned
   mastery or count the same work again.
6. Do not block the production of basic house parts or the food/birth reserve
   requirements. Do not add quality as housing capacity/completion authority.

## Wiring ownership after RC4 production release

| Concern | Read from | Sole writer / permitted path |
|---|---|---|
| Recipe knowledge and family practice | `craft-recipe-knowledge.mjs`, validated receipts | Existing recipe completion / teaching / Blueprint paths |
| Construction qualification | Canonical construction provenance; owner must define exact durable evidence | Existing Housing/BUILD owner; no invented event ledger |
| Profession | Existing profession + validated current-root qualification | `kingdom-utility.mjs` / `adoptProfession()` |
| Acceptance and spend | Current recipe, knowledge, capability, physical items/materials/station | Existing `checkCraft` → `queueCraft` |
| Work and position | Existing task/order and navigation state | Existing engine executor, no teleport |
| Quality and abilities | Frozen accepted-order spec | Versioned existing `resolveCraftOutcome()` |
| Item + creator + mastery completion | Current completed Rust order | Existing `advanceCraft()` completion boundary |
| UI | Read-only canonical profile/item projections | Validated commands only; no supplied quality/grade/receipts |
| Trade, prices and accounts | Exact physical item identity and existing RC4 authorities | RC4 Trade / Pricing / Ledger owners, not Crafter |

Never certify a caller-supplied snapshot or public calculator result as live-root
provenance. UI/AI payloads contain intent and canonical identifiers only. Trusted
orchestration must re-read and validate the exact current root before committing.

## Integration blockers — UNKNOWN is never PASS

| Gate | Owner | Required proof | Current |
|---|---|---|---|
| G0 RC4 production baseline | RC4 release owner | Exact merged SHA, Verify, Pages, public exact bytes + accepted RC4 gates | HOLD |
| G1 Canonical qualification projection | Crafter + Housing/Knowledge owners | Real construction and craft evidence; false/inherited/forged/compacted evidence cases | UNKNOWN |
| G2 Career and tier wiring | Profession + Rust owners | `adoptProfession` only; special locks; real first-T5 path; no counters spoofing | UNKNOWN |
| G3 Versioned quality | Existing outcome owner | Old versions byte-stable; actual new order freeze; deterministic replay and ability consumers | UNKNOWN |
| G4 Persistence and legacy permissions | Persistence owner | One-time migration, reload, old in-flight work, corruption, no rerolls | UNKNOWN |
| G5 UI and bounded autonomy | UI/policy owner | Native desktop/mobile real clicks, no survival reserve regression, policy emits intent only | UNKNOWN |
| G6 Merchant integration and release | Integration/release owners | Real produced item traded without identity/quality loss; exact-head and exact-main gates | UNKNOWN |

While G0 is HOLD, stay within this isolated design/test scope. Re-read current main,
all active owner branches and Success Contracts before any later runtime work.
Do not merge #175 or #194 as a shortcut for this feature. Do not change their heads.

## Agent execution order

After G0: freeze the new production SHA → G1 evidence contract/projection → G2 career
and tier gate → G3 quality versioning → G4 persistence → G5 inspector/autonomy →
G6 real Crafter → Merchant → Customer proof. One runtime integration owner coordinates
shared `engine.mjs`, `kingdom-utility.mjs`, Rust completion and persistence edits.

First playable slice: one real Builder earns Crafter through canonical work, learns
and produces a permitted higher-tier tool, gets a stored quality and `createdBy`,
equips it, and reloads without changing those facts. Then prove a reachable T5 chain.

Adversarial acceptance must include dead/child, locked special professions, forged
receipt + matching snapshot, unrelated-family mastery, bought-item attribution,
unknown recipe, missing station/materials, competing reservation, duplicate order,
long-horizon replay after receipt compaction, invalid version and old-save cases.
Blueprint knowledge is not mastery. Candidate fixtures are not autonomous lifetime
or economic sustainability evidence. Those claims require independent proofs.

## Verification

```
node --test tests/rc5-crafter-model.test.mjs
npm test
```

The first command is the focused model/catalog/outcome test suite. The second is
the repository's unchanged complete regression command and runs automatically in
existing candidate CI. No CI gate was moved, weakened or removed.

Local focused results and exact source blob pins are recorded in
`verification/rc5/foundation-evidence.json`. Full repository CI, native/public
browser proof, production adoption, migration and integration are NOT claimed by
this foundation. Inspect exact-head Actions before accepting even this donor.
