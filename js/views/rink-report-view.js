const DIVISIONS = ['Gold', 'Silver', 'Bronze'];
const DEFAULT_DIVISION = 'Bronze';
const DEFAULT_SECTION = 'weekly';

const SECTION_DEFINITIONS = [
  { id: 'weekly', label: 'Weekly Summaries' },
  { id: 'game', label: 'Game Details' },
  { id: 'season-summary', label: 'Season Summaries' },
  { id: 'season-outlook', label: 'Season Outlook' },
];

const PERIOD_ORDER = {
  '1': 1,
  '2': 2,
  '3': 3,
  OT: 4,
  '4': 4,
  SO: 5,
};

const rinkReportState = {
  loading: false,
  loaded: false,
  error: null,
  division: DEFAULT_DIVISION,
  section: DEFAULT_SECTION,
  dataset: null,
  weekFilters: {
    weekly: null,
    game: null,
  },
  selectedGameId: null,
};

const rinkReportCache = {
  promise: null,
};

function normalizeDivision(value) {
  const normalized = `${value ?? ''}`.trim();
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  if (lower === 'bronze') return 'Bronze';
  if (lower === 'silver') return 'Silver';
  if (lower === 'gold') return 'Gold';
  if (lower === 'practice') return 'Practice';
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

function toScore(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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

function formatDateLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return formatter.format(date);
}

function formatPercentage(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0%';
  }
  return `${Math.round(value * 100)}%`;
}

function resolveWeekNumber(rawWeek, referenceDate, division, fallback) {
  const fallbackState = fallback.get(division) ?? { next: 1 };
  let weekNumber = Number.parseInt(`${rawWeek ?? ''}`, 10);

  if (!Number.isFinite(weekNumber) && referenceDate instanceof Date) {
    const startOfYear = new Date(referenceDate.getFullYear(), 0, 1);
    const diff = referenceDate.getTime() - startOfYear.getTime();
    if (Number.isFinite(diff)) {
      weekNumber = Math.max(1, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1);
    }
  }

  if (!Number.isFinite(weekNumber)) {
    weekNumber = fallbackState.next;
    fallbackState.next += 1;
  } else if (weekNumber >= fallbackState.next) {
    fallbackState.next = weekNumber + 1;
  }

  fallback.set(division, fallbackState);
  return weekNumber;
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to load', url, error);
    return null;
  }
}

function buildTeamDivisionMap(rosters) {
  if (!rosters || typeof rosters !== 'object') {
    return new Map();
  }

  const map = new Map();
  Object.entries(rosters).forEach(([teamName, players]) => {
    if (!Array.isArray(players)) {
      return;
    }

    const counts = new Map();
    players.forEach((player) => {
      if (!player || typeof player !== 'object') {
        return;
      }
      const division = normalizeDivision(player.division);
      if (!division) {
        return;
      }
      counts.set(division, (counts.get(division) ?? 0) + 1);
    });

    let chosen = null;
    let maxCount = 0;
    counts.forEach((count, division) => {
      if (count > maxCount) {
        maxCount = count;
        chosen = division;
      }
    });

    if (chosen) {
      map.set(teamName, chosen);
    }
  });

  return map;
}

function compareGameChronological(a, b) {
  const timeA = Number.isFinite(a.timestamp) ? a.timestamp : 0;
  const timeB = Number.isFinite(b.timestamp) ? b.timestamp : 0;
  if (timeA !== timeB) {
    return timeA - timeB;
  }
  return `${a.id ?? ''}`.localeCompare(`${b.id ?? ''}`);
}

function sortGoals(goals) {
  return goals
    .slice()
    .map((goal, index) => ({ ...goal, __index: index }))
    .sort((goalA, goalB) => {
      const periodA = `${goalA.period ?? ''}`.trim().toUpperCase();
      const periodB = `${goalB.period ?? ''}`.trim().toUpperCase();
      const orderA = PERIOD_ORDER[periodA] ?? Number.parseInt(periodA, 10) ?? 99;
      const orderB = PERIOD_ORDER[periodB] ?? Number.parseInt(periodB, 10) ?? 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      const secondsA = Number.isFinite(goalA.clockSeconds)
        ? goalA.clockSeconds
        : parseClockSeconds(`${goalA.time ?? ''}`);
      const secondsB = Number.isFinite(goalB.clockSeconds)
        ? goalB.clockSeconds
        : parseClockSeconds(`${goalB.time ?? ''}`);

      if (secondsA !== secondsB) {
        return secondsB - secondsA;
      }

      return goalA.__index - goalB.__index;
    });
}

function parseClockSeconds(value) {
  const trimmed = `${value ?? ''}`.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    return null;
  }
  const [minutes, seconds] = trimmed.split(':').map((segment) => Number.parseInt(segment, 10));
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return null;
  }
  return minutes * 60 + seconds;
}

function describePeriod(value) {
  const trimmed = `${value ?? ''}`.trim().toUpperCase();
  if (!trimmed) {
    return '';
  }
  if (trimmed === '1') return '1st';
  if (trimmed === '2') return '2nd';
  if (trimmed === '3') return '3rd';
  if (trimmed === 'OT' || trimmed === '4') return 'OT';
  if (trimmed === 'SO') return 'Shootout';
  return trimmed;
}

function formatScoreLine(homeTeam, awayTeam, homeScore, awayScore) {
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
    return `${awayTeam} at ${homeTeam}`;
  }
  return `${awayTeam} ${awayScore} ? ${homeTeam} ${homeScore}`;
}

