const GAME_DIRECTORY = 'data/games';
const INDEX_FILE = `${GAME_DIRECTORY}/index.json`;

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
      return new Response('Worker not configured', { status: 500 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (error) {
      console.error('Invalid JSON payload', error);
      return new Response('Invalid JSON', { status: 400 });
    }

    const { game } = payload ?? {};
    if (!game || !game.id) {
      return new Response('Missing game payload', { status: 400 });
    }

    const sanitized = sanitizeGame(game);
    const { owner, repo } = parseRepo(env.GITHUB_REPO);
    const branch = env.GITHUB_BRANCH || 'main';

    const filePath = `${GAME_DIRECTORY}/${sanitized.id}.json`;
    const content = `${JSON.stringify(sanitized, null, 2)}\n`;

    await upsertFile(env, owner, repo, branch, filePath, content, `Add game ${sanitized.id}`);
    await updateIndex(env, owner, repo, branch, sanitized);

    return Response.json({ status: 'ok', id: sanitized.id });
  },
};

function sanitizeGame(game) {
  const requiredString = (value, fallback = '') => (typeof value === 'string' ? value : fallback);

  return {
    id: requiredString(game.id),
    date: requiredString(game.date),
    time: requiredString(game.time),
    homeTeam: requiredString(game.homeTeam),
    awayTeam: requiredString(game.awayTeam),
    location: requiredString(game.location),
    season: requiredString(game.season),
    week: requiredString(game.week),
    status: requiredString(game.status || 'completed'),
    created: requiredString(game.created || new Date().toISOString()),
    ended: requiredString(game.ended || new Date().toISOString()),
    attendance: Array.isArray(game.attendance) ? game.attendance : [],
    goals: Array.isArray(game.goals) ? game.goals : [],
    penalties: Array.isArray(game.penalties) ? game.penalties : [],
    homeScore: Number.isFinite(game.homeScore) ? game.homeScore : 0,
    awayScore: Number.isFinite(game.awayScore) ? game.awayScore : 0,
  };
}

function parseRepo(repoString) {
  const [owner, repo] = repoString.split('/');
  if (!owner || !repo) {
    throw new Error('Invalid GITHUB_REPO format');
  }
  return { owner, repo };
}

async function updateIndex(env, owner, repo, branch, game) {
  const existingIndex = await fetchFile(env, owner, repo, branch, INDEX_FILE);
  let entries = [];

  if (existingIndex?.content) {
    try {
      const decoded = JSON.parse(atob(existingIndex.content));
      if (Array.isArray(decoded)) {
        entries = decoded;
      }
    } catch (error) {
      console.warn('Failed to parse index.json, starting fresh', error);
    }
  }

  const entry = {
    id: game.id,
    file: `${GAME_DIRECTORY}/${game.id}.json`,
    created: game.created,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    lastUpdated: new Date().toISOString(),
  };

  const filtered = entries.filter((item) => item.id !== entry.id);
  filtered.push(entry);
  filtered.sort((a, b) => new Date(b.created) - new Date(a.created));

  const content = `${JSON.stringify(filtered, null, 2)}\n`;

  await upsertFile(
    env,
    owner,
    repo,
    branch,
    INDEX_FILE,
    content,
    `Update index after game ${game.id}`,
    existingIndex?.sha,
  );
}

async function upsertFile(env, owner, repo, branch, path, content, message, existingSha) {
  const target = existingSha ? { sha: existingSha } : await fetchFile(env, owner, repo, branch, path);
  const sha = existingSha ?? target?.sha;

  const body = {
    message,
    content: encodeBase64(content),
    branch,
    committer: {
      name: env.GITHUB_COMMIT_NAME || 'Scorekeeper Robot',
      email: env.GITHUB_COMMIT_EMAIL || 'scorekeeper@example.com',
    },
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await githubRequest(env, owner, repo, `contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub upsert failed: ${response.status} ${text}`);
  }
}

async function fetchFile(env, owner, repo, branch, path) {
  const response = await githubRequest(env, owner, repo, `contents/${path}?ref=${branch}`);
  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub fetch failed: ${response.status} ${text}`);
  }

  return response.json();
}

function encodeBase64(content) {
  return btoa(unescape(encodeURIComponent(content)));
}

function githubRequest(env, owner, repo, path, init = {}) {
  const url = `https://api.github.com/repos/${owner}/${repo}/${path}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'scorekeeper-lite-worker',
    Accept: 'application/vnd.github+json',
    ...init.headers,
  };

  return fetch(url, { ...init, headers });
}
