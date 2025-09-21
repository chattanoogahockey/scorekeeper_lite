const DIVISIONS = ['Gold', 'Silver', 'Bronze'];
const DEFAULT_DIVISION = 'Bronze';

const statisticsState = {
  selectedDivision: DEFAULT_DIVISION,
  standings: null,
  playerStandings: null,
  errorMessage: null,
};

const statisticsCache = {
  promise: null,
};

function toTitleCase(value) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeDivision(value) {
  const normalized = `${value ?? ''}`.trim();
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  if (lower === 'bronze') return 'Bronze';
  if (lower === 'silver') return 'Silver';
  if (lower === 'gold') return 'Gold';
  return toTitleCase(normalized);
}

function toScore(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function detectOvertime(game) {
  if (!game || !Array.isArray(game.goals)) {
    return false;
  }

  return game.goals.some((goal) => {
    if (!goal || typeof goal !== 'object') {
      return false;
    }

    const period = `${goal.period ?? ''}`.trim().toUpperCase();
    return period === 'OT' || period === '4';
  });
}

function createTeamRecord(teamName) {
  return {
    team: teamName,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    overtime: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };
}

function sortStandings(records) {
  return [...records].sort((teamA, teamB) => {
    if (teamA.points !== teamB.points) {
      return teamB.points - teamA.points;
    }

    if (teamA.wins !== teamB.wins) {
      return teamB.wins - teamA.wins;
    }

    const diffA = teamA.goalsFor - teamA.goalsAgainst;
    const diffB = teamB.goalsFor - teamB.goalsAgainst;
    if (diffA !== diffB) {
      return diffB - diffA;
    }

    if (teamA.goalsFor !== teamB.goalsFor) {
      return teamB.goalsFor - teamA.goalsFor;
    }

    return teamA.team.localeCompare(teamB.team);
  });
}

function computeStandingsFromGames(games) {
  const standings = new Map();

  games.forEach((game) => {
    if (!game || typeof game !== 'object') {
      return;
    }

    const divisionName = normalizeDivision(game.division);
    if (!divisionName) {
      return;
    }

    const homeTeam = `${game.homeTeam ?? ''}`.trim();
    const awayTeam = `${game.awayTeam ?? ''}`.trim();
    if (!homeTeam || !awayTeam) {
      return;
    }

    const homeScore = toScore(game.homeScore);
    const awayScore = toScore(game.awayScore);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
      return;
    }

    const divisionStandings = standings.get(divisionName) ?? new Map();
    if (!standings.has(divisionName)) {
      standings.set(divisionName, divisionStandings);
    }

    const homeRecord = divisionStandings.get(homeTeam) ?? createTeamRecord(homeTeam);
    const awayRecord = divisionStandings.get(awayTeam) ?? createTeamRecord(awayTeam);
    divisionStandings.set(homeTeam, homeRecord);
    divisionStandings.set(awayTeam, awayRecord);

    homeRecord.gamesPlayed += 1;
    awayRecord.gamesPlayed += 1;
    homeRecord.goalsFor += homeScore;
    homeRecord.goalsAgainst += awayScore;
    awayRecord.goalsFor += awayScore;
    awayRecord.goalsAgainst += homeScore;

    const overtimeGame = detectOvertime(game);

    if (homeScore > awayScore) {
      homeRecord.wins += 1;
      homeRecord.points += 2;
      if (overtimeGame) {
        awayRecord.overtime += 1;
        awayRecord.points += 1;
      } else {
        awayRecord.losses += 1;
      }
    } else if (awayScore > homeScore) {
      awayRecord.wins += 1;
      awayRecord.points += 2;
      if (overtimeGame) {
        homeRecord.overtime += 1;
        homeRecord.points += 1;
      } else {
        homeRecord.losses += 1;
      }
    } else {
      // Handle the rare case of a tie game.
      homeRecord.points += 1;
      awayRecord.points += 1;
    }
  });

  const finalStandings = new Map();

  standings.forEach((divisionStandings, divisionName) => {
    const ordered = sortStandings(divisionStandings.values());
    finalStandings.set(divisionName, ordered);
  });

  return finalStandings;
}