async function loadRinkDataset() {
  const [indexResponse, scheduleResponse, rostersResponse] = await Promise.all([
    fetchJson('data/games/index.json'),
    fetchJson('data/schedule.json'),
    fetchJson('data/rosters.json'),
  ]);

  const indexEntries = Array.isArray(indexResponse) ? indexResponse : [];
  const schedule = Array.isArray(scheduleResponse) ? scheduleResponse : [];
  const rosters = rostersResponse && typeof rostersResponse === 'object' ? rostersResponse : {};

  const teamDivisionMap = buildTeamDivisionMap(rosters);
  const weekFallback = new Map();
  const games = await Promise.all(
    indexEntries.map(async (entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const details = entry.file ? await fetchJson(entry.file) : null;
      const merged = details && typeof details === 'object' ? { ...entry, ...details } : { ...entry };

      const division = normalizeDivision(
        merged.division ?? teamDivisionMap.get(merged.homeTeam ?? '') ?? teamDivisionMap.get(merged.awayTeam ?? ''),
      );

      const rawDate = merged.date ?? merged.created ?? merged.lastUpdated ?? null;
      const parsedDate = parseDateValue(rawDate);
      const timestamp = parsedDate ? parsedDate.getTime() : null;
      const weekNumber = resolveWeekNumber(merged.week, parsedDate, division ?? 'Unknown', weekFallback);

      const homeScore = toScore(merged.homeScore);
      const awayScore = toScore(merged.awayScore);

      const goals = Array.isArray(merged.goals)
        ? merged.goals
            .filter((goal) => goal && typeof goal === 'object')
            .map((goal) => ({
              ...goal,
              team: goal.team ?? '',
              player: goal.player ?? 'Unknown',
              period: `${goal.period ?? ''}`,
              time: `${goal.time ?? ''}`,
              clockSeconds: Number.isFinite(goal.clockSeconds) ? goal.clockSeconds : parseClockSeconds(goal.time),
            }))
        : [];

      const penalties = Array.isArray(merged.penalties)
        ? merged.penalties.filter((penalty) => penalty && typeof penalty === 'object')
        : [];

      const isCompleted = `${merged.status ?? ''}`.toLowerCase() !== 'in_progress';
      if (!division || !isCompleted) {
        return null;
      }

      const winner = Number.isFinite(homeScore) && Number.isFinite(awayScore)
        ? homeScore > awayScore
          ? merged.homeTeam
          : homeScore < awayScore
          ? merged.awayTeam
          : null
        : null;

      const loser = Number.isFinite(homeScore) && Number.isFinite(awayScore)
        ? homeScore > awayScore
          ? merged.awayTeam
          : homeScore < awayScore
          ? merged.homeTeam
          : null
        : null;

      const winnerScore = winner === merged.homeTeam ? homeScore : awayScore;
      const loserScore = loser === merged.homeTeam ? homeScore : awayScore;

      const margin = Number.isFinite(winnerScore) && Number.isFinite(loserScore) ? Math.abs(winnerScore - loserScore) : null;
      const totalGoals = Number.isFinite(homeScore) && Number.isFinite(awayScore) ? homeScore + awayScore : null;

      const overtimeResult = merged.overtimeResult && typeof merged.overtimeResult === 'object' ? merged.overtimeResult : null;
      const isOvertime = Boolean(
        overtimeResult?.winner || goals.some((goal) => {
          const period = `${goal.period ?? ''}`.trim().toUpperCase();
          return period === 'OT' || period === '4' || period === 'SO';
        }),
      );

      return {
        id: `${merged.id ?? merged.file ?? Math.random().toString(36).slice(2)}`,
        division,
        weekNumber,
        rawWeek: merged.week ?? null,
        date: rawDate,
        parsedDate,
        timestamp,
        time: merged.time ?? null,
        homeTeam: merged.homeTeam ?? 'Home',
        awayTeam: merged.awayTeam ?? 'Away',
        homeScore,
        awayScore,
        winner,
        loser,
        winnerScore,
        loserScore,
        margin,
        totalGoals,
        season: merged.season ?? '',
        location: merged.location ?? '',
        goals,
        penalties,
        overtimeResult,
        isOvertime,
        file: merged.file ?? '',
      };
    }),
  );

  const completedGames = games.filter(Boolean).sort(compareGameChronological);

  const gamesByDivision = new Map();
  const weeksByDivision = new Map();

  completedGames.forEach((game) => {
    const { division, weekNumber } = game;
    if (!division) {
      return;
    }
    const divisionGames = gamesByDivision.get(division) ?? [];
    divisionGames.push(game);
    gamesByDivision.set(division, divisionGames);

    const weeks = weeksByDivision.get(division) ?? new Set();
    weeks.add(weekNumber);
    weeksByDivision.set(division, weeks);
  });

  const weeksByDivisionSorted = new Map();
  weeksByDivision.forEach((weeks, division) => {
    const ordered = Array.from(weeks).filter((week) => Number.isFinite(week)).sort((a, b) => b - a);
    weeksByDivisionSorted.set(division, ordered);
  });

  const teamStatsByDivision = computeTeamStatsByDivision(gamesByDivision);
  const { playersByDivision, weeklyByDivision } = computePlayerStatsByDivision(gamesByDivision);
  const upcomingByDivision = computeUpcomingSchedule(schedule, teamDivisionMap, completedGames);

  const latestWeekByDivision = new Map();
  weeksByDivisionSorted.forEach((weeks, division) => {
    if (weeks.length) {
      latestWeekByDivision.set(division, weeks[0]);
    }
  });

  const timestamps = completedGames
    .map((game) => game.timestamp)
    .filter((value) => Number.isFinite(value));
  const dataTimestamp = timestamps.length ? new Date(Math.max(...timestamps)) : null;

  return {
    games: completedGames,
    gamesByDivision,
    weeksByDivision: weeksByDivisionSorted,
    latestWeekByDivision,
    teamStatsByDivision,
    playerStatsByDivision: playersByDivision,
    weeklyPlayerByDivision: weeklyByDivision,
    upcomingByDivision,
    dataTimestamp,
  };
}

