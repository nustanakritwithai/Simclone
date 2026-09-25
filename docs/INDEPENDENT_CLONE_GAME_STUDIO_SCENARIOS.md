# Independent-world runtime and browser scenarios

Scenario contracts are not evidence of execution. Current browser playtesting uses repository-owned Playwright/Chromium and read-only hooks; it does not require a game-dev CLI. No hardware/GPU measurement or sealed game-dev bundle is claimed.

| Scenario | Implemented proof |
|---|---|
| Solo home / two owners | IC1 tests plus independent-world.test.mjs solo and five-seed actual construction |
| Personal craft → BUILD → placement → owner | original IC2 planner/integration tests, private-resource exact-once tests |
| Own home survival | independent-world.test.mjs real REST/EAT and guardian validation |
| Default individual autonomy | fresh independent profiles with RP1 disabled and no Camp |
| Birth without global house slots | private-parent cost, pacing, lineage and retained-history tests |
| No-Camp start | six separated founders, five fixed seeds, no free structures/tools |
| Generation continuity | scripts/independent-world-proof.mjs seed230926 120 years; actual age death, descendant homes, reload continuation |
| Public-profile browser controls | tests/independent-ui-smoke.py; 1,400-tick earned world, four viewport sizes, actual canvas resource taps, owner inspector/home, save/restore |
| Legacy observation compatibility | tests/ui-smoke.py using the explicit legacy profile; existing assertions retained |

`python tests/independent-ui-smoke.py` uses offline DOM and a clearly identified Storage double. `--native` uses local HTTP/native storage. A policy-blocked native run must stay UNKNOWN, never be relabeled from an offline pass. Neither mode proves public Pages or a physical Android device.

Rendered screenshots are reviewed separately from state-based house counts. Seed/start state/viewport/camera must match before a visual regression comparison. CI output identifies the source hash roster for simulation evidence. Current release/work status lives in IC3_WORK_STATE.md, not in this scenario list.