function createPlayerRecord(playerId, playerName, teamName) {
  return {
    id: playerId,
    player: playerName,
    team: teamName,
    goals: 0,
    assists: 0,
    pims: 0,
    hatTricks: 0,
  };
}

function ensurePlayerRecord(collection, playerId, playerName, teamName) {
  const name = `${playerName ?? ''}`.trim();
  const team = `${teamName ?? ''}`.trim();
  if (!name) {
    return null;
  }

  const normalizedId = `${playerId ?? ''}`.trim();
  const key = normalizedId || (team ? `${name}::${team}` : name);
  let record = collection.get(key);

  if (!record) {
    record = createPlayerRecord(key, name, team);
    collection.set(key, record);
  } else {
    if (team && record.team !== team) {
      record.team = team;
    }

    if (record.player !== name) {
      record.player = name;
    }
  }

  return { record, key };
}

function sortPlayerStandings(records) {
  return [...records].sort((playerA, playerB) => {
    const pointsA = playerA.points;
    const pointsB = playerB.points;

    if (pointsA !== pointsB) {
      return pointsB - pointsA;
    }

    if (playerA.goals !== playerB.goals) {
      return playerB.goals - playerA.goals;
    }

    if (playerA.assists !== playerB.assists) {
      return playerB.assists - playerA.assists;
    }

    if (playerA.hatTricks !== playerB.hatTricks) {
      return playerB.hatTricks - playerA.hatTricks;
    }

    if (playerA.pims !== playerB.pims) {
      return playerA.pims - playerB.pims;
    }

    return playerA.player.localeCompare(playerB.player);
  });
}

function computePlayerStandingsFromGames(games) {
  const perDivision = new Map();

  games.forEach((game) => {
    if (!game || typeof game !== 'object') {
      return;
    }

    const divisionName = normalizeDivision(game.division);
    if (!divisionName) {
      return;
    }

    const goals = Array.isArray(game.goals) ? game.goals : [];
    const penalties = Array.isArray(game.penalties) ? game.penalties : [];

    const divisionStats = perDivision.get(divisionName) ?? new Map();
    if (!perDivision.has(divisionName)) {
      perDivision.set(divisionName, divisionStats);
    }

    const goalCounts = new Map();

    goals.forEach((goal) => {
      if (!goal || typeof goal !== 'object') {
        return;
      }

      const teamName = `${goal.team ?? ''}`.trim();
      const playerName = `${goal.player ?? ''}`.trim();
      if (!teamName || !playerName) {
        return;
      }

      const playerEntry = ensurePlayerRecord(divisionStats, goal.playerId, playerName, teamName);
      if (!playerEntry) {
        return;
      }

      const { record, key } = playerEntry;
      record.goals += 1;
      goalCounts.set(key, (goalCounts.get(key) ?? 0) + 1);

      const assistName = `${goal.assist ?? ''}`.trim();
      if (assistName) {
        const assistEntry = ensurePlayerRecord(divisionStats, goal.assistId, assistName, teamName);
        if (assistEntry) {
          assistEntry.record.assists += 1;
        }
      }
    });

    goalCounts.forEach((count, key) => {
      if (count < 3) {
        return;
      }

      const record = divisionStats.get(key);
      if (record) {
        record.hatTricks += 1;
      }
    });

    penalties.forEach((penalty) => {
      if (!penalty || typeof penalty !== 'object') {
        return;
      }

      const playerName = `${penalty.player ?? ''}`.trim();
      const teamName = `${penalty.team ?? ''}`.trim();
      if (!playerName || !teamName) {
        return;
      }

      const minutes = toScore(penalty.minutes);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        return;
      }

      const penaltyEntry = ensurePlayerRecord(divisionStats, penalty.playerId, playerName, teamName);
      if (penaltyEntry) {
        penaltyEntry.record.pims += minutes;
      }
    });
  });

  const finalStandings = new Map();

  perDivision.forEach((divisionStats, divisionName) => {
    const normalized = Array.from(divisionStats.values()).map((record) => ({
      ...record,
      points: record.goals + record.assists,
    }));

    finalStandings.set(divisionName, sortPlayerStandings(normalized));
  });

  return finalStandings;
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to load statistics data', error);
    return null;
  }
}

