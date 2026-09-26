# Kingdom Household Organization / Recruitment Work State

Status: PREPARED / STACKED ON #95  
Branch: `feature/kingdom-organization-shadow-prep`  
Base dependency: `feature/kingdom-household-adaptation` / PR #95  
Contract: `docs/KINGDOM_ORGANIZATION_RECRUITMENT_SUCCESS_CONTRACT.md`

## Goal

Adapt Kingdom OrganizationSystem + LaborMarket recruitment semantics to household scope without prematurely creating settlement/faction authority.

## Prepared

- `src/kingdom-household-organization.mjs`
  - `householdOrganizationShadow()`
  - `householdRecruitmentOffers()`
  - `allHouseholdOrganizationShadows()`
- household owner acts as provisional household leader;
- explicit adult cohabitants are current adult members;
- guardian dependents remain residents, not adult followers;
- K2–K6 household labor pressure provides recruitment purpose;
- `cohabitationCandidates()` remains the relationship-backed follower source;
- Leadership available slots bound requested candidates;
- proximity alone does not qualify;
- no automatic JOIN or profession mutation.

## Authored proof

`tests/kingdom-household-organization.test.mjs` covers:
- leader/member organization projection;
- relationship-backed candidate inclusion;
- nearby stranger exclusion;
- Leadership-full suppression;
- byte-read-only evaluation;
- deterministic save/load replay.

## Deferred activation

After #95 SAT:

```text
Recruitment shadow
→ candidate personal decision
→ explicit JOIN / work agreement
→ cooperation evidence
→ persistent organization membership authority
```

No faction/settlement/sovereignty state should be created before that gate.

UNKNOWN is not PASS.