function computeTeamStatsByDivision(gamesByDivision) {
  const result = new Map();

  gamesByDivision.forEach((games, division) => {
    const teamMap = new Map();

    games
      .slice()
      .sort(compareGameChronological)
      .forEach((game) => {
        const {
          homeTeam,
          awayTeam,
          homeScore,
          awayScore,
          weekNumber,
          parsedDate,
          isOvertime,
        } = game;

        const homeRecord = ensureTeamRecord(teamMap, homeTeam, division);
        const awayRecord = ensureTeamRecord(teamMap, awayTeam, division);

        const safeHomeScore = Number.isFinite(homeScore) ? homeScore : 0;
        const safeAwayScore = Number.isFinite(awayScore) ? awayScore : 0;

        updateTeamRecord(homeRecord, {
          opponent: awayTeam,
          teamScore: safeHomeScore,
          opponentScore: safeAwayScore,
          weekNumber,
          parsedDate,
          isOvertime,
        });

        updateTeamRecord(awayRecord, {
          opponent: homeTeam,
          teamScore: safeAwayScore,
          opponentScore: safeHomeScore,
          weekNumber,
          parsedDate,
          isOvertime,
        });
      });

    teamMap.forEach(finalizeTeamRecord);
    result.set(division, teamMap);
  });

  return result;
}
function ensureTeamRecord(collection, teamName, division) {
  const existing = collection.get(teamName);
  if (existing) {
    return existing;
  }

  const record = {
    team: teamName,
    division,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    overtimeLosses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    goalDiff: 0,
    winPct: 0,
    results: [],
    currentStreak: { type: null, length: 0 },
    longestWinStreak: 0,
  };

  collection.set(teamName, record);
  return record;
}

function updateTeamRecord(record, context) {
  const { opponent, teamScore, opponentScore, weekNumber, parsedDate, isOvertime } = context;

  record.gamesPlayed += 1;
  record.goalsFor += teamScore;
  record.goalsAgainst += opponentScore;

  let resultCode = 'L';
  if (teamScore > opponentScore) {
    record.wins += 1;
    resultCode = 'W';
  } else if (teamScore < opponentScore) {
    if (isOvertime) {
      record.overtimeLosses += 1;
      resultCode = 'OTL';
    } else {
      record.losses += 1;
    }
  }

  record.results.push({
    result: resultCode,
    opponent,
    weekNumber,
    date: parsedDate,
    score: `${teamScore}-${opponentScore}`,
    margin: Math.abs(teamScore - opponentScore),
  });
}

function finalizeTeamRecord(record) {
  record.points = record.wins * 2 + record.overtimeLosses;
  record.goalDiff = record.goalsFor - record.goalsAgainst;
  record.winPct = record.gamesPlayed
    ? (record.wins + record.overtimeLosses * 0.5) / record.gamesPlayed
    : 0;

  let currentType = null;
  let currentLength = 0;
  for (let index = record.results.length - 1; index >= 0; index -= 1) {
    const entry = record.results[index];
    const normalized = entry.result === 'W' ? 'W' : 'L';
    if (!currentType) {
      currentType = normalized;
      currentLength = 1;
    } else if (currentType === normalized) {
      currentLength += 1;
    } else {
      break;
    }
  }

  record.currentStreak = { type: currentType, length: currentLength };

  let winRun = 0;
  let bestWinRun = 0;
  record.results.forEach((entry) => {
    if (entry.result === 'W') {
      winRun += 1;
      bestWinRun = Math.max(bestWinRun, winRun);
    } else {
      winRun = 0;
    }
  });
  record.longestWinStreak = bestWinRun;
}

function computePlayerStatsByDivision(gamesByDivision) {
  const playersByDivision = new Map();
  const weeklyByDivision = new Map();

  gamesByDivision.forEach((games, division) => {
    const players = new Map();
    const weekly = new Map();

    games.forEach((game) => {
      const { id: gameId, weekNumber, goals } = game;
      const participants = new Map();

      goals.forEach((goal) => {
        const goalTeam = goal.team ?? '';
        const playerName = `${goal.player ?? 'Unknown'}`.trim() || 'Unknown';
        const playerKey = buildPlayerKey(goal.playerId, playerName, goalTeam);
        const assistName = `${goal.assist ?? ''}`.trim();
        const assistKey = assistName ? buildPlayerKey(goal.assistId, assistName, goalTeam) : null;

        const scorerRecord = ensurePlayerRecord(players, playerKey, {
          player: playerName,
          team: goalTeam,
        });
        scorerRecord.goals += 1;
        scorerRecord.points = scorerRecord.goals + scorerRecord.assists;
        scorerRecord.games.add(gameId);
        scorerRecord.lastContribution = weekNumber;
        if (`${goal.hatTrickIndicator ?? ''}`.toLowerCase() === 'yes') {
          scorerRecord.hatTricks += 1;
        }

        participants.set(playerKey, true);
        const scorerWeekly = ensureWeeklyPlayerRecord(weekly, weekNumber, playerKey, scorerRecord);
        scorerWeekly.goals += 1;
        scorerWeekly.points += 1;

        if (assistKey) {
          const assistRecord = ensurePlayerRecord(players, assistKey, {
            player: assistName,
            team: goalTeam,
          });
          assistRecord.assists += 1;
          assistRecord.points = assistRecord.goals + assistRecord.assists;
          assistRecord.games.add(gameId);
          assistRecord.lastContribution = weekNumber;
          participants.set(assistKey, true);

          const assistWeekly = ensureWeeklyPlayerRecord(weekly, weekNumber, assistKey, assistRecord);
          assistWeekly.assists += 1;
          assistWeekly.points += 1;
        }
      });

      participants.forEach((_, key) => {
        const playerRecord = players.get(key);
        if (playerRecord) {
          playerRecord.gamesPlayed = playerRecord.games.size;
        }
      });
    });

    players.forEach((record) => {
      record.gamesPlayed = record.games.size;
      record.points = record.goals + record.assists;
    });

    const sortedWeekly = new Map();
    weekly.forEach((playerMap, week) => {
      const leaderboard = Array.from(playerMap.values());
      leaderboard.sort((playerA, playerB) => {
        if (playerA.points !== playerB.points) {
          return playerB.points - playerA.points;
        }
        if (playerA.goals !== playerB.goals) {
          return playerB.goals - playerA.goals;
        }
        return `${playerA.player ?? ''}`.localeCompare(`${playerB.player ?? ''}`);
      });
      sortedWeekly.set(week, leaderboard);
    });

    playersByDivision.set(division, players);
    weeklyByDivision.set(division, sortedWeekly);
  });

  return { playersByDivision, weeklyByDivision };
}

