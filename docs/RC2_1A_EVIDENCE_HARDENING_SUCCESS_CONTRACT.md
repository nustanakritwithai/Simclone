# RC2.1a — evidence and order validation hotfix

Owner: independent RC2 verifier / Public Gate integration workstream.
Base: c4410fc5403df1e5477f51b9071130d89b9618b5 (merged PR #166).
Status: candidate, UNKNOWN until repaired exact-head and exact-main verification.

This is a narrow repair of five independently executed negative save cases posted
on PR #166 at head db9bd075f04bd1abb24e9f57e40cf4499bb426d5. It is not a second
recipe system, a new progression design or permission to merge stale donors.

## Violations to close

1. A newly introduced advanced recipe cannot be restored/completed as an unmarked
   legacy order. The legacy allowlist is precisely the original nine recipes.
2. Marked pending orders must validate actor permission, identity, canonical work,
   escrow and timing before restore admits them or advance mutates progress.
   An invalid order must fail atomically, not crash after changing work.
3. Retained completion receipts bind to their crafter and are globally unique by
   order/item identity. When a physical output survives, creator/kind/tick agree.
   Consuming/placing an output must not erase earned mastery.
4. A mastery unlock cannot predate prerequisite evidence or point to an unrelated
   retained completion. Bounded compaction must preserve a justified monotonic
   evidence boundary; no unbounded craft history is introduced.
5. Per-person/global completed-work totals cannot exceed allocated historical
   orders. Retired counters cannot grant 60008 completions when nextOrder is 9.

## Compatibility and authority

Keep knowledgeState.recipes, Rust items/orders/materials and createdBy as the sole
existing authorities. Preserve original starter permissions, legitimate legacy
pending orders, successful current saves and teaching across archived people.
No quality/ability/Blueprint/UI feature is added by this repair. No general XP,
second inventory, Math.random, wall-clock gameplay, forced push or other-branch
write. Old valid RC2.1 receipts may be interpreted from their containing person;
new explicit evidence must not silently repair contradictory saved data.

This is local consistency and deterministic provenance validation, not a claim of
cryptographic authenticity against an attacker who rewrites an entire offline
world into a different self-consistent history.

## Required proof

- Red before repair for all five cases, green after repair.
- No-mutation rejection at command/progress boundaries.
- Cross-person receipt transplant, duplicate receipt, shortened work/escrow,
  missing/wrong marker, invalid counters and impossible chronology reject.
- Real two-craft unlock and teaching still work; compaction beyond eight receipts
  and save/load remain exact; placed/consumed item absence remains legitimate.
- All active regressions and actual mobile/desktop controls -> two crafts ->
  personal unlock -> Save/restore. Distinguish offline Storage double from native
  HTTP and actual public Pages evidence.
- Exact-head Verify, expected-head merge and exact-main Pages/public SWA7.

RC2.2–4 / UI ownership remains the original RC2 implementation workstream. It
should build on this repaired baseline after the safety gate, not overwrite it.
