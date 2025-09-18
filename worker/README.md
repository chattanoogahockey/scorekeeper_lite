# Cloudflare Worker Sync Service

This Worker receives finalized game payloads from the GitHub Pages frontend and commits them to the repository using the GitHub REST API. No KV or Durable Objects are involved; everything is written straight to `data/games/` via authenticated `PUT /contents` calls.

## Required Secrets

| Name | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Personal access token with `repo` scope for the destination repository |
| `GITHUB_REPO` | Repository slug, e.g. `chattanoogaHockey/scorekeeper_lite` |
| `GITHUB_BRANCH` | Target branch (defaults to `main`) |
| `GITHUB_COMMIT_NAME` / `GITHUB_COMMIT_EMAIL` | Commit author metadata (optional) |
| `SYNC_API_KEY` | Optional bearer token if you want to protect the endpoint |

## Deploy with Wrangler

```bash
cd worker
wrangler login
wrangler secret put GITHUB_TOKEN
wrangler secret put GITHUB_REPO
wrangler secret put GITHUB_COMMIT_NAME
wrangler secret put GITHUB_COMMIT_EMAIL
# Optional: wrangler secret put SYNC_API_KEY
wrangler deploy
```

You can inspect the deployed route and bindings with `wrangler routes` and `wrangler secret list`.

## Request Contract

The frontend submits the following JSON:

```json
{
  "version": "1.0.0",
  "source": "scorekeeper-lite",
  "game": { /* payload validated against js/core/schema.js */ }
}
```

The Worker:

1. Sanitizes the payload.
2. Writes `data/games/<game-id>.json` (creating or updating the file).
3. Rebuilds `data/games/index.json` with a summary entry.
4. Responds with `{ "status": "ok", "id": "<game-id>" }` on success.

## Protecting the Endpoint

If you set `SYNC_API_KEY` as a Worker secret, configure the frontend to send the same token in the `Authorization: Bearer <token>` header by populating `window.SCOREKEEPER_CONFIG.syncApiKey` in `index.html`.

## Local Testing

Use `wrangler dev` to run the Worker locally:

```bash
wrangler dev --local
```

Then POST a test payload:

```bash
curl -X POST http://127.0.0.1:8787 \
  -H "Content-Type: application/json" \
  -d '{"version":"1.0.0","source":"scorekeeper-lite","game":{"id":"demo","homeTeam":"A","awayTeam":"B"}}'
```

The Worker will attempt to reach GitHub using your configured secrets. For dry runs, point it to a staging repository or mock the `githubRequest` helper.