function buildPlayerKey(id, name, team) {
  const trimmedId = `${id ?? ''}`.trim();
  if (trimmedId) {
    return `id:${trimmedId}`;
  }
  const normalizedName = name.toLowerCase();
  const normalizedTeam = `${team ?? ''}`.toLowerCase();
  return `name:${normalizedName}|team:${normalizedTeam}`;
}

function ensurePlayerRecord(collection, key, seed) {
  const existing = collection.get(key);
  if (existing) {
    if (seed.player && existing.player !== seed.player) {
      existing.player = seed.player;
    }
    if (seed.team && !existing.team) {
      existing.team = seed.team;
    }
    return existing;
  }

  const record = {
    key,
    player: seed.player ?? 'Unknown',
    team: seed.team ?? '',
    goals: 0,
    assists: 0,
    points: 0,
    games: new Set(),
    gamesPlayed: 0,
    hatTricks: 0,
    lastContribution: null,
  };

  collection.set(key, record);
  return record;
}

function ensureWeeklyPlayerRecord(collection, weekNumber, key, record) {
  const weekMap = collection.get(weekNumber) ?? new Map();
  if (!collection.has(weekNumber)) {
    collection.set(weekNumber, weekMap);
  }

  const existing = weekMap.get(key);
  if (existing) {
    return existing;
  }

  const entry = {
    key,
    player: record.player,
    team: record.team,
    goals: 0,
    assists: 0,
    points: 0,
  };

  weekMap.set(key, entry);
  return entry;
}
function computeUpcomingSchedule(schedule, teamDivisionMap, completedGames) {
  const completedIds = new Set(completedGames.map((game) => game.id));
  const divisionLatestWeek = new Map();
  completedGames.forEach((game) => {
    const { division, weekNumber } = game;
    if (!division) {
      return;
    }
    const current = divisionLatestWeek.get(division) ?? 0;
    if (Number.isFinite(weekNumber) && weekNumber > current) {
      divisionLatestWeek.set(division, weekNumber);
    }
  });

  const fallback = new Map();
  const upcomingByDivision = new Map();

  schedule.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }

    if (entry.isPractice) {
      return;
    }

    const division = normalizeDivision(
      teamDivisionMap.get(entry.homeTeam ?? '') ?? teamDivisionMap.get(entry.awayTeam ?? ''),
    );
    if (!division) {
      return;
    }

    const parsedDate = parseDateValue(entry.date ?? null);
    const weekNumber = resolveWeekNumber(entry.week, parsedDate, division, fallback);

    const scheduleRecord = {
      id: `${entry.id ?? `${entry.homeTeam ?? ''}-${entry.awayTeam ?? ''}`}`,
      division,
      weekNumber,
      date: parsedDate,
      homeTeam: entry.homeTeam ?? 'Home',
      awayTeam: entry.awayTeam ?? 'Away',
      location: entry.location ?? '',
      time: entry.time ?? null,
    };

    if (completedIds.has(scheduleRecord.id)) {
      return;
    }

    const divisionSchedule = upcomingByDivision.get(division) ?? new Map();
    const weekSchedule = divisionSchedule.get(weekNumber) ?? [];
    weekSchedule.push(scheduleRecord);
    divisionSchedule.set(weekNumber, weekSchedule);
    upcomingByDivision.set(division, divisionSchedule);
  });

  upcomingByDivision.forEach((weekMap) => {
    weekMap.forEach((games) => {
      games.sort((gameA, gameB) => {
        const timeA = gameA.date ? gameA.date.getTime() : 0;
        const timeB = gameB.date ? gameB.date.getTime() : 0;
        if (timeA !== timeB) {
          return timeA - timeB;
        }
        return `${gameA.id}`.localeCompare(`${gameB.id}`);
      });
    });
  });

  upcomingByDivision.latestWeekMap = divisionLatestWeek;
  return upcomingByDivision;
}

function ensureDataset() {
  if (rinkReportState.loaded || rinkReportState.loading) {
    return rinkReportCache.promise ?? Promise.resolve(rinkReportState.dataset);
  }

  if (!rinkReportCache.promise) {
    rinkReportState.loading = true;
    rinkReportCache.promise = loadRinkDataset()
      .then((dataset) => {
        rinkReportState.dataset = dataset;
        rinkReportState.loaded = true;
        rinkReportState.loading = false;
        rinkReportState.error = null;
        return dataset;
      })
      .catch((error) => {
        console.error('Failed to load rink report data', error);
        rinkReportState.dataset = null;
        rinkReportState.loaded = false;
        rinkReportState.loading = false;
        rinkReportState.error = 'Unable to load the Rink Report right now. Please try again later.';
        throw error;
      })
      .finally(() => {
        rinkReportCache.promise = null;
      });
  }

  return rinkReportCache.promise;
}

function getWeeksForDivision(division) {
  const weeks = rinkReportState.dataset?.weeksByDivision?.get(division);
  if (!weeks || !weeks.length) {
    return [];
  }
  return weeks;
}

