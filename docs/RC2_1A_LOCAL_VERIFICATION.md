# RC2.1a — local repair evidence

Base: c4410fc5403df1e5477f51b9071130d89b9618b5, merged PR #166.
The exact final candidate SHA and CI/public results belong in PR #169's timeline.
This document records completed local tests, not a claim that deployment passed.

## Result

All five independently executed bad-save cases from #166 now reject: an advanced
recipe masquerading as a legacy order; unknown marked order; copied cross-person
receipts; impossible unlock chronology; and 60008 completions with nextOrder9.
The existing two-real-craft unlock control remains SAT.

`node --test tests/craft-evidence-hardening.test.mjs`: 16/16 PASS, no skipped tests.
`npm test`: 799/799 PASS, no skipped tests (49.24 seconds in this environment).
The original canonical recipe suite remains 16/16 PASS.

The new suite additionally exercises canonical work/escrow/station/timing,
no-mutation rejection, receipt output identity, consumed-output absence, duplicate
pending IDs, 24-craft bounded compaction, byte-identical old compacted saves,
fractional work, two simultaneous crafters, and actual Same-World 4000-tick
simulation/save continuation for both seed230926 and seed42.

Independent offline Chromium mobile390x844 and desktop1440x1000: 31/31 PASS.
Actual Rust controls accept two crafts, the normal scheduler finishes them,
only the crafter learns T1, the real Save button persists the book/items and
reload preserves them. Zero uncaught JS errors; screenshots inspected. This uses
the repository's exact-module offline fixture and explicit Storage double. It is
NOT native HTTP/storage or public Pages evidence, and it does not claim the
advanced recipe/quality UI is implemented.

## Exact locally tested Git blob hashes

- src/craft-recipe-knowledge.mjs: 10a251037bc0d6906d084b3b24d0029b37337ca5
- src/rust-possessions.mjs: f3aa4daefc87a38d2d5c90e16d910c7d35045e33
- src/rust-runtime.mjs: a7084b2ee1204c1c7d286ad16a773fec6a3546b0
- index.html: 805d5a70621de6ced7b122e69ee41d9a19f55b11
- tests/craft-evidence-hardening.test.mjs: 9c84a350653384ef102f43f99b8ad2ae706767d9

## Compatibility boundary

No new knowledge namespace, XP/inventory/equipment authority or gameplay feature.
A new receipt binds its crafter; legacy valid receipts remain read-only compatible.
Compaction retains one boundary certificate per recipe, not an unbounded ledger.
A missing old certificate is not invented during migration. Physical outputs may
legitimately be consumed/placed; absence does not delete earned knowledge.
The original nine legitimate legacy recipe orders still finish as legacy items.

This is deterministic consistency validation, not cryptographic authenticity
against a fully rewritten but self-consistent offline world. Blueprint donor #168,
quality/abilities, actual advanced UI and the previously reported incoming-loot /
pending-output capacity races are separate RC2 gates, not declared closed here.

Release requires exact-head Verify -> expected-head merge -> exact-main Pages,
including public SWA7. UNKNOWN must not be reported as PASS.
