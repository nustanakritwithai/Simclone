# Adventure V1 Integration I4 — VERIFIED Combat Outcome → Adventure XP

Status: CANDIDATE. MERGE NOT APPROVED.  
Parent: I3 exact head `7dcace3ddb16268dac3f37b1c041852a54fb7dae` with Verify SUCCESS #1440.

## Goal

Reward canonical Adventure XP only from deterministic terminal combat evidence.

```text
I3 terminal combat
→ Adventure combat verifier
→ VERIFIED / OUTCOME_UNKNOWN / EVIDENCE_CONFLICT
→ VERIFIED VICTORY only
→ agent.skills.ADVENTURE
→ existing recordEarnedSkill provenance
```

This is a separate Adventure verifier. VAL4/VAL5 productive-outcome evidence remains scoped to FORAGE/WOODCUT/MINE/BUILD and is not relabeled.

## Reward amount

I4 uses the admitted Wild Monster donor field `baseExpYield` exactly.

No rank multiplier, random bonus, level multiplier or UI modifier is invented in this gate.

- VERIFIED VICTORY → +monster.baseExpYield Adventure XP.
- VERIFIED DEFEATED → 0 XP.
- OUTCOME_UNKNOWN → 0 XP.
- EVIDENCE_CONFLICT → 0 XP and commit is rejected.

## Verification

VICTORY requires linked terminal evidence:
- terminal status VICTORY,
- last turn = session.turn − 1,
- last turn status VICTORY,
- monster HP before > 0 and after = 0,
- session monster HP = 0,
- applied hero damage equals the remaining pre-hit monster HP,
- no counterattack damage on the winning turn,
- monster definition has a positive baseExpYield.

DEFEATED requires linked terminal evidence and retains XP 0.

ACTIVE combat is always OUTCOME_UNKNOWN.

## Atomic/idempotent commit

Reward is committed inside the same engine combat command that creates the terminal outcome.

The session receives one immutable reward receipt:
- claimKey = `ADVENTURE_XP:<outcomeId>`,
- evidence = VERIFIED,
- outcome,
- xpAward,
- committedTick,
- status COMMITTED or NO_REWARD.

The receipt is idempotency evidence, not a second XP ledger.

Canonical XP remains only:
- `agent.skills.ADVENTURE`
- `agent.skillProvenance.bySkill.ADVENTURE`

Reapplying the same committed reward returns changed=false and XP 0.

## Still forbidden

- no XP from ACTIVE/UNKNOWN/conflicting outcomes,
- no loot/Rust item reward,
- no gear/equipment modifier,
- no second Adventure XP field,
- no VAL4 scope expansion,
- no permanent combat death,
- no PR #123 runtime import.

## Acceptance

1. ACTIVE combat is OUTCOME_UNKNOWN and grants 0 XP.
2. VERIFIED VICTORY grants exactly monster.baseExpYield once.
3. The existing skill provenance records the same XP.
4. Replay/idempotent reapply does not add XP twice.
5. Tampered terminal evidence becomes EVIDENCE_CONFLICT and cannot reward.
6. VERIFIED DEFEATED grants 0 XP.
7. Reward receipt survives save/load deterministically.
8. No Rust item is granted in I4.
9. I3 pure combat-session module remains reward-free.
10. Existing I0–I3 and project regressions remain SAT.
11. Exact-head Verify succeeds. UNKNOWN is not PASS.
