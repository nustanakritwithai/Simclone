# Simclone — Autonomous Clone World

**Playable Alpha 0.1.0** — a seeded, CPU-driven colony simulation.

Play: https://nustanakritwithai.github.io/Simclone/

Plan page: https://nustanakritwithai.github.io/Simclone/plan.html

## What to try

Select a character and open the reason/skill tabs. Clone the selected character, then place a house on free grass and watch the villagers construct it. Use pause, 1× / 2× / 5×, pan, zoom and camera follow. On mobile, use the bottom navigation. Save/export/import are in the top-right menu.

No API key, account or paid model is required. Time stops when the tab is hidden or the page closes. Save data stays in the current browser unless exported.

## Development

Static HTML/CSS/ES modules; no runtime dependencies or build step.

```sh
npm test
python -m http.server 8000
```

Open `http://localhost:8000`. Use an HTTP server, not a file URL, for ES modules.

- [Master roadmap](GAME_PLAN.md)
- [Implemented scope and verification limits](docs/STATUS.md)
- [Agent handoff](AGENTS.md)

This build is not the V1.0 100-day autonomy proof. Autonomous births/aging, social systems, cultural archives and replay remain future work.
