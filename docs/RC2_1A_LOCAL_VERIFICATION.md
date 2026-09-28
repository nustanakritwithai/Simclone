# RC2.1a — local repair evidence

Base: c4410fc5403df1e5477f51b9071130d89b9618b5, merged PR #166.
The exact final candidate SHA and CI/public results belong in PR #169's timeline.
This document records completed local tests, not a claim that deployment passed.

## Result

All five independently executed bad-save cases from #166 now reject: an advanced
recipe masquerading as a legacy order; unknown marked order; copied cross-person
receipts; impossible unlock chronology; and 60008 completions with nextOrder9.
The existing two-real-craft unlock control remains SAT.

Post-push adversarial review held b566ad3 before merge and found a further unused
historical order-ID replay. It now rejects before progress using the same person's
completed-order/tick watermark. Compacted boundary certificates also check surviving
outputs; retired counts must precede the first retained receipt even in old books.

`node --test tests/craft-evidence-hardening.test.mjs`: 16/16 PASS.
`node --test tests/craft-order-watermark.test.mjs`: 3/3 PASS.
`npm test`: 802/802 PASS, no skipped tests.
The original canonical recipe suite remains 16/16 PASS.

The new suites additionally exercise canonical work/escrow/station/timing,
no-mutation rejection, receipt output identity, consumed-output absence, duplicate
pending IDs, 24-craft bounded compaction, byte-identical old compacted saves,
fractional work, two simultaneous crafters, and actual Same-World 4000-tick
simulation/save continuation for both seed230926 and seed42.

Independent offline Chromium mobile390x844 and desktop1440x1000: 31/31 PASS,
repeated after the watermark repair. Actual Rust controls accept two crafts, the
normal scheduler finishes them, only the crafter learns T1, the real Save button
persists the book/items and reload preserves them. Zero uncaught JS errors;
screenshots inspected. This uses the repository's exact-module offline fixture
and explicit Storage double. It is NOT native HTTP/storage or public Pages
proof, and it does not claim advanced recipe/quality UI is implemented.

## Exact locally tested Git blob hashes

- src/craft-recipe-knowledge.mjs: 1c3a7e25b2a71bf436465e4f9d81e68db596b3fd
- src/rust-possessions.mjs: d8849c788e84419e275bcc89893c453c59b2ee49
- src/rust-runtime.mjs: a7084b2ee1204c1c7d286ad16a773fec6a3546b0
- index.html: c345db4db867d52b6e798e09dfdd0b8f8f0375ef
- tests/craft-evidence-hardening.test.mjs: 9c84a350653384ef102f43f99b8ad2ae706767d9
- tests/craft-order-watermark.test.mjs: ec0dbe24c4d56077ab9e22b4c1045a00ed13ea53

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
