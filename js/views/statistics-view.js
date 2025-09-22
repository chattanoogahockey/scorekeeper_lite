const DIVISIONS = ['Gold', 'Silver', 'Bronze'];
const DEFAULT_DIVISION = 'Gold';

const TEAM_SORT_DEFAULT = Object.freeze({ key: 'points', direction: 'desc' });
const PLAYER_SORT_DEFAULT = Object.freeze({ key: 'points', direction: 'desc' });

const TEAM_SORT_DEFAULT_DIRECTIONS = {
  team: 'asc',
  losses: 'asc',
  goalsAgainst: 'asc',
};

const PLAYER_SORT_DEFAULT_DIRECTIONS = {
  player: 'asc',
};

const TEAM_SORT_CONFIG = {
  team: { type: 'string', accessor: (record) => `${record.team ?? ''}` },
  gamesPlayed: { type: 'number', accessor: (record) => record.gamesPlayed ?? 0 },
  wins: { type: 'number', accessor: (record) => record.wins ?? 0 },
  losses: { type: 'number', accessor: (record) => record.losses ?? 0 },
  points: { type: 'number', accessor: (record) => record.points ?? 0 },
  overtime: { type: 'number', accessor: (record) => record.overtime ?? 0 },
  goalsFor: { type: 'number', accessor: (record) => record.goalsFor ?? 0 },
  goalsAgainst: { type: 'number', accessor: (record) => record.goalsAgainst ?? 0 },
};

const PLAYER_SORT_CONFIG = {
  player: { type: 'string', accessor: (record) => `${record.player ?? ''}` },
  gamesPlayed: { type: 'number', accessor: (record) => record.gamesPlayed ?? 0 },
  goals: { type: 'number', accessor: (record) => record.goals ?? 0 },
  assists: { type: 'number', accessor: (record) => record.assists ?? 0 },
  points: { type: 'number', accessor: (record) => record.points ?? 0 },
  ptsPerGame: { type: 'number', accessor: (record) => record.ptsPerGame ?? 0 },
  pims: { type: 'number', accessor: (record) => record.pims ?? 0 },
  hatTricks: { type: 'number', accessor: (record) => record.hatTricks ?? 0 },
};

const TEAM_TABLE_COLUMNS = [
  { key: 'team', label: 'Team', sortable: true },
  { key: 'gamesPlayed', label: 'GP', sortable: true },
  { key: 'wins', label: 'W', sortable: true },
  { key: 'losses', label: 'L', sortable: true },
  { key: 'points', label: 'PTS', sortable: true },
  { key: 'overtime', label: 'OT', sortable: true },
  { key: 'goalsFor', label: 'GF', sortable: true },
  { key: 'goalsAgainst', label: 'GA', sortable: true },
];

const PLAYER_TABLE_COLUMNS = [
  { key: 'player', label: 'Player', sortable: true },
  { key: 'gamesPlayed', label: 'GP', sortable: true },
  { key: 'goals', label: 'G', sortable: true },
  { key: 'assists', label: 'A', sortable: true },
  { key: 'points', label: 'PTS', sortable: true },
  { key: 'ptsPerGame', label: 'PTS/GP', sortable: true },
  { key: 'pims', label: 'PIMS', sortable: true },
  { key: 'hatTricks', label: 'Hat Tricks', sortable: true },
];

