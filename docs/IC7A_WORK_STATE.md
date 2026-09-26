# IC7A — Estate / Inheritance Work State

Status: PREPARED / STACKED ON IC6B  
Branch: `feature/ic7-inheritance-prep`  
Base dependency: `feature/ic6b-cohabitation` / PR #91  
Contract: `docs/IC7A_ESTATE_INHERITANCE_SUCCESS_CONTRACT.md`

## Goal

Prepare inheritance from current Independent Clone World facts without mutating construction provenance or inventing an inheritance law.

## Runtime audit

Current death behavior:
- Rust bag/equipped items drop at death with `sourceAgentId`.
- Personal raw materials remain under the dead owner's personal store.
- House geometry remains and founding Foundation `placedBy` stays the ownership/construction evidence.
- Household residence links close when owner/resident dies.
- Identity and lineage remain retained in hot/archive history.

## Prepared candidate

- `src/estate.mjs`
  - `estateSnapshot()`
  - `heirCandidates()`
- Estate projection includes:
  - deceased id/death facts
  - personal raw materials
  - founded modular houses
  - death-source dropped item ids
  - living descendant candidates
- Heir candidates are factual only:
  - living retained descendants
  - deterministic lineage distance
  - bornTick/id tie break
- Unrelated/cohabiting adults are not lineage heirs merely because they shared a home.
- Projection is read-only.

## Authored proof

`tests/estate.test.mjs` covers:
- dead-owner personal materials remain attributed;
- construction provenance remains on deceased founder;
- dropped death items are projected;
- child ranks before grandchild;
- unrelated cohabitant excluded;
- projection byte-read-only;
- unknown/living subject rejected;
- save/load recomputes identical estate facts.

## Critical design boundary

Do **not** implement inheritance by rewriting `Foundation.placedBy`.

Future IC7B must distinguish:
- immutable construction provenance;
- current property title derived from bounded transfer evidence.

## Next gate after IC6B SAT

IC7B must define before mutation:
- one authoritative property-title transfer log;
- explicit no-heir policy;
- explicit multiple-heir policy;
- material conservation rule;
- atomic transfer semantics;
- save/load/history proof.

## Validation state

Preparation candidate only. UNKNOWN is not PASS.
