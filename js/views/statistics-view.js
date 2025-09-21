const DIVISIONS = ['Gold', 'Silver', 'Bronze'];
const DEFAULT_DIVISION = 'Bronze';

const statisticsState = {
  selectedDivision: DEFAULT_DIVISION,
  standings: null,
  playerStandings: null,
  playerTimelines: null,
  errorMessage: null,
};

const statisticsCache = {
  promise: null,
};

const PLAYER_CHART_DIMENSIONS = {
  width: 560,
  height: 280,
  margin: { top: 32, right: 32, bottom: 48, left: 56 },
};

const playerFlyoutElements = {
  container: null,
  panel: null,
  title: null,
  subtitle: null,
  chart: null,
  closeButtons: [],
};

let lastFocusedPlayerRow = null;
let flyoutKeydownBound = false;

function toTitleCase(value) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function escapeAttribute(value) {
  return `${value ?? ''}`
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/'/g, '&#39;');
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
    gamesPlayed: 0,
    games: new Set(),
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



function parseDateValue(value) {
  const raw = `${value ?? ''}`.trim();
  if (!raw) {
    return null;
  }

  const isoCandidate = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const parsed = new Date(isoCandidate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(`${isoCandidate}Z`);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return null;
}

function resolveWeekNumber(game, divisionName, divisionWeekFallback) {
  const fallbackState = divisionWeekFallback.get(divisionName) ?? { next: 1 };

  const rawWeek = Number.parseInt(`${game.week ?? ''}`, 10);
  let weekNumber = Number.isFinite(rawWeek) && rawWeek > 0 ? rawWeek : null;

  if (!Number.isFinite(weekNumber)) {
    const referenceDate = parseDateValue(game.date ?? game.lastUpdated ?? null);
    if (referenceDate) {
      const startOfYear = new Date(referenceDate.getFullYear(), 0, 1);
      const diff = referenceDate.getTime() - startOfYear.getTime();
      if (Number.isFinite(diff)) {
        weekNumber = Math.max(1, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1);
      }
    }
  }

  if (!Number.isFinite(weekNumber)) {
    weekNumber = fallbackState.next;
    fallbackState.next += 1;
  } else {
    fallbackState.next = Math.max(fallbackState.next, weekNumber + 1);
  }

  divisionWeekFallback.set(divisionName, fallbackState);
  return weekNumber;
}

function ensurePlayerWeekStats(collection, playerKey, weekNumber) {
  const weekMap = collection.get(playerKey) ?? new Map();
  if (!collection.has(playerKey)) {
    collection.set(playerKey, weekMap);
  }

  const existing = weekMap.get(weekNumber);
  if (existing) {
    return existing;
  }

  const entry = { goals: 0, assists: 0, points: 0 };
  weekMap.set(weekNumber, entry);
  return entry;
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
}\n\nfunction computePlayerStandingsFromGames(games) {
  const perDivision = new Map();
  const perDivisionWeekly = new Map();
  const divisionWeekFallback = new Map();

  games.forEach((game) => {
    if (!game || typeof game !== 'object') {
      return;
    }

    const divisionName = normalizeDivision(game.division);
    if (!divisionName) {
      return;
    }

    const weekNumber = resolveWeekNumber(game, divisionName, divisionWeekFallback);
    const gameId = game.file || `${game.homeTeam}-vs-${game.awayTeam}-${game.lastUpdated || ''}`;

    const goals = Array.isArray(game.goals) ? game.goals : [];
    const penalties = Array.isArray(game.penalties) ? game.penalties : [];

    const divisionStats = perDivision.get(divisionName) ?? new Map();
    if (!perDivision.has(divisionName)) {
      perDivision.set(divisionName, divisionStats);
    }

    const divisionWeekly = perDivisionWeekly.get(divisionName) ?? new Map();
    if (!perDivisionWeekly.has(divisionName)) {
      perDivisionWeekly.set(divisionName, divisionWeekly);
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
      record.games.add(gameId);
      goalCounts.set(key, (goalCounts.get(key) ?? 0) + 1);

      const goalWeeklyStats = ensurePlayerWeekStats(divisionWeekly, key, weekNumber);
      goalWeeklyStats.goals += 1;
      goalWeeklyStats.points += 1;

      const assistName = `${goal.assist ?? ''}`.trim();
      if (assistName) {
        const assistEntry = ensurePlayerRecord(divisionStats, goal.assistId, assistName, teamName);
        if (assistEntry) {
          const { record: assistRecord, key: assistKey } = assistEntry;
          assistRecord.assists += 1;
          assistRecord.games.add(gameId);

          const assistWeeklyStats = ensurePlayerWeekStats(divisionWeekly, assistKey, weekNumber);
          assistWeeklyStats.assists += 1;
          assistWeeklyStats.points += 1;
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
        const { record } = penaltyEntry;
        record.pims += minutes;
        record.games.add(gameId);
      }
    });
  });

  perDivision.forEach((divisionStats) => {
    divisionStats.forEach((record) => {
      record.gamesPlayed = record.games.size;
      delete record.games;
    });
  });

  const finalStandings = new Map();
  const finalTimelines = new Map();

  perDivision.forEach((divisionStats, divisionName) => {
    const normalized = Array.from(divisionStats.values()).map((record) => ({
      ...record,
      points: record.goals + record.assists,
      ptsPerGame: record.gamesPlayed > 0 ? Number(((record.goals + record.assists) / record.gamesPlayed).toFixed(1)) : 0,
    }));

    finalStandings.set(divisionName, sortPlayerStandings(normalized));

    const weeklyMap = perDivisionWeekly.get(divisionName) ?? new Map();
    const timelineMap = new Map();

    weeklyMap.forEach((weekStatsMap, playerKey) => {
      const sortedWeeks = [...weekStatsMap.keys()].sort((a, b) => a - b);
      let cumulativeGoals = 0;
      let cumulativeAssists = 0;
      let cumulativePoints = 0;

      const timeline = sortedWeeks.map((weekValue) => {
        const weeklyTotals = weekStatsMap.get(weekValue) ?? { goals: 0, assists: 0, points: 0 };
        cumulativeGoals += weeklyTotals.goals;
        cumulativeAssists += weeklyTotals.assists;
        cumulativePoints += weeklyTotals.points;

        return {
          week: weekValue,
          goals: weeklyTotals.goals,
          assists: weeklyTotals.assists,
          points: weeklyTotals.points,
          cumulativeGoals,
          cumulativeAssists,
          cumulativePoints,
        };
      });

      if (timeline.length) {
        timelineMap.set(playerKey, timeline);
      }
    });

    finalTimelines.set(divisionName, timelineMap);
  });

  return { standings: finalStandings, timelines: finalTimelines };
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
        file: entry.file ?? '',
        division: merged.division ?? entry.division ?? '',
        homeTeam: merged.homeTeam ?? entry.homeTeam ?? '',
        awayTeam: merged.awayTeam ?? entry.awayTeam ?? '',
        homeScore: merged.homeScore ?? entry.homeScore ?? null,
        awayScore: merged.awayScore ?? entry.awayScore ?? null,
        week: merged.week ?? entry.week ?? null,
        date: merged.date ?? entry.date ?? null,
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
        const { standings: playerStandings, timelines } = computePlayerStandingsFromGames(games);
        statisticsState.playerStandings = playerStandings;
        statisticsState.playerTimelines = timelines;
        statisticsState.errorMessage = null;
        return statisticsState.standings;
      })
      .catch((error) => {
        console.error('Failed to build standings', error);
        statisticsState.standings = new Map();
        statisticsState.playerStandings = new Map();
        statisticsState.playerTimelines = new Map();
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
      const playerKey = escapeAttribute(player.id);
      const playerNameAttr = escapeAttribute(player.player);
      const playerTeamAttr = escapeAttribute(player.team ?? '');
      const rowLabel = player.team ? `${player.player} - ${player.team}` : player.player;
      const rowAriaLabel = escapeAttribute(`View cumulative stats for ${rowLabel}`);

      return `
        <tr
          class="stats-player-row"
          data-player-key="${playerKey}"
          data-player-name="${playerNameAttr}"
          data-player-team="${playerTeamAttr}"
          tabindex="0"
          role="button"
          aria-label="${rowAriaLabel}"
        >
          <th scope="row" aria-label="Player">
            <span class="stats-player-name">${player.player}</span>
            ${teamLine}
          </th>
          <td>${player.gamesPlayed}</td>
          <td>${player.goals}</td>
          <td>${player.assists}</td>
          <td>${player.points}</td>
          <td>${player.ptsPerGame}</td>
          <td>${player.pims}</td>
          <td>${player.hatTricks}</td>
        </tr>
      `;
    })
    .join('');

  const hint = '<p class="stats-table-hint" role="note">Select a player row to view cumulative scoring trends.</p>';

  return `
    ${hint}
    <table class="stats-table stats-table--players">
      <colgroup>
        <col class="stats-player-column" />
        <col span="7" class="stats-player-metric-column" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Player</th>
          <th scope="col">GP</th>
          <th scope="col">G</th>
          <th scope="col">A</th>
          <th scope="col">PTS</th>
          <th scope="col">PTS/GP</th>
          <th scope="col">PIMS</th>
          <th scope="col">Hat Tricks</th>
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
    closePlayerFlyout();
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
    ensurePlayerRowInteractions(playerContainer);
  }
}

function getFocusableElements(root) {
  if (!root) {
    return [];
  }

  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];

  return Array.from(root.querySelectorAll(selectors.join(', '))).filter(
    (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  );
}

function ensurePlayerRowInteractions(container) {
  if (!container || container.dataset.playerInteraction === 'bound') {
    return;
  }

  container.addEventListener('click', handlePlayerRowClick);
  container.addEventListener('keydown', handlePlayerRowKeydown);
  container.dataset.playerInteraction = 'bound';
}

function handlePlayerRowClick(event) {
  const target = event.target instanceof HTMLElement ? event.target.closest('tr[data-player-key]') : null;
  if (!target) {
    return;
  }

  event.preventDefault();
  openPlayerFlyout(target);
}

function handlePlayerRowKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  const target = event.target instanceof HTMLElement ? event.target.closest('tr[data-player-key]') : null;
  if (!target) {
    return;
  }

  event.preventDefault();
  openPlayerFlyout(target);
}

function initializePlayerFlyout(root) {
  if (!root) {
    return;
  }

  const container = root.querySelector('[data-player-flyout]');
  if (!container) {
    return;
  }

  playerFlyoutElements.container = container;
  playerFlyoutElements.panel = container.querySelector('[data-player-flyout-panel]') ?? container.querySelector('.stats-flyout__panel');
  playerFlyoutElements.title = container.querySelector('#player-flyout-title');
  playerFlyoutElements.subtitle = container.querySelector('[data-player-flyout-subtitle]');
  playerFlyoutElements.chart = container.querySelector('[data-player-chart]');
  playerFlyoutElements.closeButtons = Array.from(container.querySelectorAll('[data-player-flyout-close]'));

  playerFlyoutElements.closeButtons.forEach((button) => {
    if (button.dataset.playerFlyoutBound === 'true') {
      return;
    }
    button.addEventListener('click', () => {
      closePlayerFlyout();
    });
    button.dataset.playerFlyoutBound = 'true';
  });

  if (container.dataset.playerFlyoutBackdrop !== 'true') {
    container.addEventListener('click', (event) => {
      if (event.target === container) {
        closePlayerFlyout();
      }
    });
    container.dataset.playerFlyoutBackdrop = 'true';
  }

  if (!flyoutKeydownBound) {
    document.addEventListener('keydown', handleFlyoutKeydown);
    flyoutKeydownBound = true;
  }
}

function isPlayerFlyoutOpen() {
  return Boolean(playerFlyoutElements.container && !playerFlyoutElements.container.hasAttribute('hidden'));
}

function openPlayerFlyout(row) {
  if (!row) {
    return;
  }

  const container = playerFlyoutElements.container;
  if (!container) {
    return;
  }

  const key = row.dataset.playerKey;
  const division = statisticsState.selectedDivision;
  const timelines = statisticsState.playerTimelines instanceof Map ? statisticsState.playerTimelines : new Map();
  const divisionTimelines = timelines.get(division);
  const timeline = divisionTimelines instanceof Map ? divisionTimelines.get(key) : null;

  const playerName = row.dataset.playerName || row.querySelector('.stats-player-name')?.textContent?.trim() || 'Player';
  const teamName = row.dataset.playerTeam || row.querySelector('.stats-player-team')?.textContent?.trim() || '';

  if (playerFlyoutElements.title) {
    playerFlyoutElements.title.textContent = playerName;
  }

  if (playerFlyoutElements.subtitle) {
    const divisionLabel = division ? `${division} Division` : '';
    if (teamName && divisionLabel) {
      playerFlyoutElements.subtitle.textContent = `${teamName} - ${divisionLabel}`;
    } else if (teamName) {
      playerFlyoutElements.subtitle.textContent = teamName;
    } else {
      playerFlyoutElements.subtitle.textContent = divisionLabel;
    }
  }

  if (playerFlyoutElements.chart) {
    playerFlyoutElements.chart.innerHTML = renderPlayerTimelineChart(playerName, teamName, division, timeline);
  }

  container.removeAttribute('hidden');
  container.classList.add('is-visible');
  container.setAttribute('aria-hidden', 'false');

  lastFocusedPlayerRow = row;

  const focusTargets = getFocusableElements(playerFlyoutElements.panel ?? container);
  if (focusTargets.length) {
    focusTargets[0].focus({ preventScroll: true });
  } else {
    container.setAttribute('tabindex', '-1');
    container.focus({ preventScroll: true });
  }
}

function closePlayerFlyout() {
  const container = playerFlyoutElements.container;
  if (!container || container.hasAttribute('hidden')) {
    return;
  }

  container.classList.remove('is-visible');
  container.setAttribute('aria-hidden', 'true');
  container.setAttribute('hidden', '');

  if (playerFlyoutElements.chart) {
    playerFlyoutElements.chart.innerHTML = '';
  }

  const previousFocus = lastFocusedPlayerRow;
  lastFocusedPlayerRow = null;
  if (previousFocus && document.body.contains(previousFocus)) {
    previousFocus.focus({ preventScroll: true });
  }
}

function handleFlyoutKeydown(event) {
  if (!isPlayerFlyoutOpen()) {
    return;
  }

  const container = playerFlyoutElements.container;
  if (!container || !container.contains(event.target)) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closePlayerFlyout();
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusScope = playerFlyoutElements.panel ?? container;
  const focusable = getFocusableElements(focusScope);
  if (!focusable.length) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function renderPlayerTimelineChart(playerName, teamName, division, timeline) {
  if (!Array.isArray(timeline) || !timeline.length) {
    return '<div class="empty-state">No scoring data recorded yet for this player.</div>';
  }

  const normalizedTimeline = timeline.map((point) => ({
    week: Number(point.week) || 0,
    cumulativeGoals: Number(point.cumulativeGoals) || 0,
    cumulativeAssists: Number(point.cumulativeAssists) || 0,
    cumulativePoints: Number(point.cumulativePoints) || 0,
  }));

  const { width, height, margin } = PLAYER_CHART_DIMENSIONS;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const weeks = normalizedTimeline.map((point) => point.week);
  const minWeek = Math.min(...weeks);
  const maxWeek = Math.max(...weeks);
  const weekSpan = Math.max(1, maxWeek - minWeek);

  const maxValue = Math.max(
    ...normalizedTimeline.map((point) =>
      Math.max(point.cumulativePoints, point.cumulativeGoals, point.cumulativeAssists),
    ),
  );
  const valueSpan = Math.max(1, maxValue);

  const xPos = (week) =>
    margin.left + (weekSpan === 0 ? 0 : ((week - minWeek) / weekSpan) * innerWidth);
  const yPos = (value) => margin.top + innerHeight - (valueSpan === 0 ? 0 : (value / valueSpan) * innerHeight);

  const buildPath = (key) =>
    normalizedTimeline
      .map((point, index) => {
        const x = xPos(point.week).toFixed(2);
        const y = yPos(point[key]).toFixed(2);
        return `${index === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');

  const pointsPath = buildPath('cumulativePoints');
  const goalsPath = buildPath('cumulativeGoals');
  const assistsPath = buildPath('cumulativeAssists');

  const pointsMarkers = normalizedTimeline
    .map(
      (point) =>
        `<circle class="stats-chart__marker stats-chart__marker--points" cx="${xPos(point.week).toFixed(2)}" cy="${yPos(point.cumulativePoints).toFixed(2)}" r="3"></circle>`,
    )
    .join('');
  const goalsMarkers = normalizedTimeline
    .map(
      (point) =>
        `<circle class="stats-chart__marker stats-chart__marker--goals" cx="${xPos(point.week).toFixed(2)}" cy="${yPos(point.cumulativeGoals).toFixed(2)}" r="3"></circle>`,
    )
    .join('');
  const assistsMarkers = normalizedTimeline
    .map(
      (point) =>
        `<circle class="stats-chart__marker stats-chart__marker--assists" cx="${xPos(point.week).toFixed(2)}" cy="${yPos(point.cumulativeAssists).toFixed(2)}" r="3"></circle>`,
    )
    .join('');

  const uniqueWeeks = [...new Set(weeks)].sort((a, b) => a - b);
  const axisY = height - margin.bottom;
  const axisX = margin.left;

  const xTicks = uniqueWeeks
    .map((week) => {
      const x = xPos(week).toFixed(2);
      return `<g class="stats-chart__tick stats-chart__tick--x" transform="translate(${x}, ${axisY})">
          <line class="stats-chart__tick-line" y2="6"></line>
          <text class="stats-chart__tick-label" dy="1.8em">W${week}</text>
        </g>`;
    })
    .join('');

  const approxTicks = Math.min(5, Math.ceil(valueSpan) + 1);
  const tickStep = Math.max(1, Math.floor(valueSpan / (approxTicks - 1)) || 1);
  const tickValuesSet = new Set();
  for (let value = 0; value <= valueSpan; value += tickStep) {
    tickValuesSet.add(Math.min(valueSpan, Math.round(value)));
  }
  tickValuesSet.add(valueSpan);
  tickValuesSet.add(0);
  const tickValues = Array.from(tickValuesSet).sort((a, b) => a - b);

  const yTicks = tickValues
    .map((value) => {
      const y = yPos(value).toFixed(2);
      return `<g class="stats-chart__tick stats-chart__tick--y" transform="translate(${axisX}, ${y})">
          <line class="stats-chart__tick-line" x1="-6"></line>
          <text class="stats-chart__tick-label stats-chart__tick-label--y" dx="-0.8em" dy="0.32em">${value}</text>
        </g>`;
    })
    .join('');

  const gridLines = tickValues
    .map((value) => {
      const y = yPos(value).toFixed(2);
      return `<line class="stats-chart__grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${y}" y2="${y}"></line>`;
    })
    .join('');

  const chartId = `player-chart-${Math.random().toString(36).slice(2, 8)}`;
  const subtitleParts = [];
  if (teamName) {
    subtitleParts.push(teamName);
  }
  if (division) {
    subtitleParts.push(`${division} Division`);
  }
  const subtitle = subtitleParts.join(' - ');

  const latest = normalizedTimeline[normalizedTimeline.length - 1];
  const summary = `<dl class="stats-flyout__summary">
      <div>
        <dt>Total Goals</dt>
        <dd>${latest.cumulativeGoals}</dd>
      </div>
      <div>
        <dt>Total Assists</dt>
        <dd>${latest.cumulativeAssists}</dd>
      </div>
      <div>
        <dt>Total Points</dt>
        <dd>${latest.cumulativePoints}</dd>
      </div>
    </dl>`;

  return `
    <div class="stats-chart__wrapper">
      <svg
        class="stats-chart__svg"
        viewBox="0 0 ${width} ${height}"
        role="img"
        aria-labelledby="${chartId}-title ${chartId}-desc"
      >
        <title id="${chartId}-title">Cumulative scoring for ${playerName}</title>
        <desc id="${chartId}-desc">${subtitle || 'Cumulative scoring timeline'}</desc>
        <g class="stats-chart__grid">
          ${gridLines}
        </g>
        <line class="stats-chart__axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${axisY}" y2="${axisY}"></line>
        <line class="stats-chart__axis-line" x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${axisY}"></line>
        <g class="stats-chart__ticks stats-chart__ticks--x">
          ${xTicks}
        </g>
        <g class="stats-chart__ticks stats-chart__ticks--y">
          ${yTicks}
        </g>
        <path class="stats-chart__line stats-chart__line--points" d="${pointsPath}"></path>
        <path class="stats-chart__line stats-chart__line--goals" d="${goalsPath}"></path>
        <path class="stats-chart__line stats-chart__line--assists" d="${assistsPath}"></path>
        ${pointsMarkers}
        ${goalsMarkers}
        ${assistsMarkers}
      </svg>
    </div>
    ${summary}
  `;
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
            <div class="empty-state">Loading statistics...</div>
          </div>
        </div>
        <div class="stats-section">
          <h2>Player Standings</h2>
          <div class="stats-table-container" data-player-standings>
            <div class="empty-state">Loading statistics...</div>
          </div>
        </div>
      </div>
      <div class="stats-flyout" data-player-flyout hidden aria-hidden="true" tabindex="-1">
        <div class="stats-flyout__panel" data-player-flyout-panel role="dialog" aria-modal="true" aria-labelledby="player-flyout-title">
          <div class="stats-flyout__header">
            <h3 id="player-flyout-title">Player Statistics</h3>
            <button type="button" class="stats-flyout__close" data-player-flyout-close aria-label="Close player statistics">&times;</button>
          </div>
          <p class="stats-flyout__subtitle" data-player-flyout-subtitle></p>
          <div class="stats-flyout__legend">
            <span class="stats-flyout__legend-item stats-flyout__legend-item--points">Points</span>
            <span class="stats-flyout__legend-item stats-flyout__legend-item--goals">Goals</span>
            <span class="stats-flyout__legend-item stats-flyout__legend-item--assists">Assists</span>
          </div>
          <div class="stats-flyout__chart" data-player-chart></div>
          <button type="button" class="btn stats-flyout__action" data-player-flyout-close>Close</button>
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

    initializePlayerFlyout(main);
    ensurePlayerRowInteractions(playerContainer);

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
      closePlayerFlyout();
      markActiveDivision(filterContainer, division);
      updateStandingsView(containers, division);
    });

    statisticsState.errorMessage = null;
    const loadingMarkup = '<div class="empty-state">Loading statistics...</div>';
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
        closePlayerFlyout();
        updateStandingsView(containers, statisticsState.selectedDivision);
      });
  },
};

