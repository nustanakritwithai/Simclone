# Simclone — Historical Identity 0.3.6 candidate

This implements the historical-identity portion of the V0.3.5 hardening plan on top of main `f2edda01af049ca8090f651d84376c29a8f32490`. Engine/UI 0.3.6, save schema 0.3.0, archiveVersion 0.1.0 and historyVersion 0.1.0. Both legacy 0.1.0 and former 0.2.0 saves use explicit migrations; browser key is unchanged.

## Implemented

A buffered dead-identity archive separates historical retention from living work. All lineage, birth-origin/cooldown evidence, death facts, skills and retained memories remain resolvable. Temporary decision-score traces are omitted only when archived and explicitly disclosed in the inspector. Living capacity stays 36 (subject to housing); hot records target 64, total retained identities cap 1024 and explicit character budgets prevent unbounded retention. This is not simply 200 changed to a larger number, and not unlimited history.

The mobile roster searches archived people, paginates by 80 and resolves parents across the archive. Dead ancestors cannot be followed or cloned. Native file import accounts for UTF-8 byte size separately from save-string size.

## Local evidence, not release status

The frozen 0.3.5 baseline really hit its 200-person cap at years 1444–1480 in five seeds with only 10–11 people alive and no subsequent births in a 20-year window. The new five-seed proof reaches 1800 years with 242–246 retained identities, 11–12 living people, generations 60–61 and continuing births beyond that old boundary. There is no manual cloning, resource injection, age reset, extra housing or resurrection in that proof. Population minimum is 6 in all five runs, with no starvation or extinction in these fixtures.

See [contract](HISTORY_LIMITS_0.3.5.md), [baseline measurements](verification/history-baseline-0.3.5.json) and [candidate evidence](verification/history-0.3.6.json). Results are tied to source hashes. Exact candidate Actions and exact main Pages run are still the release authority; this document alone never proves deployment.

## Limits and next work

The finite 1024-identity/archive budget still eventually blocks creation without deleting ancestry. Fresh-world proof at the new full-capacity boundary, imported-age-cohort cases and physical Android performance are not claimed. A 1800-year seeded fixture is not an infinite-world proof.

Offline browser checks use a Storage double. Local native HTTP testing was blocked by administrator policy and remains UNKNOWN in that environment; a separate real HTTP/storage/process-restart test runs on CI. CI success is not proof of public live browser operation or physical-device performance.

No mentor teaching, cultural knowledge archive, skill provenance, social relationships, factions, replay or V1.0 claim. Continue [NEXT_STEPS.md](NEXT_STEPS.md).
