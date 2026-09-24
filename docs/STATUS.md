# Simclone — Death History 0.3.5

Implementation: 0.3.5 engine/UI over the V0.3.4 generation-continuity baseline. World save schema remains 0.2.0 and legacy 0.1.0 is still accepted through explicit migration. V0.3.5 adds `historyVersion=0.1.0` for historical lifecycle facts without changing the browser storage key.

## Current slice — Death History + Migration

New deaths persist a single immutable record containing simulation tick, cause (`age` or `starvation`) and age-at-death. Dead-agent age no longer advances with the living world's clock.

Old 0.2.0 saves are migrated by retained evidence: death event/memory is used to recover tick/cause, and age-at-death is derived only when the save already contains lifecycle data that can support the historical tick. Missing evidence becomes `legacy-unknown`; lifespan is never substituted for age-at-death.

Legacy 0.1.0 still adopts lifecycle age 18 at load for continued simulation. That new anchor is not treated as evidence of a death that occurred before migration. Identity, parent/generation, appearance, bornTick, skills, birth-origin semantics and reproduction pacing are preserved.

The inspector displays recorded death age/cause/tick when known and explicitly shows unknown historical age/cause when evidence is insufficient. Corrupt and unreadable browser saves remain protected from overwrite.

Contract: [LIFECYCLE_0.3.5.md](LIFECYCLE_0.3.5.md).

## Retained baseline

The V0.3.4 proof remains the continuity baseline: five fresh seeded worlds run 120 simulated years with real aging/death, no manual CLONE/resource injection/age reset, plus checkpoint save continuation and single/batched stepping. Birth pacing remains a four-year global gap and four-year same-parent cooldown.

## Limits / not yet claimed

This is the first V0.3.5 hardening slice, not completion of every V0.3.5 follow-up. The 200 retained-agent cap still eventually stops births. Historical identity/active-worker separation, bounded save-size/runtime evidence, longer retained-history boundary runs and imported-age cohorts are still next.

Offline Chromium uses a Storage test double. Native HTTP-origin localStorage persistence and physical Android performance remain UNKNOWN until separately exercised.

Mentor teaching, skill provenance, cultural archive, social relationships, factions and replay are not implemented. V1.0 is not claimed.

## Verification

Exact candidate and exact main workflows are release gates. Do not treat this status file as proof of a passing run; use GitHub Actions for the exact source SHA and keep SAT / VIOL / UNKNOWN separate.

## Next gate

Continue [V0.3.5 historical identity / limits and extended proof](NEXT_STEPS.md) before V0.4 skill provenance.
