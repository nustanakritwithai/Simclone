# RC5 Career Coexistence — repair and handoff

Date: 2026-09-29. Base: `ea63cd7584f169b630b7c29b21b7fc18e2e6f80b`.
Verdict: **LOCAL REPAIR SAT; RELEASE UNKNOWN.** No public deployment claim.

## Finding and Success Contract

The new Crafter profession was locked by the profession authority but absent from RC4's qualification projection, autonomous Merchant candidate filter, and explicit Home Market preparation guard. A real Crafter could be nominated, have a Home Market created, then fail promotion, leaving an unwanted market.

Acceptance: Crafter cannot qualify for or be nominated to Merchant; rejected preparation and promotion are state-stable; ordinary eligible workers still enter Merchant; Crafter can sell physical goods to Merchant without a personal shop; item identity/creator/quality and total currency survive settlement and save/load; Tier UI reflects the active permission contract and has no state writes.

## Changes

- `src/rc4-market-runtime.mjs`: three eligibility guards only. No new authority, scheduler, wallet, item or profession writer.
- `src/crafting-ui.mjs`: replace obsolete migration-only message with active Tier/grade and grandfathering explanation.
- `index.html`: regenerated 129 existing module pins from actual bytes.
- `tests/rc5-career-coexistence.test.mjs`: six reproducible cross-career checks, including a real crafted Hammer sale through BuyOffer + canonical travel + atomic trade.
- `docs/CAREER_SYSTEM_WORK_PLAN.md`: dependency-ordered remaining work with explicit ownership and stage status.

This does not implement the already-merged #208 again. Its Crafter, grade, quality and bounded RP1 progression code is retained unchanged.

## Verification actually run

Red control: the new six-test file against unrepaired merged-main runtime/UI produced **4 fail / 2 pass**. Restoring only the small repair produced **6/6 PASS**.

The following exact scoped command produced **362 tests / 362 pass / 0 fail / 0 skipped**:

```sh
node --test tests/crafter-career.test.mjs tests/masterwork-outcome.test.mjs tests/crafter-autonomy.test.mjs tests/crafter-tier-policy.test.mjs tests/rc5-career-coexistence.test.mjs tests/craft-outcome.test.mjs tests/rc3-metal-economy.test.mjs tests/rc4*.test.mjs tests/merchant*.test.mjs tests/governance*.test.mjs tests/governor*.test.mjs tests/cache-pins.test.mjs
```

Existing real-button Chromium tests completed separately:

```sh
python tests/rc2-crafting-smoke.py --width 1440
python tests/rc2-crafting-smoke.py --width 390
```

Each reported `mode=offline`, `checks=24`, `result=SAT`. Screenshots were inspected at desktop/mobile sizes. These test crafting/equipment/teaching/bounded training/save-load regressions, not a public RC5 end-to-end economy.

`npm test` was attempted on the exact-main Pages artifact plus repair. It did not complete within the 200-second local execution budget. The artifact excludes `.github/workflows`, so its Blueprint workflow-preservation check also reported ENOENT for `.github/workflows/verify.yml`. This is **not** a passing full regression and is **not** evidence that the actual repository lacks that workflow. No test or workflow was weakened, removed or edited.

Native HTTP browser proof was attempted and blocked by `net::ERR_BLOCKED_BY_ADMINISTRATOR` at localhost. Native/public gates therefore remain UNKNOWN here; offline success is not substituted for them.

## Reproduction boundaries

The fixtures prepare initial stocks/needs explicitly. Homes, tables, craft completions, qualification and output items use existing authorities. A negative-control actor is marked Adventurer solely to isolate candidate selection. The positive Crafter is never assigned directly: it earns real same-family completions and passes `RC5_BECOME_CRAFTER`.

The test sale is a proof of canonical compatibility, not an autonomous free-running economy: commands initiate the BuyOffer and purchase, and the existing test helper executes real travel. Its item keeps ID, createdBy and the complete frozen craft record; money is conserved. Parent RP1 autonomy demonstrates a bounded single-T5 showcase from a prepared qualified Crafter, not demand-responsive manufacturing from a new world.

## Release and next owner

Inspect exact candidate Verify, full npm and all retained RC2/RC3/RC4/Adventure/browser gates before merge. Then capture exact merged-main SHA and require Verify, Pages, deployed-byte and public-browser evidence. UNKNOWN must not pass. After pushing, provide the Actions URL once and do not poll unless the user asks, per AGENTS.md.

Next implementation contract: ER0 raw-resource representation and ownership, then actor-observed demand and reserve-aware production. Builder pre-qualification career competition, a demand-based Merchant bootstrap, full stock/resell automation and Governor economic extensions remain open. See the execution board; this delivery does not mark all Career/Economy V1 phases complete.
