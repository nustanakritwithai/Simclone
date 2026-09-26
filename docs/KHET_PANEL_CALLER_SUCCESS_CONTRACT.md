# KHET.1 — Panel caller

Status: PANEL IS THE ONLY APPROVED CALLER. ENGINE IMPORT NOT APPROVED. MERGE NOT APPROVED.  
Base: draft [PR #123](https://github.com/nustanakritwithai/Simclone/pull/123) shadow head `eff95f564ec66aac2ed7d13715eb9ad588b967d3` on `feature/khet-sila-rules`.

## Goal

Name the one caller that may use the encounter shadow, then let that caller open the zone edge. This is not a walkable field and not a world write.

## Caller

`src/khet-panel.mjs` is the only approved caller.

`index.html` may load it with its own module script. `src/engine.mjs`, `src/app.mjs`, `src/boot.mjs`, and `src/skill-provenance.mjs` must not import it or `src/khet/`.

The panel is not a Clone. It must not read or write `agent.skills`.

## Allowed work

- Create one adventurer with `createCharacter(name, "ranger")` when `khet-sila-v1` is empty.
- Load and save only through `loadCharacter` and `saveCharacter` (browser key `khet-sila-v1`). The world save must not call them.
- Read `encounterShadow({ zone: "z1", adventurer, monsterId: "MON_002" })`.
- Start a fight only with that projection's zone and monster id.
- Strike once. Keep the returned HP.
- Rest at the camp edge, which fills HP.
- Close the panel without issuing a world command.

## Still forbidden

- Do not merge PR #123 from this gate.
- Do not import the panel or `src/khet/` from the engine, boot, app, or skill provenance.
- Do not pass khet exp, job level, shards, gear, or battle rewards to `recordEarnedSkill`.
- No zone other than `z1`. No monster other than the shadow's id. No invented monster.
- No walkable field, other players, shop, tame, ranch, breed, or gene.
- No second stat or damage formula.
- Browser, Pages, and public release stay UNKNOWN. A unit test is not that proof.

## Acceptance

1. This file names `src/khet-panel.mjs` and refuses an engine import and a merge.
2. The panel does not import `engine.mjs` or `skill-provenance.mjs`.
3. `src/engine.mjs` does not reference `src/khet` or `khet-panel`.
4. One hunt uses the shadow, keeps HP, and rest fills HP.
5. `tests/khet-sila.test.mjs` proves that behavior. No skill XP test is edited.