function getGamesForWeek(division, weekNumber) {
  const games = rinkReportState.dataset?.gamesByDivision?.get(division) ?? [];
  return games.filter((game) => game.weekNumber === weekNumber);
}

function getTeamStats(division) {
  const map = rinkReportState.dataset?.teamStatsByDivision?.get(division);
  return map ? Array.from(map.values()) : [];
}

function getWeeklyLeaders(division, weekNumber, limit = 5) {
  const weekMap = rinkReportState.dataset?.weeklyPlayerByDivision?.get(division);
  if (!weekMap) {
    return [];
  }
  const list = weekMap.get(weekNumber) ?? [];
  return list.slice(0, limit);
}

function getGameById(division, gameId) {
  const games = rinkReportState.dataset?.gamesByDivision?.get(division) ?? [];
  return games.find((game) => game.id === gameId) ?? null;
}

function getUpcomingGames(division) {
  const byDivision = rinkReportState.dataset?.upcomingByDivision?.get(division);
  if (!byDivision) {
    return { week: null, games: [] };
  }

  const candidateWeeks = Array.from(byDivision.keys()).filter((week) => Number.isFinite(week)).sort((a, b) => a - b);
  if (!candidateWeeks.length) {
    return { week: null, games: [] };
  }

  const latestCompleted = rinkReportState.dataset?.latestWeekByDivision?.get(division) ?? 0;
  const nextWeek = candidateWeeks.find((week) => week > latestCompleted) ?? candidateWeeks[0];
  return { week: nextWeek, games: byDivision.get(nextWeek) ?? [] };
}

function applyDefaultFilters() {
  const division = rinkReportState.division;
  const weeks = getWeeksForDivision(division);
  if (weeks.length) {
    if (!Number.isFinite(rinkReportState.weekFilters.weekly)) {
      rinkReportState.weekFilters.weekly = weeks[0];
    }
    if (!Number.isFinite(rinkReportState.weekFilters.game)) {
      rinkReportState.weekFilters.game = weeks[0];
    }

    if (!rinkReportState.selectedGameId) {
      const games = getGamesForWeek(division, rinkReportState.weekFilters.game);
      rinkReportState.selectedGameId = games[0]?.id ?? null;
    }
  }
}

function formatStreak(record) {
  const { type, length } = record.currentStreak;
  if (!type || !length) {
    return '?';
  }
  return `${length}${type}`;
}

function summarizeRecord(record) {
  return `${record.wins}-${record.losses}-${record.overtimeLosses}`;
}
function renderDivisionFilter(container) {
  const buttons = DIVISIONS.map((division) => {
    const isActive = rinkReportState.division === division;
    return `
      <button type="button" class="report-filter__btn${isActive ? ' is-active' : ''}" data-division="${division}">
        ${division}
      </button>
    `;
  }).join('');

  container.innerHTML = buttons;
}

function renderSectionTabs(container) {
  const buttons = SECTION_DEFINITIONS.map((section) => {
    const isActive = rinkReportState.section === section.id;
    return `
      <button type="button" class="report-tab__btn${isActive ? ' is-active' : ''}" data-section="${section.id}">
        ${section.label}
      </button>
    `;
  }).join('');

  container.innerHTML = buttons;
}

function renderFilters(container) {
  const pieces = [];
  const division = rinkReportState.division;
  const weeks = getWeeksForDivision(division);

  if (rinkReportState.section === 'weekly' && weeks.length) {
    const weekOptions = weeks
      .map((week) => `<option value="${week}"${rinkReportState.weekFilters.weekly === week ? ' selected' : ''}>Week ${week}</option>`)
      .join('');

    pieces.push(`
      <label class="report-select">
        <span>Week</span>
        <select data-week-select="weekly">${weekOptions}</select>
      </label>
    `);
  }

  if (rinkReportState.section === 'game' && weeks.length) {
    const weekOptions = weeks
      .map((week) => `<option value="${week}"${rinkReportState.weekFilters.game === week ? ' selected' : ''}>Week ${week}</option>`)
      .join('');

    const games = getGamesForWeek(division, rinkReportState.weekFilters.game);
    const matchupOptions = games
      .map((game) => {
        const label = `${game.awayTeam} at ${game.homeTeam}`;
        const selected = rinkReportState.selectedGameId === game.id ? ' selected' : '';
        return `<option value="${game.id}"${selected}>${label}</option>`;
      })
      .join('');

    pieces.push(`
      <label class="report-select">
        <span>Week</span>
        <select data-week-select="game">${weekOptions}</select>
      </label>
    `);

    pieces.push(`
      <label class="report-select">
        <span>Matchup</span>
        <select data-game-select>${matchupOptions}</select>
      </label>
    `);
  }

  container.innerHTML = pieces.join('');
}

function renderContent(container, statusContainer) {
  if (rinkReportState.loading) {
    statusContainer.textContent = 'Loading the latest stories?';
    container.innerHTML = '<div class="card"><p>Loading?</p></div>';
    return;
  }

  if (rinkReportState.error) {
    statusContainer.textContent = rinkReportState.error;
    container.innerHTML = '<div class="card"><p>We could not pull the Rink Report right now.</p></div>';
    return;
  }

  statusContainer.textContent = '';

  const division = rinkReportState.division;
  const dataset = rinkReportState.dataset;
  if (!dataset) {
    container.innerHTML = '<div class="card"><p>No report data is available.</p></div>';
    return;
  }

  if (!dataset.gamesByDivision.has(division)) {
    container.innerHTML = `<div class="card"><p>No completed games yet for the ${division} division.</p></div>`;
    return;
  }

  if (rinkReportState.section === 'weekly') {
    container.innerHTML = renderWeeklySummarySection(division, rinkReportState.weekFilters.weekly);
    return;
  }

  if (rinkReportState.section === 'game') {
    container.innerHTML = renderGameDetailsSection(division, rinkReportState.selectedGameId);
    return;
  }

  if (rinkReportState.section === 'season-summary') {
    container.innerHTML = renderSeasonSummarySection(division);
    return;
  }

  if (rinkReportState.section === 'season-outlook') {
    container.innerHTML = renderSeasonOutlookSection(division);
    return;
  }

  container.innerHTML = '<div class="card"><p>Select a report to view.</p></div>';
}

