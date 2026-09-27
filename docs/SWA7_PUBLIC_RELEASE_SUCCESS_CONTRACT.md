---
type: success-contract
project: Simclone
domain: same-world-adventure
feature: SWA7 Public Release Closeout
status: implementation-candidate
canonical: true
owner: Project Brain + Integration Lead
validation: UNKNOWN
last_reviewed: 2026-09-27
---

# SWA7 — Same-World Adventure Public Release Closeout

## Goal

Close the Same-World Adventure release line only after the exact merged main is deployed and the public GitHub Pages site proves the physical Monster gameplay loop in a real browser.

## Released loop to prove

```text
Same-World 84×52
→ visible physical Wild Monster
→ exact worldMonsterId tap
→ Hunt
→ real Simclone path
→ READY encounter
→ Combat on same worldMonsterId
→ world-entity HP commit
→ VERIFIED Victory
→ DEFEATED / hidden
→ Continue
→ deterministic new incarnation respawn
```

## Evidence layers

### 1. Candidate PR

Before merge:
- npm/unit/persistence regressions SAT
- active Chromium UI smoke SAT
- Independent desktop smoke SAT
- no production gameplay authority changes in SWA7

### 2. Exact-main Pages workflow

After merge, exact main SHA must pass:
- npm test
- active Chromium UI smoke
- Independent native HTTP/storage smoke
- Pages deploy
- exact public-byte comparison for release-critical files

### 3. Public browser lifecycle proof

After deployment, Playwright must load the actual Pages URL with a cache-busting exact release query and prove:

1. public app boots with no page errors
2. world profile is `same-world`, 84×52
3. exactly 12 physical Wild Monsters exist
4. one real Monster can be moved into the safe playfield using normal canvas pan
5. actual canvas tap resolves the exact `worldMonsterId`
6. Monster card is visible
7. Hunt command assigns a real path without teleport
8. READY encounter carries the same `worldMonsterId`
9. Combat binds the same entity as ENGAGED
10. world-bound combat session has no duplicate `monsterHpCurrent`
11. Attack commits HP to the world entity
12. Victory produces DEFEATED/hidden Monster
13. DEFEATED entity is absent from canvas hit targets
14. Continue closes terminal combat
15. after simulation ticks, the same zone/slot respawns at `spawnEpoch+1`
16. new incarnation has a different `worldMonsterId`
17. HP is restored exactly to hpMax on respawn

Screenshots must be retained as workflow artifacts.

## Fixture rule

The release browser proof may seed localStorage with a deterministic, engine-validated Adventurer save generated from the checked-out source.

The fixture may accelerate setup but must not:
- create fake DOM-only Monsters
- patch browser runtime state after boot
- bypass engine commands for Hunt/Combat/Finish
- bypass world Monster lifecycle authority

## Identity

The public proof must run with:
- `PAGE_URL` from the Pages deployment step
- `RELEASE_SHA = github.sha`
- cache-busting query using that SHA

The Pages workflow must already verify public bytes match the checked-out exact release.

## Closeout

SWA7 is SAT only after the exact-main Pages run including the public lifecycle smoke succeeds.

Then:
- Same-World Adventure SWA0–SWA7 = RELEASED
- public release SHA is recorded in STATUS/NEXT_STEPS/AGENTS closeout
- stale release candidates are not merged again

UNKNOWN is never PASS.
