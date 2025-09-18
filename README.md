# The Scorekeeper (Lite)

A GitHub Pages application for tracking Chattanooga Roller Hockey League games. The frontend captures attendance, goals, and penalties, then syncs completed games as JSON files that you can process later in Python.

## Project Goals

- 100% static frontend hosted on GitHub Pages
- Capture full game state from any modern browser (desktop/tablet phones)
- Persist completed games as structured JSON without managing a database
- Keep source data (rosters, schedule, history) under version control for later analytics

## High-Level Architecture

| Layer | Purpose |
| --- | --- |
| Frontend (`index.html`, `css/`, `js/`) | Runs entirely in the browser. Uses ES modules, modular views, and a shared data manager to drive UI state. |
| Static data (`data/`) | Seed JSON files generated from league spreadsheets (`rosters.json`, `schedule.json`). |
| Sync queue (`localStorage`) | Browser-local queue that stores unsynced games so nothing is lost offline. |
| Cloudflare Worker (`worker/`) | Minimal serverless endpoint that validates game payloads and commits them into `data/games/` plus an index manifest. |
| Automation scripts (`scripts/`) | Node utilities that validate JSON, enforce schema, and help with deployment/maintenance. |

## Repository Layout

```text
.
├─ css/                # Styling for the app
├─ data/
│  ├─ games.json       # Legacy placeholder (history view uses it until /games/ manifest lands)
│  ├─ games/           # Individual game files + index manifest (created by Worker)
│  ├─ rosters.json     # Rosters generated from Excel sheets
│  └─ schedule.json    # Game schedule generated from Excel sheets
├─ js/
│  ├─ app/             # ScorekeeperApp orchestrator
│  ├─ components/      # UI helpers (sync banner, etc.)
│  ├─ core/            # Data manager, config, schema, sync queue/service
│  ├─ utils/           # Formatting helpers
│  └─ views/           # View renderers for menu, attendance, scoring, history
├─ scripts/            # Node scripts (validate data, future tooling)
├─ worker/             # Cloudflare Worker source + Wrangler config
├─ index.html          # GitHub Pages entry point
├─ package.json        # Tooling configuration (ESLint, Prettier, Vitest, dev server)
└─ README.md
```

## Local Development

1. **Install prerequisites**
   - Node.js ≥ 18
   - npm ≥ 9

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the dev server**
   ```bash
   npm run dev
   ```
   This launches `@web/dev-server` with hot reload for modules and static assets. The app remains 100% static, so deployment is simply pushing to `main`.

4. **Run tests & validators**
   ```bash
   npm run test        # Interactive Vitest watcher (tests arrive soon)
   npm run lint        # ESLint (JavaScript + JSON schema-aware rules)
   npm run validate    # Combined lint + unit tests + data schema validation
   ```

## Configuring Sync

The browser exposes a global `window.SCOREKEEPER_CONFIG` object (see `index.html`). Update it with your Cloudflare Worker endpoint once deployed:

```html
<script>
window.SCOREKEEPER_CONFIG = {
  syncEndpoint: 'https://your-worker.example.workers.dev',
  syncApiKey: '' // optional, if you secure the worker with a token
};
</script>
```

Until an endpoint is configured, completed games remain in `localStorage` and the sync banner will remind you that data is stored locally.

## Data Pipeline

League spreadsheets live outside the repo under `C:\Users\marce\OneDrive\Documents\CHAHKY\data`. Use `convert_excel.py` to regenerate JSON seeds:

```bash
python convert_excel.py
```

This script reads the latest roster/schedule workbooks and writes to `data/rosters.json` and `data/schedule.json`. Add more conversion helpers inside `scripts/` if needed.

## Game Persistence Workflow

1. During a game the browser keeps state in memory and mirrors progress in `localStorage`.
2. When you end a game the data manager enqueues the final payload and attempts to sync.
3. The sync client POSTs to the Cloudflare Worker endpoint whenever the device is online and the endpoint is configured.
4. The Worker validates the payload, writes a new file (or updates an existing one) in `data/games/`, and rebuilds `data/games/index.json`.
5. A GitHub Action can run nightly to re-validate the dataset (`npm run validate`) and deploy the newest static site.

If the network call fails or you are offline, the queue keeps the payload; the next successful sync flushes all pending games. You can see the status in the banner under the navigation bar.

## Cloudflare Worker

The Worker source lives in `worker/worker.js`. It expects these secrets:

- `GITHUB_TOKEN`
- `GITHUB_REPO` (e.g. `chattanoogaHockey/scorekeeper_lite`)
- `GITHUB_BRANCH` (defaults to `main`)
- `GITHUB_COMMIT_NAME` / `GITHUB_COMMIT_EMAIL`

Deploy with Wrangler:

```bash
cd worker
wrangler login
wrangler secret put GITHUB_TOKEN
wrangler secret put GITHUB_REPO
wrangler deploy
```

Once deployed, drop the Worker URL into `window.SCOREKEEPER_CONFIG.syncEndpoint`.

## Deployment to GitHub Pages

1. Push changes to `main` (or merge a PR).
2. GitHub Pages is configured to serve from the repository root. After GitHub finishes the build, your latest UI is live at:
   ```
   https://chattanoogaHockey.github.io/scorekeeper_lite/
   ```
3. The Cloudflare Worker runs independently using API tokens stored as secrets. See `worker/README.md` for details.

## Next Steps

- [ ] Flesh out goal/penalty statistics screens fed by the persisted JSON
- [ ] Add Vitest coverage for data manager, queue, and sync banner logic
- [ ] Wire CI to run `npm run validate` on every push
- [ ] Automate Worker deployments via GitHub Actions

---

Questions or ideas? Open an issue or drop a note in the Chattanooga Hockey dev channel.