function renderWeeklySummarySection(division, weekNumber) {
  if (!Number.isFinite(weekNumber)) {
    return '<div class="card"><p>Select a week to view the summary.</p></div>';
  }

  const games = getGamesForWeek(division, weekNumber);
  if (!games.length) {
    return `<div class="card"><p>No games were logged for Week ${weekNumber}.</p></div>`;
  }

  const totalGoals = games.reduce((sum, game) => sum + (game.totalGoals ?? 0), 0);
  const averageGoals = games.length ? (totalGoals / games.length).toFixed(1) : '0.0';
  const biggestWin = games
    .slice()
    .sort((gameA, gameB) => (gameB.margin ?? 0) - (gameA.margin ?? 0))[0];
  const tightestGame = games
    .slice()
    .filter((game) => Number.isFinite(game.margin))
    .sort((gameA, gameB) => (gameA.margin ?? Infinity) - (gameB.margin ?? Infinity))[0];

  const leaders = getWeeklyLeaders(division, weekNumber, 3);
  const leaderSummary = leaders.length
    ? `${leaders[0].player} led the way with ${leaders[0].goals} goals and ${leaders[0].assists} assists.`
    : 'Balanced scoring defined the week.';

  const headlineParts = [`Week ${weekNumber} in the ${division} division delivered ${totalGoals} goals across ${games.length} games (${averageGoals} per matchup).`];
  if (biggestWin && Number.isFinite(biggestWin.margin)) {
    headlineParts.push(
      `${biggestWin.winner} flexed with a ${biggestWin.winnerScore}-${biggestWin.loserScore} result over ${biggestWin.loser}.`,
    );
  }
  if (tightestGame && Number.isFinite(tightestGame.margin) && tightestGame.margin <= 2) {
    headlineParts.push(
      `${tightestGame.winner} squeezed past ${tightestGame.loser} ${tightestGame.winnerScore}-${tightestGame.loserScore} in a one-goal thriller.`,
    );
  }
  headlineParts.push(leaderSummary);

  const gameCards = games
    .map((game) => renderWeeklyGameCard(game))
    .join('');

  return `
    <div class="card report-card">
      <h2>Week ${weekNumber} Recap</h2>
      <p class="report-lede">${headlineParts.join(' ')}</p>
      <div class="report-metrics">
        <div><span>Total Goals</span><strong>${totalGoals}</strong></div>
        <div><span>Avg Goals / Game</span><strong>${averageGoals}</strong></div>
        <div><span>Top Performer</span><strong>${leaders[0] ? `${leaders[0].player} (${leaders[0].points} pts)` : 'TBD'}</strong></div>
      </div>
      <div class="report-grid">${gameCards}</div>
    </div>
  `;
}

function renderWeeklyGameCard(game) {
  const goals = sortGoals(game.goals ?? []);
  const openingGoal = goals[0];
  const goAhead = findGoAheadGoal(goals, game);
  const star = computeGameStar(goals);

  const timeline = goals
    .slice(0, 4)
    .map((goal) => {
      const period = describePeriod(goal.period);
      const time = goal.time || '00:00';
      const assist = `${goal.assist ?? ''}`.trim();
      const helper = assist ? ` (assist: ${assist})` : '';
      return `<li><strong>${goal.team}</strong> ? ${goal.player} ${helper} <span>${period} ${time}</span></li>`;
    })
    .join('');

  const openingLine = openingGoal
    ? `${openingGoal.player} broke the ice for ${openingGoal.team} in the ${describePeriod(openingGoal.period)} (${openingGoal.time}).`
    : 'Scoring opened late with a defensive start.';

  const goAheadLine = goAhead
    ? `${goAhead.player} supplied the go-ahead tally in the ${describePeriod(goAhead.period)}, a lead ${game.winner} never gave back.`
    : 'The lead see-sawed before the final horn.';

  const starLine = star
    ? `${star.player} posted ${star.goals} goals${star.assists ? ` and ${star.assists} assists` : ''} to headline the night.`
    : '';

  const narrative = `${openingLine} ${goAheadLine} ${starLine}`.trim();

  return `
    <article class="report-game">
      <header>
        <h3>${game.winner} ${game.winnerScore} ? ${game.loser} ${game.loserScore}</h3>
        <p>${formatDateLabel(game.parsedDate)} ? ${game.awayTeam} at ${game.homeTeam}</p>
      </header>
      <p>${narrative}</p>
      <ul class="report-timeline">${timeline}</ul>
    </article>
  `;
}
function findGoAheadGoal(goals, game) {
  if (!goals.length) {
    return null;
  }

  let home = 0;
  let away = 0;
  const homeTeam = game.homeTeam;

  for (const goal of goals) {
    if (goal.team === homeTeam) {
      home += 1;
    } else {
      away += 1;
    }

    if (home !== away) {
      const leader = home > away ? homeTeam : game.awayTeam;
      if (leader === game.winner) {
        return goal;
      }
    }
  }

  return null;
}

