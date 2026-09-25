# Simclone — current implementation status

## Released base

Main `3139e979b4446fd3f9873bb8b6fbbfae5ee6248d` contains the IC1 personal-home ownership foundation. Historical 0.5.0 release/features/authority evidence is retained in [STATUS_LEGACY_REFERENCE](STATUS_LEGACY_REFERENCE.md). It is not evidence that the following candidate is deployed.

## Independent Clone World candidate

Active PR #88 / `feature/independent-clone-world-ic2-main` now implements independent starts without a central Camp, private material balances, owner-built workbenches/tools/houses, personal REST/EAT, parent-funded births, lineage-derived guardian care and optional house-hosted archives. New public worlds select the independent profile; existing saves keep legacy behavior.

New independent saves use 0.6.0 with explicit extension validation. The legacy engine/import compatibility family remains 0.5.0. All command, item, work, placement and evidence authorities are reused.

Normative rules: [IC3 contract](IC3_INDEPENDENT_START_SUCCESS_CONTRACT.md).
Current work, exact evidence and release handoff: [IC3_WORK_STATE](IC3_WORK_STATE.md).

## Evidence boundary

Local unit/asset regressions passed 404/404, with no skipped tests. The untouched independent 120-year seed230926 proof retained 20 living people, reached generation6 and produced 32 complete personal homes. Independent offline Chromium tests are recorded separately from native HTTP/public/physical-device scopes.

This remains a candidate until exact GitHub CI and exact-main Pages/public verification succeed. Native development HTTP was administrator-blocked and remains UNKNOWN locally. The user reviews CI through the run URL; do not poll or wait.

Not claimed: unlimited civilization, automatic raw-material inheritance/property transfer, relationship-driven households, trade, factions/neighborhood formation, physical Android or GPU performance.
