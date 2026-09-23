# Simclone — Autonomous Clone World

**Survival Core 0.2.0** — seeded CPU-driven survival with an inspectable mobile-first UI.

Play: https://nustanakritwithai.github.io/Simclone/

Plan: https://nustanakritwithai.github.io/Simclone/plan.html

## Try it

Tap a portrait, then “ทำไม?” to inspect actual job scores and route lengths. Tap the food counter to see available/reserved food and assigned workers. Clone a selected parent, or preview/confirm a house and watch the workers construct it. Resource nodes have one worker each; houses allow two builders. Hungry foragers can eat one harvested food unit on site.

Pause / 1× / 2× / 5×, pan/zoom/follow, minimap, roster search and recent Chronicle are included. Save/export/import are in the menu. No account or AI API key is required. Time stops when hidden or closed. Saves stay in the current browser unless exported.

## Development

Static HTML/CSS/ES modules; no runtime dependencies or build step.

```sh
npm test
npm run test:survival
python -m http.server 8000
```

Use an HTTP server, not a file URL, for ES modules. Offline browser fixtures require Python Playwright and Chromium; they do not prove native localStorage or live HTTP delivery.

- [Current status](docs/STATUS.md)
- [Survival rules and evidence](docs/SURVIVAL_0.2.0.md)
- [Master roadmap](GAME_PLAN.md)
- [Agent handoff](AGENTS.md)

0.1.0 saved worlds remain readable. This is not the V1.0 autonomous lifecycle proof. Birth/aging, mentor/archive learning, social systems and full replay remain future work.