function computeGameStar(goals) {
  if (!goals.length) {
    return null;
  }

  const totals = new Map();
  goals.forEach((goal) => {
    const key = goal.playerId ? `id:${goal.playerId}` : goal.player;
    const record = totals.get(key) ?? { player: goal.player, goals: 0, assists: 0 };
    record.player = goal.player;
    record.team = goal.team;
    record.goals += 1;
    totals.set(key, record);

    const assist = `${goal.assist ?? ''}`.trim();
    if (assist) {
      const assistKey = goal.assistId ? `id:${goal.assistId}` : assist;
      const assistRecord = totals.get(assistKey) ?? { player: assist, goals: 0, assists: 0 };
      assistRecord.player = assist;
      assistRecord.team = goal.team;
      assistRecord.assists += 1;
      totals.set(assistKey, assistRecord);
    }
  });

  const leaders = Array.from(totals.values());
  leaders.sort((a, b) => {
    if (a.goals !== b.goals) {
      return b.goals - a.goals;
    }
    if (a.assists !== b.assists) {
      return b.assists - a.assists;
    }
    return `${a.player}`.localeCompare(`${b.player}`);
  });

  return leaders[0] ?? null;
}

function renderGameDetailsSection(division, gameId) {
  const game = getGameById(division, gameId);
  if (!game) {
    return '<div class="card"><p>Select a matchup to dive into the details.</p></div>';
  }

  const goals = sortGoals(game.goals ?? []);
  let homeRunning = 0;
  let awayRunning = 0;
  const homeTeam = game.homeTeam;

  const timeline = goals
    .map((goal) => {
      if (goal.team === homeTeam) {
        homeRunning += 1;
      } else {
        awayRunning += 1;
      }
      const scoreLine = `${awayTeamLabel(game, awayRunning)} ? ${homeTeamLabel(game, homeRunning)}`;
      const assist = `${goal.assist ?? ''}`.trim();
      const helper = assist ? ` (assist: ${assist})` : '';
      return `
        <li>
          <span class="report-timeline__time">${describePeriod(goal.period)} ${goal.time || '00:00'}</span>
          <strong>${goal.team}</strong> ${goal.player}${helper}
          <span class="report-timeline__score">${scoreLine}</span>
        </li>
      `;
    })
    .join('');

  const star = computeGameStar(goals);
  const penalties = Array.isArray(game.penalties) ? game.penalties.length : 0;
  const overtimeNote = game.isOvertime ? 'This one needed extra ice time.' : 'Handled in regulation.';
  const starLine = star
    ? `${star.player} drove the story with ${star.goals} goals${star.assists ? ` and ${star.assists} helpers` : ''}.`
    : 'Scoring was spread across the bench.';

  return `
    <div class="card report-card">
      <h2>${formatScoreLine(game.homeTeam, game.awayTeam, game.homeScore, game.awayScore)}</h2>
      <p class="report-lede">${game.winner} prevailed behind ${starLine} ${overtimeNote}</p>
      <div class="report-summary">
        <div>
          <span>Final</span>
          <strong>${game.winnerScore}-${game.loserScore}</strong>
        </div>
        <div>
          <span>Goals Logged</span>
          <strong>${goals.length}</strong>
        </div>
        <div>
          <span>Penalties</span>
          <strong>${penalties}</strong>
        </div>
      </div>
      <h3>Scoring Timeline</h3>
      <ul class="report-timeline report-timeline--full">${timeline}</ul>
    </div>
  `;
}

function awayTeamLabel(game, score) {
  return `${game.awayTeam} ${score}`;
}

function homeTeamLabel(game, score) {
  return `${game.homeTeam} ${score}`;
}

