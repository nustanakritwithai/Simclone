# CI Gate Policy

Active feature work should not rerun every historical proof on every commit.

## Mandatory candidate / Pages gate

Runs automatically:
- `npm test`
- active observation UI smoke (`tests/ui-smoke.py`)
- Pages upload/deploy and public exact-release byte verification on `main`

These protect the current engine, persistence, active feature regressions and the public release.

## Closed regression suite

Released proof families are retained but moved to the manual **Closed Regression Proofs** workflow:
- WM4.5 / WM4.6 ecology authority
- Survival Core
- autonomous birth
- deterministic age death
- long-run continuity/history
- navigation/save recovery browser regression
- survival UI browser regression

Run this workflow when a change touches one of those authorities, before a major release, or when investigating a regression. The scripts/tests are not deleted; only their automatic execution on every unrelated PR and Pages deployment is retired.

UNKNOWN is never PASS. A feature that modifies a closed authority must run the corresponding closed regression proof before release.
