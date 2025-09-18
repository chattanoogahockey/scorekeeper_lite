# Cloudflare Worker Sync Service

This Worker receives final game payloads from the GitHub Pages frontend and commits them into the repository using the GitHub REST API. Deploy it with [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) and provide the required secrets.

## Environment Variables

| Variable | Description |
| --- | --- |
| `GITHUB_TOKEN` | Personal access token with `repo` scope for the `scorekeeper_lite` repository |
| `GITHUB_REPO` | Repository slug, e.g. `chattanoogaHockey/scorekeeper_lite` |
| `GITHUB_BRANCH` | Target branch (defaults to `main`) |
| `GITHUB_COMMIT_NAME` | Commit author name (optional) |
| `GITHUB_COMMIT_EMAIL` | Commit author email (optional) |

## Deploy

```bash
wrangler login
wrangler secret put GITHUB_TOKEN
wrangler secret put GITHUB_REPO
wrangler secret put GITHUB_COMMIT_NAME
wrangler secret put GITHUB_COMMIT_EMAIL
wrangler deploy
```

## Request Shape

The frontend POSTs the following payload:

```json
{
  "version": "1.0.0",
  "source": "scorekeeper-lite",
  "game": { /* see data/games/ schema */ }
}
```

The Worker writes each game to `data/games/<game-id>.json`, updates `data/games/index.json`, and responds with `{ "status": "ok", "id": "<game-id>" }` on success.