const statisticsState = {
  selectedDivision: DEFAULT_DIVISION,
  standings: null,
  playerStandings: null,
  playerTimelines: null,
  teamTimelines: null,
  errorMessage: null,
  teamSort: { ...TEAM_SORT_DEFAULT },
  playerSort: { ...PLAYER_SORT_DEFAULT },
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
const teamFlyoutElements = {
  container: null,
  panel: null,
  title: null,
  subtitle: null,
  chart: null,
  closeButtons: [],
};

let lastFocusedTeamRow = null;
let teamFlyoutKeydownBound = false;


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
function isAnonymousPlayerName(name) {
  const normalized = `${name ?? ''}`.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return normalized === 'sub';
}


function formatFlyoutSubtitle(parts) {
  const bullet = 'Ã¢â‚¬Â¢';
  return parts
    .map((value) => `${value ?? ''}`.trim())
    .filter((value) => value.length > 0)
    .join(` ${bullet} `);
}

function computeTotalGames(timeline, override = null) {
  if (Number.isFinite(override)) {
    return override;
  }

  if (!Array.isArray(timeline) || !timeline.length) {
    return 0;
  }

  const latest = timeline[timeline.length - 1];
  if (latest && Number.isFinite(latest.cumulativeGames)) {
    return latest.cumulativeGames;
  }

  return timeline.reduce((sum, point) => sum + (Number(point.games) || 0), 0);
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

function getOvertimeWinner(game) {
  if (!game || typeof game !== 'object') {
    return null;
  }

  const result = game.overtimeResult;
  if (!result || typeof result !== 'object') {
    return null;
  }

  const winner = `${result.winner ?? ''}`.trim();
  return winner.length ? winner : null;
}

function detectOvertime(game) {
  if (getOvertimeWinner(game)) {
    return true;
  }

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

function compareTeamsDefault(teamA, teamB) {
  if ((teamA.points ?? 0) !== (teamB.points ?? 0)) {
    return (teamB.points ?? 0) - (teamA.points ?? 0);
  }

  if ((teamA.wins ?? 0) !== (teamB.wins ?? 0)) {
    return (teamB.wins ?? 0) - (teamA.wins ?? 0);
  }

  const diffA = (teamA.goalsFor ?? 0) - (teamA.goalsAgainst ?? 0);
  const diffB = (teamB.goalsFor ?? 0) - (teamB.goalsAgainst ?? 0);
  if (diffA !== diffB) {
    return diffB - diffA;
  }

  if ((teamA.goalsFor ?? 0) !== (teamB.goalsFor ?? 0)) {
    return (teamB.goalsFor ?? 0) - (teamA.goalsFor ?? 0);
  }

  return `${teamA.team ?? ''}`.localeCompare(`${teamB.team ?? ''}`);
}

function sortStandings(records) {
  return [...records].sort(compareTeamsDefault);
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

    const overtimeWinner = getOvertimeWinner(game);
    const overtimeGame = overtimeWinner ? true : detectOvertime(game);

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
    } else if (overtimeWinner === homeTeam) {
      homeRecord.wins += 1;
      homeRecord.points += 2;
      awayRecord.overtime += 1;
      awayRecord.points += 1;
    } else if (overtimeWinner === awayTeam) {
      awayRecord.wins += 1;
      awayRecord.points += 2;
      homeRecord.overtime += 1;
      homeRecord.points += 1;
    } else {
      // Handle the rare case of a tie game with no OT/Shootout result.
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
  if (!name || isAnonymousPlayerName(name)) {
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

  const entry = { goals: 0, assists: 0, points: 0, games: new Set() };
  weekMap.set(weekNumber, entry);
  return entry;
}

function ensureTeamWeekStats(collection, teamKey, weekNumber) {
  const weekMap = collection.get(teamKey) ?? new Map();
  if (!collection.has(teamKey)) {
    collection.set(teamKey, weekMap);
  }

  const existing = weekMap.get(weekNumber);
  if (existing) {
    return existing;
  }

  const entry = { goals: 0, assists: 0, points: 0, games: new Set() };
  weekMap.set(weekNumber, entry);
  return entry;
}

function comparePlayersDefault(playerA, playerB) {
  const pointsA = playerA.points ?? 0;
  const pointsB = playerB.points ?? 0;

  if (pointsA !== pointsB) {
    return pointsB - pointsA;
  }

  const goalsA = playerA.goals ?? 0;
  const goalsB = playerB.goals ?? 0;
  if (goalsA !== goalsB) {
    return goalsB - goalsA;
  }

  const assistsA = playerA.assists ?? 0;
  const assistsB = playerB.assists ?? 0;
  if (assistsA !== assistsB) {
    return assistsB - assistsA;
  }

  const hatTricksA = playerA.hatTricks ?? 0;
  const hatTricksB = playerB.hatTricks ?? 0;
  if (hatTricksA !== hatTricksB) {
    return hatTricksB - hatTricksA;
  }

  const pimsA = playerA.pims ?? 0;
  const pimsB = playerB.pims ?? 0;
  if (pimsA !== pimsB) {
    return pimsA - pimsB;
  }

  return `${playerA.player ?? ''}`.localeCompare(`${playerB.player ?? ''}`);
}

function sortPlayerStandings(records) {
  return [...records].sort(comparePlayersDefault);
}

function computePlayerStandingsFromGames(games) {
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
      goalWeeklyStats.games.add(gameId);
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
          assistWeeklyStats.games.add(gameId);
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
        const { record, key } = penaltyEntry;
        record.pims += minutes;
        record.games.add(gameId);

        const penaltyWeeklyStats = ensurePlayerWeekStats(divisionWeekly, key, weekNumber);
        penaltyWeeklyStats.games.add(gameId);
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
      let cumulativeGames = 0;

      const timeline = sortedWeeks.map((weekValue) => {
        const weeklyTotals = weekStatsMap.get(weekValue) ?? { goals: 0, assists: 0, points: 0, games: new Set() };
        const gamesPlayed = weeklyTotals.games instanceof Set ? weeklyTotals.games.size : 0;
        cumulativeGames += gamesPlayed;
        cumulativeGoals += weeklyTotals.goals;
        cumulativeAssists += weeklyTotals.assists;
        cumulativePoints += weeklyTotals.points;

        return {
          week: weekValue,
          games: gamesPlayed,
          goals: weeklyTotals.goals,
          assists: weeklyTotals.assists,
          points: weeklyTotals.points,
          cumulativeGoals,
          cumulativeAssists,
          cumulativePoints,
          cumulativeGames,
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

function computeTeamTimelinesFromGames(games) {
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

    const divisionWeekly = perDivisionWeekly.get(divisionName) ?? new Map();
    if (!perDivisionWeekly.has(divisionName)) {
      perDivisionWeekly.set(divisionName, divisionWeekly);
    }

    const homeTeam = `${game.homeTeam ?? ''}`.trim();
    const awayTeam = `${game.awayTeam ?? ''}`.trim();
    if (!homeTeam || !awayTeam) {
      return;
    }

    const homeWeekStats = ensureTeamWeekStats(divisionWeekly, homeTeam, weekNumber);
    const awayWeekStats = ensureTeamWeekStats(divisionWeekly, awayTeam, weekNumber);
    homeWeekStats.games.add(gameId);
    awayWeekStats.games.add(gameId);

    const homeScore = toScore(game.homeScore) ?? 0;
    const awayScore = toScore(game.awayScore) ?? 0;
    homeWeekStats.goals += homeScore;
    awayWeekStats.goals += awayScore;

    const goals = Array.isArray(game.goals) ? game.goals : [];
    goals.forEach((goal) => {
      if (!goal || typeof goal !== 'object') {
        return;
      }

      const scoringTeam = `${goal.team ?? ''}`.trim();
      if (!scoringTeam) {
        return;
      }

      const targetDivision = divisionWeekly.get(scoringTeam);
      const targetStats = targetDivision ? targetDivision.get(weekNumber) : null;
      if (!targetStats) {
        return;
      }

      const assistName = `${goal.assist ?? ''}`.trim();
      if (assistName) {
        targetStats.assists += 1;
      }
    });

    const overtimeWinner = getOvertimeWinner(game);
    const overtimeGame = overtimeWinner ? true : detectOvertime(game);
    if (homeScore > awayScore) {
      homeWeekStats.points += 2;
      awayWeekStats.points += overtimeGame ? 1 : 0;
    } else if (awayScore > homeScore) {
      awayWeekStats.points += 2;
      homeWeekStats.points += overtimeGame ? 1 : 0;
    } else if (overtimeWinner === homeTeam) {
      homeWeekStats.points += 2;
      awayWeekStats.points += 1;
    } else if (overtimeWinner === awayTeam) {
      awayWeekStats.points += 2;
      homeWeekStats.points += 1;
    } else {
      homeWeekStats.points += 1;
      awayWeekStats.points += 1;
    }
  });

  const finalTimelines = new Map();

  perDivisionWeekly.forEach((divisionWeekly, divisionName) => {
    const timelineMap = new Map();

    divisionWeekly.forEach((weekStatsMap, teamName) => {
      const sortedWeeks = [...weekStatsMap.keys()].sort((a, b) => a - b);
      let cumulativeGoals = 0;
      let cumulativeAssists = 0;
      let cumulativePoints = 0;
      let cumulativeGames = 0;

      const timeline = sortedWeeks.map((weekValue) => {
        const weeklyTotals = weekStatsMap.get(weekValue) ?? { goals: 0, assists: 0, points: 0, games: new Set() };
        const gamesPlayed = weeklyTotals.games instanceof Set ? weeklyTotals.games.size : 0;
        cumulativeGames += gamesPlayed;
        cumulativeGoals += weeklyTotals.goals;
        cumulativeAssists += weeklyTotals.assists;
        cumulativePoints += weeklyTotals.points;

        return {
          week: weekValue,
          games: gamesPlayed,
          goals: weeklyTotals.goals,
          assists: weeklyTotals.assists,
          points: weeklyTotals.points,
          cumulativeGoals,
          cumulativeAssists,
          cumulativePoints,
          cumulativeGames,
        };
      });

      if (timeline.length) {
        timelineMap.set(teamName, timeline);
      }
    });

    finalTimelines.set(divisionName, timelineMap);
  });

  return finalTimelines;
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
        overtimeResult: merged.overtimeResult ?? entry.overtimeResult ?? null,
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
        statisticsState.teamTimelines = computeTeamTimelinesFromGames(games);
        statisticsState.errorMessage = null;
        return statisticsState.standings;
      })
      .catch((error) => {
        console.error('Failed to build standings', error);
        statisticsState.standings = new Map();
        statisticsState.playerStandings = new Map();
        statisticsState.playerTimelines = new Map();
        statisticsState.teamTimelines = new Map();
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

function resolveInitialSortDirection(scope, key) {
  const defaults = scope === 'team' ? TEAM_SORT_DEFAULT_DIRECTIONS : PLAYER_SORT_DEFAULT_DIRECTIONS;
  const fallback = scope === 'team' ? TEAM_SORT_DEFAULT.direction : PLAYER_SORT_DEFAULT.direction;
  return defaults[key] ?? fallback;
}

function getNormalizedSortState(scope) {
  const defaultState = scope === 'team' ? TEAM_SORT_DEFAULT : PLAYER_SORT_DEFAULT;
  const config = scope === 'team' ? TEAM_SORT_CONFIG : PLAYER_SORT_CONFIG;
  const current = scope === 'team' ? statisticsState.teamSort : statisticsState.playerSort;

  const candidateKey = current && typeof current.key === 'string' && config[current.key] ? current.key : defaultState.key;
  const candidateDirection = current && (current.direction === 'asc' || current.direction === 'desc')
    ? current.direction
    : resolveInitialSortDirection(scope, candidateKey);

  return { key: candidateKey, direction: candidateDirection };
}

function compareValuesForSort(aValue, bValue, direction, type = 'number') {
  if (type === 'string') {
    const aText = `${aValue ?? ''}`.toLowerCase();
    const bText = `${bValue ?? ''}`.toLowerCase();
    if (aText === bText) {
      return 0;
    }
    const comparison = aText.localeCompare(bText);
    return direction === 'desc' ? -comparison : comparison;
  }

  const aNumber = Number(aValue);
  const bNumber = Number(bValue);
  const normalizedA = Number.isFinite(aNumber) ? aNumber : 0;
  const normalizedB = Number.isFinite(bNumber) ? bNumber : 0;
  if (normalizedA === normalizedB) {
    return 0;
  }
  return direction === 'desc' ? normalizedB - normalizedA : normalizedA - normalizedB;
}

function compareRecordsBySort(recordA, recordB, sortState, config, fallbackComparator) {
  const entry = config[sortState.key];
  if (entry && typeof entry.accessor === 'function') {
    const comparison = compareValuesForSort(entry.accessor(recordA), entry.accessor(recordB), sortState.direction, entry.type);
    if (comparison !== 0) {
      return comparison;
    }
  }
  return fallbackComparator(recordA, recordB);
}

function createSortHeader(scope, column, sortState) {
  if (!column.sortable) {
    return `<th scope="col">${column.label}</th>`;
  }

  const isActive = sortState.key === column.key;
  const currentDirection = isActive ? sortState.direction : resolveInitialSortDirection(scope, column.key);
  const nextDirection = isActive && currentDirection === 'desc' ? 'asc' : 'desc';
  const ariaSort = isActive ? (currentDirection === 'desc' ? 'descending' : 'ascending') : 'none';
  const indicator = isActive ? (currentDirection === 'desc' ? '&darr;' : '&uarr;') : '';
  const ariaLabel = isActive
    ? `Sort by ${column.label} (${nextDirection === 'desc' ? 'descending' : 'ascending'})`
    : `Sort by ${column.label}`;

  return `<th scope="col" aria-sort="${ariaSort}"><button type="button" class="stats-sort-button${isActive ? ' is-active' : ''}" data-sort-scope="${scope}" data-sort-key="${column.key}" data-sort-direction="${nextDirection}" aria-label="${ariaLabel}">${column.label}<span aria-hidden="true" class="stats-sort-indicator">${indicator}</span></button></th>`;
}


function ensureTeamSortInteractions(container, containers) {
  if (!container || container.dataset.teamSortBound === 'true') {
    return;
  }

  container.addEventListener('click', (event) => {
    handleStandingsSortClick(event, 'team', containers);
  });
  container.dataset.teamSortBound = 'true';
}
function markActiveDivision(container, division) {
  if (!container) {
    return;
  }

  const buttons = Array.from(container.querySelectorAll('[data-division]')).filter((button) => button instanceof HTMLElement);
  if (!buttons.length) {
    return;
  }

  let activeFound = false;
  buttons.forEach((button) => {
    const isActive = button.dataset.division === division;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.setAttribute('tabindex', isActive ? '0' : '-1');
    if (isActive) {
      button.setAttribute('aria-current', 'true');
      activeFound = true;
    } else {
      button.removeAttribute('aria-current');
    }
  });

  if (!activeFound) {
    const [firstButton] = buttons;
    if (firstButton) {
      firstButton.classList.add('is-active');
      firstButton.setAttribute('aria-pressed', 'true');
      firstButton.setAttribute('tabindex', '0');
      firstButton.setAttribute('aria-current', 'true');
    }
  }
}

function updateStandingsView(containers, division) {
  const teamContainer = containers?.team ?? null;
  const playerContainer = containers?.player ?? null;

  if (!teamContainer && !playerContainer) {
    return;
  }

  if (statisticsState.errorMessage) {
    closePlayerFlyout();
    closeTeamFlyout();
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
    ensureTeamSortInteractions(teamContainer, containers);
    ensureTeamRowInteractions(teamContainer);
  }

  if (playerContainer) {
    playerContainer.innerHTML = renderPlayerStandingsTable(division);
    ensurePlayerSortInteractions(playerContainer, containers);
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
    document.addEventListener('keydown', handlePlayerFlyoutKeydown);
    flyoutKeydownBound = true;
  }
}



function ensurePlayerSortInteractions(container, containers) {
  if (!container || container.dataset.playerSortBound === 'true') {
    return;
  }

  container.addEventListener('click', (event) => {
    handleStandingsSortClick(event, 'player', containers);
  });
  container.dataset.playerSortBound = 'true';
}

function handleStandingsSortClick(event, scope, containers) {
  const button = event.target instanceof HTMLElement ? event.target.closest('.stats-sort-button') : null;
  if (!button || button.dataset.sortScope !== scope) {
    return;
  }

  event.preventDefault();
  const sortKey = button.dataset.sortKey;
  const config = scope === 'team' ? TEAM_SORT_CONFIG : PLAYER_SORT_CONFIG;
  if (!sortKey || !config[sortKey]) {
    return;
  }

  const currentSort = getNormalizedSortState(scope);
  const direction = currentSort.key === sortKey ? (currentSort.direction === 'desc' ? 'asc' : 'desc') : resolveInitialSortDirection(scope, sortKey);

  if (scope === 'team') {
    statisticsState.teamSort = { key: sortKey, direction };
    closeTeamFlyout();
  } else {
    statisticsState.playerSort = { key: sortKey, direction };
    closePlayerFlyout();
  }

  updateStandingsView(containers, statisticsState.selectedDivision);
}

function renderTeamStandingsTable(division) {
  const standings = statisticsState.standings instanceof Map ? statisticsState.standings : new Map();
  const teams = standings.get(division) ?? [];

  if (!teams.length) {
    return '<div class="empty-state">No completed games yet for this division.</div>';
  }

  const sortState = getNormalizedSortState('team');
  const sortedTeams = [...teams].sort((teamA, teamB) => compareRecordsBySort(teamA, teamB, sortState, TEAM_SORT_CONFIG, compareTeamsDefault));

  const rows = sortedTeams
    .map((team) => {
      const teamNameAttr = escapeAttribute(team.team);
      const rowAriaLabel = escapeAttribute(`View cumulative trends for ${team.team}`);
      return `
        <tr
          class="stats-team-row"
          data-team-name="${teamNameAttr}"
          tabindex="0"
          role="button"
          aria-label="${rowAriaLabel}"
        >
          <th scope="row" aria-label="Team">${team.team}</th>
          <td>${team.gamesPlayed}</td>
          <td>${team.wins}</td>
          <td>${team.losses}</td>
          <td>${team.points}</td>
          <td>${team.overtime}</td>
          <td>${team.goalsFor}</td>
          <td>${team.goalsAgainst}</td>
        </tr>
      `;
    })
    .join('');

  const header = TEAM_TABLE_COLUMNS.map((column) => createSortHeader('team', column, sortState)).join('');
  const hint = '<p class="stats-table-hint" role="note">Select a team row to view cumulative performance trends. Click any column heading to sort.</p>';

  return `
    ${hint}
    <table class="stats-table">
      <colgroup>
        <col class="stats-team-column" />
        <col span="7" class="stats-metric-column" />
      </colgroup>
      <thead>
        <tr>
          ${header}
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

  const sortState = getNormalizedSortState('player');
  const sortedPlayers = [...players].sort((playerA, playerB) => compareRecordsBySort(playerA, playerB, sortState, PLAYER_SORT_CONFIG, comparePlayersDefault));

  const rows = sortedPlayers
    .map((player) => {
      const teamLine = player.team ? `<span class="stats-player-team">${player.team}</span>` : '';
      const playerKey = escapeAttribute(player.id);
      const playerNameAttr = escapeAttribute(player.player);
      const playerTeamAttr = escapeAttribute(player.team ?? '');
      const playerGamesAttr = escapeAttribute(String(player.gamesPlayed ?? 0));
      const rowLabel = player.team ? `${player.player} - ${player.team}` : player.player;
      const rowAriaLabel = escapeAttribute(`View cumulative stats for ${rowLabel}`);

      return `
        <tr
          class="stats-player-row"
          data-player-key="${playerKey}"
          data-player-name="${playerNameAttr}"
          data-player-team="${playerTeamAttr}"
          data-player-games="${playerGamesAttr}"
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

  const header = PLAYER_TABLE_COLUMNS.map((column) => createSortHeader('player', column, sortState)).join('');
  const hint = '<p class="stats-table-hint" role="note">Select a player row to view cumulative scoring trends. Click any column heading to sort.</p>'

  return `
    ${hint}
    <table class="stats-table stats-table--players">
      <colgroup>
        <col class="stats-player-column" />
        <col span="7" class="stats-player-metric-column" />
      </colgroup>
      <thead>
        <tr>
          ${header}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
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
  const gamesFromDataset = Number.parseInt(row.dataset.playerGames ?? '', 10);
  const totalGames = Number.isFinite(gamesFromDataset) ? gamesFromDataset : null;

  if (playerFlyoutElements.title) {
    playerFlyoutElements.title.textContent = playerName;
  }

  if (playerFlyoutElements.subtitle) {
    const divisionLabel = division ? `${division} Division` : '';
    playerFlyoutElements.subtitle.textContent = formatFlyoutSubtitle([teamName, divisionLabel]);
  }

  if (playerFlyoutElements.chart) {
    playerFlyoutElements.chart.innerHTML = renderPlayerTimelineChart(playerName, teamName, division, timeline, totalGames);
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

function handlePlayerFlyoutKeydown(event) {
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
function renderPlayerTimelineChart(playerName, teamName, division, timeline, gamesPlayedOverride = null) {
  if (!Array.isArray(timeline) || !timeline.length) {
    return '<div class="empty-state">No scoring data recorded yet for this player.</div>';
  }

  const normalizedTimeline = timeline.map((point) => ({
    week: Number(point.week) || 0,
    games: Number(point.games) || 0,
    cumulativeGoals: Number(point.cumulativeGoals) || 0,
    cumulativeAssists: Number(point.cumulativeAssists) || 0,
    cumulativePoints: Number(point.cumulativePoints) || 0,
    cumulativeGames: Number(point.cumulativeGames) || 0,
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
  const subtitle = formatFlyoutSubtitle([
    teamName,
    division ? `${division} Division` : '',
  ]);

  const latest = normalizedTimeline[normalizedTimeline.length - 1];
  const gamesPlayedTotal = computeTotalGames(normalizedTimeline, gamesPlayedOverride);
  const summary = `<dl class="stats-flyout__summary">
      <div>
        <dt>Games Played</dt>
        <dd>${gamesPlayedTotal}</dd>
      </div>
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
function ensureTeamRowInteractions(container) {
  if (!container || container.dataset.teamInteraction === 'bound') {
    return;
  }

  container.addEventListener('click', handleTeamRowClick);
  container.addEventListener('keydown', handleTeamRowKeydown);
  container.dataset.teamInteraction = 'bound';
}

function handleTeamRowClick(event) {
  const target = event.target instanceof HTMLElement ? event.target.closest('tr[data-team-name]') : null;
  if (!target) {
    return;
  }

  event.preventDefault();
  openTeamFlyout(target);
}

function handleTeamRowKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  const target = event.target instanceof HTMLElement ? event.target.closest('tr[data-team-name]') : null;
  if (!target) {
    return;
  }

  event.preventDefault();
  openTeamFlyout(target);
}

function initializeTeamFlyout(root) {
  if (!root) {
    return;
  }

  const container = root.querySelector('[data-team-flyout]');
  if (!container) {
    return;
  }

  teamFlyoutElements.container = container;
  teamFlyoutElements.panel = container.querySelector('[data-team-flyout-panel]') ?? container.querySelector('.stats-flyout__panel');
  teamFlyoutElements.title = container.querySelector('#team-flyout-title');
  teamFlyoutElements.subtitle = container.querySelector('[data-team-flyout-subtitle]');
  teamFlyoutElements.chart = container.querySelector('[data-team-chart]');
  teamFlyoutElements.closeButtons = Array.from(container.querySelectorAll('[data-team-flyout-close]'));

  teamFlyoutElements.closeButtons.forEach((button) => {
    if (button.dataset.teamFlyoutBound === 'true') {
      return;
    }
    button.addEventListener('click', () => {
      closeTeamFlyout();
    });
    button.dataset.teamFlyoutBound = 'true';
  });

  if (container.dataset.teamFlyoutBackdrop !== 'true') {
    container.addEventListener('click', (event) => {
      if (event.target === container) {
        closeTeamFlyout();
      }
    });
    container.dataset.teamFlyoutBackdrop = 'true';
  }

  if (!teamFlyoutKeydownBound) {
    document.addEventListener('keydown', handleTeamFlyoutKeydown);
    teamFlyoutKeydownBound = true;
  }
}

function isTeamFlyoutOpen() {
  return Boolean(teamFlyoutElements.container && !teamFlyoutElements.container.hasAttribute('hidden'));
}

function openTeamFlyout(row) {
  if (!row) {
    return;
  }

  initializeTeamFlyout(document.getElementById('main-content'));

  const container = teamFlyoutElements.container;
  if (!container) {
    return;
  }

  const teamName = row.dataset.teamName || row.querySelector('th')?.textContent?.trim() || 'Team';
  const division = statisticsState.selectedDivision;
  const timelines = statisticsState.teamTimelines instanceof Map ? statisticsState.teamTimelines : new Map();
  const divisionTimelines = timelines.get(division);
  const timeline = divisionTimelines instanceof Map ? divisionTimelines.get(teamName) : null;

  if (teamFlyoutElements.title) {
    teamFlyoutElements.title.textContent = teamName;
  }

  if (teamFlyoutElements.subtitle) {
    const divisionLabel = division ? `${division} Division` : '';
    teamFlyoutElements.subtitle.textContent = formatFlyoutSubtitle([divisionLabel]);
  }

  if (teamFlyoutElements.chart) {
    teamFlyoutElements.chart.innerHTML = renderTeamTimelineChart(teamName, division, timeline);
  }

  container.removeAttribute('hidden');
  container.classList.add('is-visible');
  container.setAttribute('aria-hidden', 'false');

  lastFocusedTeamRow = row;

  const focusTargets = getFocusableElements(teamFlyoutElements.panel ?? container);
  if (focusTargets.length) {
    focusTargets[0].focus({ preventScroll: true });
  } else {
    container.setAttribute('tabindex', '-1');
    container.focus({ preventScroll: true });
  }
}

function closeTeamFlyout() {
  const container = teamFlyoutElements.container;
  if (!container || container.hasAttribute('hidden')) {
    return;
  }

  container.classList.remove('is-visible');
  container.setAttribute('aria-hidden', 'true');
  container.setAttribute('hidden', '');

  if (teamFlyoutElements.chart) {
    teamFlyoutElements.chart.innerHTML = '';
  }

  const previousFocus = lastFocusedTeamRow;
  lastFocusedTeamRow = null;
  if (previousFocus && document.body.contains(previousFocus)) {
    previousFocus.focus({ preventScroll: true });
  }
}

function handleTeamFlyoutKeydown(event) {
  if (!isTeamFlyoutOpen()) {
    return;
  }

  const container = teamFlyoutElements.container;
  if (!container || !container.contains(event.target)) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeTeamFlyout();
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusScope = teamFlyoutElements.panel ?? container;
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

function renderTeamTimelineChart(teamName, division, timeline) {
  if (!Array.isArray(timeline) || !timeline.length) {
    return '<div class="empty-state">No team data recorded yet for this division.</div>';
  }

  const normalizedTimeline = timeline.map((point) => ({
    week: Number(point.week) || 0,
    cumulativeGoals: Number(point.cumulativeGoals) || 0,
    cumulativeAssists: Number(point.cumulativeAssists) || 0,
    cumulativePoints: Number(point.cumulativePoints) || 0,
    cumulativeGames: Number(point.cumulativeGames) || 0,
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

  const chartId = `team-chart-${Math.random().toString(36).slice(2, 8)}`;
  const subtitle = formatFlyoutSubtitle([
    division ? `${division} Division` : '',
  ]);

  const latest = normalizedTimeline[normalizedTimeline.length - 1];
  const gamesPlayedTotal = computeTotalGames(normalizedTimeline);
  const summary = `<dl class="stats-flyout__summary">
      <div>
        <dt>Games Played</dt>
        <dd>${gamesPlayedTotal}</dd>
      </div>
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
        <title id="${chartId}-title">Cumulative performance for ${teamName}</title>
        <desc id="${chartId}-desc">${subtitle || 'Cumulative trend timeline'}</desc>
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
      <div class="stats-flyout" data-team-flyout hidden aria-hidden="true" tabindex="-1">
        <div class="stats-flyout__panel" data-team-flyout-panel role="dialog" aria-modal="true" aria-labelledby="team-flyout-title">
          <div class="stats-flyout__header">
            <h3 id="team-flyout-title">Team Statistics</h3>
            <button type="button" class="stats-flyout__close" data-team-flyout-close aria-label="Close team statistics">&times;</button>
          </div>
          <p class="stats-flyout__subtitle" data-team-flyout-subtitle></p>
          <div class="stats-flyout__legend">
            <span class="stats-flyout__legend-item stats-flyout__legend-item--points">Points</span>
            <span class="stats-flyout__legend-item stats-flyout__legend-item--goals">Goals</span>
            <span class="stats-flyout__legend-item stats-flyout__legend-item--assists">Assists</span>
          </div>
          <div class="stats-flyout__chart" data-team-chart></div>
          <button type="button" class="btn stats-flyout__action" data-team-flyout-close>Close</button>
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

    statisticsState.selectedDivision = DEFAULT_DIVISION;

    if (!DIVISIONS.includes(statisticsState.selectedDivision)) {
      statisticsState.selectedDivision = DEFAULT_DIVISION;
    }

    const initialDivision = statisticsState.selectedDivision;
    markActiveDivision(filterContainer, initialDivision);

    const containers = { team: teamContainer, player: playerContainer };

    initializeTeamFlyout(main);
    initializePlayerFlyout(main);
    ensureTeamRowInteractions(teamContainer);
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
      closeTeamFlyout();
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
        closeTeamFlyout();
        updateStandingsView(containers, statisticsState.selectedDivision);
      });
  },
};