async function loadGameSummaries() {
  const index = await fetchJson('data/games/index.json');
  if (!Array.isArray(index) || !index.length) {
    return { games: [], updatedAt: null };
  }

  const entries = await Promise.all(
    index.map(async (entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const details = await fetchJson(entry.file);
      const merged = details && typeof details === 'object' ? details : {};

      return {
        division: merged.division ?? entry.division ?? '',
        homeTeam: merged.homeTeam ?? entry.homeTeam ?? '',
        awayTeam: merged.awayTeam ?? entry.awayTeam ?? '',
        homeScore: merged.homeScore ?? entry.homeScore ?? null,
        awayScore: merged.awayScore ?? entry.awayScore ?? null,
        goals: Array.isArray(merged.goals) ? merged.goals : [],
        penalties: Array.isArray(merged.penalties) ? merged.penalties : [],
        status: merged.status ?? entry.status ?? '',
        lastUpdated: merged.lastUpdated ?? entry.lastUpdated ?? null,
      };
    }),
  );

  const games = entries.filter(Boolean);
  const updatedAt = games.reduce((latest, game) => {
    const timestamp = game.lastUpdated ?? null;
    if (!timestamp) {
      return latest;
    }

    const value = new Date(timestamp).getTime();
    if (!Number.isFinite(value)) {
      return latest;
    }

    return Math.max(latest, value);
  }, 0);

  return { games, updatedAt: updatedAt || null };
}

async function loadStandings() {
  if (!statisticsCache.promise) {
    statisticsCache.promise = loadGameSummaries()
      .then(({ games }) => {
        statisticsState.standings = computeStandingsFromGames(games);
        statisticsState.playerStandings = computePlayerStandingsFromGames(games);
        statisticsState.errorMessage = null;
        return statisticsState.standings;
      })
      .catch((error) => {
        console.error('Failed to build standings', error);
        statisticsState.standings = new Map();
        statisticsState.playerStandings = new Map();
        statisticsState.errorMessage = 'Unable to load statistics right now. Please try again later.';
        throw error;
      })
      .finally(() => {
        statisticsCache.promise = null;
      });
  }

  try {
    return await statisticsCache.promise;
  } catch {
    return statisticsState.standings ?? new Map();
  }
}