function renderSeasonSummarySection(division) {
  const teams = getTeamStats(division);
  if (!teams.length) {
    return `<div class="card"><p>No standings yet for the ${division} division.</p></div>`;
  }

  const ordered = teams
    .slice()
    .sort((teamA, teamB) => {
      if (teamA.points !== teamB.points) {
        return teamB.points - teamA.points;
      }
      if (teamA.goalDiff !== teamB.goalDiff) {
        return teamB.goalDiff - teamA.goalDiff;
      }
      return `${teamA.team}`.localeCompare(`${teamB.team}`);
    });

  const leaders = ordered.slice(0, 3);
  const hottest = ordered
    .slice()
    .sort((teamA, teamB) => teamB.longestWinStreak - teamA.longestWinStreak)[0];
  const stingiest = ordered
    .slice()
    .sort((teamA, teamB) => teamA.goalsAgainst / Math.max(teamA.gamesPlayed, 1) - teamB.goalsAgainst / Math.max(teamB.gamesPlayed, 1))[0];
  const firepower = ordered
    .slice()
    .sort((teamA, teamB) => teamB.goalsFor / Math.max(teamB.gamesPlayed, 1) - teamA.goalsFor / Math.max(teamA.gamesPlayed, 1))[0];

  const headline = `${division} playoff picture is shaping up with ${leaders
    .map((team) => team.team)
    .join(', ')} anchoring the table. ${firepower.team} owns the league's most potent offense (${(firepower.goalsFor / Math.max(firepower.gamesPlayed, 1)).toFixed(1)} goals per game) while ${stingiest.team} clamps down defensively (${(stingiest.goalsAgainst / Math.max(stingiest.gamesPlayed, 1)).toFixed(1)} GA/GP). ${hottest.team} has authored a ${hottest.longestWinStreak}-game heater at their best.`;

  const tableRows = ordered
    .map((team, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${team.team}</td>
        <td>${summarizeRecord(team)}</td>
        <td>${team.points}</td>
        <td>${team.goalDiff}</td>
        <td>${formatPercentage(team.winPct)}</td>
        <td>${formatStreak(team)}</td>
      </tr>
    `)
    .join('');

  return `
    <div class="card report-card">
      <h2>${division} Season Snapshot</h2>
      <p class="report-lede">${headline}</p>
      <div class="report-table-wrapper">
        <table class="report-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Record</th>
              <th>PTS</th>
              <th>GD</th>
              <th>Win %</th>
              <th>Streak</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSeasonOutlookSection(division) {
  const { week, games } = getUpcomingGames(division);
  const teams = getTeamStats(division);
  const teamLookup = new Map(teams.map((team) => [team.team, team]));

  if (!games.length) {
    return `<div class="card"><p>No upcoming schedule posted for the ${division} division just yet.</p></div>`;
  }

  const predictions = games
    .map((matchup) => {
      const home = teamLookup.get(matchup.homeTeam);
      const away = teamLookup.get(matchup.awayTeam);

      if (!home || !away) {
        return `
          <li>
            <strong>${matchup.awayTeam} at ${matchup.homeTeam}</strong>
            <span>Fresh matchup ? no prior data to project.</span>
          </li>
        `;
      }

      const homeEdge = home.points + home.goalDiff * 0.1;
      const awayEdge = away.points + away.goalDiff * 0.1;
      const favorite = homeEdge >= awayEdge ? matchup.homeTeam : matchup.awayTeam;
      const underdog = favorite === matchup.homeTeam ? matchup.awayTeam : matchup.homeTeam;
      const favoriteStats = favorite === matchup.homeTeam ? home : away;
      const underdogStats = favorite === matchup.homeTeam ? away : home;

      const rationale = `${favorite} leans on a ${summarizeRecord(favoriteStats)} mark and ${formatPercentage(
        favoriteStats.winPct,
      )} win rate; ${underdog} counters with ${formatPercentage(underdogStats.winPct)} so expect a tight finish.`;

      return `
        <li>
          <strong>${matchup.awayTeam} at ${matchup.homeTeam}</strong>
          <span>${rationale}</span>
        </li>
      `;
    })
    .join('');

  const latestWeek = rinkReportState.dataset?.latestWeekByDivision?.get(division);
  const leaders = getWeeklyLeaders(division, latestWeek, 3);
  const watchList = leaders.length
    ? leaders
        .map((player) => `<li><strong>${player.player}</strong> ? ${player.points} pts last week for ${player.team}</li>`)
        .join('')
    : '<li>Balanced contributions ? keep an eye on every bench.</li>';

  return `
    <div class="card report-card">
      <h2>${division} Outlook ? Week ${week ?? '?'} Preview</h2>
      <p class="report-lede">The projection model leans on standings momentum and goal differential to size up the next slate.</p>
      <div class="report-columns">
        <section>
          <h3>Matchup Forecasts</h3>
          <ul class="report-list">${predictions}</ul>
        </section>
        <section>
          <h3>Players to Watch</h3>
          <ul class="report-list">${watchList}</ul>
        </section>
      </div>
    </div>
  `;
}

export const rinkReportView = {
  id: 'rink-report',
  hideHeader: false,
  template() {
    return `
      <div class="report-wrap">
        <h1>The Rink Report</h1>
        <p class="report-subtitle">Narratives, analysis, and projections updated with the latest completed action.</p>
        <div class="report-toolbar">
          <div class="report-filter" data-division-filter></div>
          <div class="report-tabs" data-section-tabs></div>
        </div>
        <div class="report-filters" data-report-filters></div>
        <div class="report-status" data-report-status></div>
        <div class="report-content" data-report-content>
          <div class="card"><p>Loading the latest stories?</p></div>
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
    const divisionFilter = main.querySelector('[data-division-filter]');
    const tabs = main.querySelector('[data-section-tabs]');
    const filters = main.querySelector('[data-report-filters]');
    const content = main.querySelector('[data-report-content]');
    const status = main.querySelector('[data-report-status]');

    renderDivisionFilter(divisionFilter);
    renderSectionTabs(tabs);
    renderFilters(filters);
    renderContent(content, status);

    divisionFilter?.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest('[data-division]') : null;
      if (!target) {
        return;
      }
      const newDivision = target.dataset.division;
      if (!newDivision || newDivision === rinkReportState.division) {
        return;
      }
      rinkReportState.division = newDivision;
      rinkReportState.weekFilters = { weekly: null, game: null };
      rinkReportState.selectedGameId = null;
      renderDivisionFilter(divisionFilter);
      renderFilters(filters);
      renderContent(content, status);
      ensureDataset()
        .then(() => {
          applyDefaultFilters();
          renderDivisionFilter(divisionFilter);
          renderFilters(filters);
          renderContent(content, status);
        })
        .catch(() => {
          renderContent(content, status);
        });
    });

    tabs?.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest('[data-section]') : null;
      if (!target) {
        return;
      }
      const section = target.dataset.section;
      if (!section || section === rinkReportState.section) {
        return;
      }
      rinkReportState.section = section;
      renderSectionTabs(tabs);
      renderFilters(filters);
      renderContent(content, status);
    });

    filters?.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }

      if (target.dataset.weekSelect === 'weekly') {
        const value = Number.parseInt(target.value, 10);
        if (Number.isFinite(value)) {
          rinkReportState.weekFilters.weekly = value;
          renderContent(content, status);
        }
        return;
      }

      if (target.dataset.weekSelect === 'game') {
        const value = Number.parseInt(target.value, 10);
        if (Number.isFinite(value)) {
          rinkReportState.weekFilters.game = value;
          const games = getGamesForWeek(rinkReportState.division, value);
          rinkReportState.selectedGameId = games[0]?.id ?? null;
          renderFilters(filters);
          renderContent(content, status);
        }
        return;
      }

      if (target.dataset.gameSelect !== undefined) {
        rinkReportState.selectedGameId = target.value;
        renderContent(content, status);
      }
    });

    ensureDataset()
      .then(() => {
        applyDefaultFilters();
        renderDivisionFilter(divisionFilter);
        renderSectionTabs(tabs);
        renderFilters(filters);
        renderContent(content, status);
      })
      .catch(() => {
        renderContent(content, status);
      });
  },
};
