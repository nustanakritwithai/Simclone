# RC5.1 — Crafter Career G1/G2 Success Contract

Status vocabulary: **SAT / VIOL / UNKNOWN**. UNKNOWN never passes.

## Baseline

- Work starts from production main `ec8709f6c6543ee76dba97f11d52beebefc307e0`, after RC4 Merchant Economy closeout.
- RC5 model PR #195 is a read-only design donor and is not merged into this branch.
- This slice changes profession qualification/wiring only. It does **not** activate the
  proposed T3–T5 restriction or the new Masterwork quality formula yet.

## Player behavior delivered by this slice

A living productive **Builder** can become **Crafter / ช่างประดิษฐ์** only after:

1. the current canonical profession is `builder`;
2. the Clone owns an **existing completed personal modular home** projected by
   `homeOf(..., {completeOnly:true})`;
3. canonical recipe knowledge validates; and
4. one output family has at least **6 verified completions**, including at least
   **2 T2 completions**.

No `craftXP`, `craftLevel`, second recipe ledger, second item ledger or
caller-supplied qualification record is added.

The engine checks promotion after a real craft completes. A failed/UNKNOWN check is
a no-op. A qualifying completion routes the transition through the existing
`adoptProfession()` authority and appends the existing bounded career history.

## Authority locks

- Profession writer: `src/kingdom-utility.mjs` / `adoptProfession()`.
- Crafter qualification: `src/crafter-career.mjs`, reading the current live root.
- Construction truth: `src/individual-housing.mjs` projection from existing placed
  modular structures. Crafter does not create a building record.
- Mastery truth: `src/craft-recipe-knowledge.mjs` verified bounded receipts and
  retired counts. Crafter does not create completion evidence.
- Item truth remains Rust possessions.
- Merchant/Adventurer/Crafter are mutually locked special professions in this slice.
- Ordinary FORAGE / WOODCUT / MINE / BUILD selection cannot demote a Crafter.

The public command is `RC5_BECOME_CRAFTER {agentId}`. It accepts identity only.
Fields such as `verified`, `homeId`, `mastery`, `grade` or `evidenceId`
cannot be supplied to the command as proof.

## Family projection

The profile is derived independently for STONE_AXE, STONE_PICKAXE, HAMMER,
EMBER_BLADE, HIDE_ARMOR and EMBER_CHARM.

V1 projection levels retained from the accepted model:

- Apprentice → max proposed new tier T2
- Crafter: 6 total + 2 T2 → T3
- Expert: prior gate + 16 total + 4 T3 → T4
- Master: prior gate + 32 total + 6 T4 → T5

Only the **Crafter qualification gate** is active in this PR. T3–T5 enforcement is
still HOLD until the legacy learned-recipe migration contract is proven.

## Required attacks / regression checks

- unknown / malformed recipe evidence never qualifies;
- held, bought or dropped items never count as craft mastery;
- another person's house does not satisfy construction evidence;
- forged command payload evidence is rejected before mutation;
- qualification replay does not duplicate career history;
- save/load retains Crafter through the existing profession/career fields;
- Merchant and Adventurer are not overwritten;
- ordinary productive work does not overwrite Crafter;
- no new XP/level/inventory authority;
- existing RC4, RC3.2, RC3.1, RC2 and Adventure gates remain mandatory.

## Explicitly deferred

**G3 — versioned Masterwork quality** remains unimplemented in this slice. Existing
`RC2-order/1` and `RC2-outcome/1` behavior is unchanged. This avoids invalidating
accepted orders or old item validation.

**Tier restriction migration** remains unimplemented. Existing learned recipes are
not silently revoked. Before enabling T3–T5 career gates, define and prove one
canonical old-save/grandfather policy using root state, never a client flag.

## Verification

Routine candidate gate remains the repository's unchanged Verify workflow:
`npm test` + retained browser gates.

The new integration suite demonstrates the intended real engine path:
canonically crafted Hammer/home evidence → Builder → real Hammer/T2 completions →
automatic Crafter transition → save/load validation.

Candidate green CI is not production release evidence. Merge, exact-main Verify,
Pages and public/native proof remain separate release gates.