function renderTeamStandingsTable(division) {
  const standings = statisticsState.standings instanceof Map ? statisticsState.standings : new Map();
  const teams = standings.get(division) ?? [];

  if (!teams.length) {
    return '<div class="empty-state">No completed games yet for this division.</div>';
  }

  const rows = teams
    .map(
      (team) => `
        <tr>
          <th scope="row" aria-label="Team">${team.team}</th>
          <td>${team.gamesPlayed}</td>
          <td>${team.wins}</td>
          <td>${team.losses}</td>
          <td>${team.points}</td>
          <td>${team.overtime}</td>
          <td>${team.goalsFor}</td>
          <td>${team.goalsAgainst}</td>
        </tr>
      `,
    )
    .join('');

  return `
    <table class="stats-table">
      <colgroup>
        <col class="stats-team-column" />
        <col span="7" class="stats-metric-column" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Team</th>
          <th scope="col">GP</th>
          <th scope="col">W</th>
          <th scope="col">L</th>
          <th scope="col">PTS</th>
          <th scope="col">OT</th>
          <th scope="col">GF</th>
          <th scope="col">GA</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function renderPlayerStandingsTable(division) {
  const standings = statisticsState.playerStandings instanceof Map ? statisticsState.playerStandings : new Map();
  const players = standings.get(division) ?? [];

  if (!players.length) {
    return '<div class="empty-state">No player statistics yet for this division.</div>';
  }

  const rows = players
    .map((player) => {
      const teamLine = player.team ? `<span class="stats-player-team">${player.team}</span>` : '';
      return `
        <tr>
          <th scope="row" aria-label="Player">
            <span class="stats-player-name">${player.player}</span>
            ${teamLine}
          </th>
          <td>${player.goals}</td>
          <td>${player.assists}</td>
          <td>${player.points}</td>
          <td>${player.pims}</td>
          <td>${player.hatTricks}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <table class="stats-table stats-table--players">
      <colgroup>
        <col class="stats-player-column" />
        <col span="5" class="stats-player-metric-column" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Player</th>
          <th scope="col">G</th>
          <th scope="col">A</th>
          <th scope="col">PTS</th>
          <th scope="col">PIMS</th>
          <th scope="col">HT</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function markActiveDivision(filterContainer, division) {
  const buttons = filterContainer.querySelectorAll('[data-division]');
  buttons.forEach((button) => {
    const isActive = button.dataset.division === division;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function updateStandingsView(containers, division) {
  const teamContainer = containers?.team ?? null;
  const playerContainer = containers?.player ?? null;

  if (!teamContainer && !playerContainer) {
    return;
  }

  if (statisticsState.errorMessage) {
    const message = `<div class="empty-state">${statisticsState.errorMessage}</div>`;
    if (teamContainer) {
      teamContainer.innerHTML = message;
    }
    if (playerContainer) {
      playerContainer.innerHTML = message;
    }
    return;
  }

  if (teamContainer) {
    teamContainer.innerHTML = renderTeamStandingsTable(division);
  }

  if (playerContainer) {
    playerContainer.innerHTML = renderPlayerStandingsTable(division);
  }
}

export const statisticsView = {
  id: 'statistics',
  hideHeader: true,
  template() {
    const buttons = DIVISIONS.map(
      (division) => `
        <button type="button" class="division-chip" data-division="${division}" aria-pressed="false">
          ${division}
        </button>
      `,
    ).join('');

    return `
      <div class="card stats-card">
        <div class="stats-section">
          <h2>Team Standings</h2>
          <div class="division-filter" data-division-filter role="tablist" aria-label="Division filter">
            ${buttons}
          </div>
          <div class="stats-table-container" data-team-standings>
            <div class="empty-state">Loading statistics…</div>
          </div>
        </div>
        <div class="stats-section">
          <h2>Player Standings</h2>
          <div class="stats-table-container" data-player-standings>
            <div class="empty-state">Loading statistics…</div>
          </div>
        </div>
      </div>
    `;
  },
  navigation() {
    return '<button class="nav-btn" data-action="back-to-menu">Back to Menu</button>';
  },
  bind(app) {
    const nav = app.topNavigation;
    nav
      .querySelector('[data-action="back-to-menu"]')
      ?.addEventListener('click', () => app.showStartupMenu());

    const main = app.mainContent;
    const filterContainer = main.querySelector('[data-division-filter]');
    const teamContainer = main.querySelector('[data-team-standings]');
    const playerContainer = main.querySelector('[data-player-standings]');

    if (!filterContainer || !teamContainer || !playerContainer) {
      return;
    }

    if (!DIVISIONS.includes(statisticsState.selectedDivision)) {
      statisticsState.selectedDivision = DEFAULT_DIVISION;
    }

    const initialDivision = statisticsState.selectedDivision;
    markActiveDivision(filterContainer, initialDivision);

    const containers = { team: teamContainer, player: playerContainer };

    filterContainer.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest('[data-division]') : null;
      if (!target) {
        return;
      }

      const division = target.dataset.division;
      if (!division || division === statisticsState.selectedDivision) {
        return;
      }

      statisticsState.selectedDivision = division;
      markActiveDivision(filterContainer, division);
      updateStandingsView(containers, division);
    });

    statisticsState.errorMessage = null;
    const loadingMarkup = '<div class="empty-state">Loading statistics…</div>';
    teamContainer.innerHTML = loadingMarkup;
    playerContainer.innerHTML = loadingMarkup;

    loadStandings()
      .then(() => {
        const division = statisticsState.selectedDivision;
        markActiveDivision(filterContainer, division);
        updateStandingsView(containers, division);
      })
      .catch(() => {
        statisticsState.errorMessage = statisticsState.errorMessage ?? 'Unable to load statistics right now. Please try again later.';
        updateStandingsView(containers, statisticsState.selectedDivision);
      });
  },
};