# ADV0B — Profession continuity

Status: CONTRACT FROZEN. RUNTIME NOT STARTED. MERGE NOT APPROVED.  
Base: `main@388ddaf32f81429edcb24ba6b6f62ef6135734c7` (VAL5 merge). Pages SAT: [run 36302102186](https://github.com/nustanakritwithai/Simclone/actions/runs/36302102186).  
Depends on [ADV0](ADV0_ADVENTURER_PROFESSION_SUCCESS_CONTRACT.md). This file does not implement it.

## Goal

Keep the four existing professions switching as they do today, and stop one productive action from erasing `adventurer`.

`adoptProfession` in `src/kingdom-utility.mjs` is the only profession writer. Do not add another.

## Fact on this base

`decide()` calls `adoptProfession(agent, choice.kind, tick)` for the selected candidate. For `FORAGE`, `WOODCUT`, `MINE`, and `BUILD`, a different kind replaces `agent.profession` immediately and pushes `agent.career`, which already drops to 8 entries.

`professionForAction("EXPLORE")` is null, so explore selection does not change profession. That stays true.

If ADV0 sets `adventurer` through this same function and nothing else changes, the next selected forage, woodcut, mine, or build replaces it. That result is VIOL of ADV0. This contract is the only authority that may change the function to prevent it.

## Allowed edit, later

`professionForAction("EXPLORE")` stays null. The normal call `adoptProfession(agent, kind, tick)` does not grow a third argument into a profession picker.

The only added call is:

```text
adoptProfession(agent, "EXPLORE", tick, {
  qualifiedProfession: "adventurer",
  qualification: "explore-3"
})
```

Inside that function:

- Accept this object only when `kind` is `EXPLORE`, both strings match exactly, there is no extra key, and `agent.adventurerQualification.accepted === 3`.
- Any other `qualifiedProfession`, `qualification`, kind, or extra key returns `{changed:false}` and writes nothing. A caller cannot name `forager`, `woodcutter`, `miner`, or `builder` through this object.
- The normal two-argument call is unchanged for the four professions.
- `adoptProfession(agent, "EXPLORE", tick)` with no object still changes nothing, because `professionForAction("EXPLORE")` is null. Selecting `EXPLORE` uses that call.
- When the current profession is `adventurer` and the next kind is `FORAGE`, `WOODCUT`, `MINE`, or `BUILD`, return `{changed:false}` and do not push career.
- `ensureProfession` may still fill a missing profession with one of the four. `createAgent` may still set the initial profession. Those are initialization and repair, not runtime transitions.

Leaving `adventurer` for one of the four is not given a threshold here. No such path is approved. A later contract must name that evidence before any exit exists. Until then, one productive action is not enough, and the function must not invent an exit.

## Still forbidden

- No second writer, no UI write, no new XP ledger.
- Do not change how the four professions replace each other.
- Do not retune scores, survival, household, or governor priority.
- Do not edit VAL4 or VAL5 files.
- Do not merge PR #123.
- No combat, region, loot, specialization, or skill-XP change in this gate.

## Acceptance of the future patch

1. A forager who selects `WOODCUT`, `MINE`, or `BUILD` still changes to that profession, and the other three directions still change, exactly as the current `tests/kingdom-utility.test.mjs` cases require.
2. An `adventurer` who selects one `FORAGE`, `WOODCUT`, `MINE`, or `BUILD` stays `adventurer`. Career length does not grow from that call.
3. `agent.career` still drops to at most 8 when the four professions switch among themselves.
4. After `createAgent` initialization and `ensureProfession` repair, runtime profession changes go through `adoptProfession` only. `ensureProfession` assigning one of the four to a missing profession is not a violation.
5. Save and load keep `adventurer` across one productive selection.
6. Existing four-profession tests are not weakened to hide a regression.

## Not SAT

The edit is not in the tree. Behavior proof is UNKNOWN. Contract text is not that proof.
