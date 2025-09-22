import { safeValidateGame } from './schema.js';
import { SyncQueue } from './sync-queue.js';

const STORAGE_KEY = 'chahky_games';
const IN_PROGRESS_STORAGE_KEY = 'chahky_current_game';
const DATA_VERSION_KEY = 'chahky_data_version';

function buildSeedSignature(schedule, rosters) {
  const schedulePart = Array.isArray(schedule)
    ? schedule
        .map((game) => {
          const parts = [
            game && game.id ? game.id : '',
            game && game.date ? game.date : '',
            game && game.time ? game.time : '',
            game && game.homeTeam ? game.homeTeam : '',
            game && game.awayTeam ? game.awayTeam : '',
            game && game.season ? game.season : '',
          ];
          return parts.join('|');
        })
        .join(';')
    : 'none';

  const rosterEntries = [];
  if (rosters && typeof rosters === 'object') {
    const teams = Object.keys(rosters).sort((teamA, teamB) => teamA.localeCompare(teamB));
    teams.forEach((team) => {
      const players = rosters[team];
      if (Array.isArray(players)) {
        const playerSignature = players
          .map((player) => {
            if (player && typeof player === 'object') {
              if (typeof player.id === 'string' && player.id) {
                return player.id;
              }
              if (typeof player.name === 'string' && player.name) {
                return player.name;
              }
            }
            return '';
          })
          .join(',');
        rosterEntries.push(`${team}:${playerSignature}`);
      } else {
        rosterEntries.push(`${team}:`);
      }
    });
  }

  const rosterPart = rosterEntries.length ? rosterEntries.join(';') : 'none';

  return `schedule:${schedulePart}|rosters:${rosterPart}`;
}

function simpleHash(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    const charCode = value.charCodeAt(index);
    hash = (hash << 5) - hash + charCode;
    hash |= 0;
  }
  return String(hash);
}

function toShotCount(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  }

  return 0;
}

function toScoreValue(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  }

  return null;
}

function deriveScoreImpact(teamScore, opponentScore) {
  if (!Number.isFinite(teamScore) || !Number.isFinite(opponentScore)) {
    return '';
  }

  if (teamScore === 1 && opponentScore === 0) {
    return 'first goal of the game';
  }

  if (teamScore === opponentScore) {
    return 'game tying goal';
  }

  if (teamScore >= opponentScore + 2) {
    return 'insurance goal';
  }

  if (teamScore > opponentScore) {
    return 'go ahead goal';
  }

  return '';
}

function toYesNo(condition) {
  return condition ? 'yes' : 'no';
}

function normalizeYesNo(value, fallback) {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'yes' || normalized === 'no') {
      return normalized;
    }
  }
  return fallback;
}

function isLateGameGoal(period, clockSeconds) {
  if (period !== '3') {
    return false;
  }
  if (!Number.isFinite(clockSeconds)) {
    return false;
  }
  return clockSeconds >= 1 && clockSeconds <= 120;
}

function isEarlyGameGoal(period, clockSeconds) {
  if (period !== '1') {
    return false;
  }
  if (!Number.isFinite(clockSeconds)) {
    return false;
  }
  return clockSeconds >= 15 * 60 && clockSeconds <= 16 * 60 + 59;
}

function isComebackGoal(teamScore, opponentScore) {
  if (!Number.isFinite(teamScore) || !Number.isFinite(opponentScore)) {
    return false;
  }

  const previousTeamScore = teamScore - 1;
  if (previousTeamScore < 0) {
    return false;
  }

  const wasTrailingByTwoOrMore = opponentScore - previousTeamScore >= 2;
  const nowDeficit = opponentScore - teamScore;
  return wasTrailingByTwoOrMore && nowDeficit <= 1;
}

function isClutchGoal(period, clockSeconds, teamScore, opponentScore) {
  if (period !== '3') {
    return false;
  }
  if (!Number.isFinite(clockSeconds) || !Number.isFinite(teamScore) || !Number.isFinite(opponentScore)) {
    return false;
  }
  if (clockSeconds > 300) {
    return false;
  }
  return teamScore === opponentScore || teamScore > opponentScore;
}

const PERIOD_DURATION_SECONDS = 17 * 60;

function periodToIndex(period) {
  const value = `${period ?? ''}`.toUpperCase();
  if (value === '2') {
    return 1;
  }
  if (value === '3') {
    return 2;
  }
  if (value === 'OT' || value === '4') {
    return 3;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed - 1 : 0;
}

function computeAbsoluteSeconds(period, clockSeconds) {
  const index = periodToIndex(period);
  const duration = PERIOD_DURATION_SECONDS;
  const clamped = Number.isFinite(clockSeconds) ? Math.min(Math.max(clockSeconds, 0), duration) : duration;
  const elapsedInPeriod = duration - clamped;
  return index * duration + elapsedInPeriod;
}

export class DataManager {
  constructor({
    fetchImpl = window.fetch.bind(window),
    queue = new SyncQueue(),
    syncService = null,
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.rosters = {};
    this.schedule = [];
    this.currentGame = null;
    this.gamesData = [];
    this.remoteCompletedGameIds = new Set();
    this.isLoaded = false;

    this.syncQueue = queue;
    this.syncService = syncService;
    this.syncListeners = new Set();
    this.isSyncing = false;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.triggerSync());
    }
  }

  async init() {
    if (this.isLoaded) return;
    await this.loadSeeds();
    this.ensureSeedVersion();
    this.loadCachedGames();
    this.restoreCurrentGame();
    this.isLoaded = true;
    if (this.syncQueue.size > 0) {
      this.notifySync({ type: 'queue:pending', pending: this.syncQueue.size });
    }
  }

  onSyncStatus(listener) {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  setSyncService(syncService) {
    this.syncService = syncService;
    this.triggerSync();
  }

  notifySync(event) {
    this.syncListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Sync listener error', error);
      }
    });
  }

  async loadSeeds() {
    await Promise.all([this.loadRosters(), this.loadSchedule(), this.loadGamesData()]);
  }

  async loadRosters() {
    const response = await this.safeFetch('data/rosters.json');
    if (response && typeof response === 'object') {
      this.rosters = Object.fromEntries(
        Object.entries(response).map(([teamName, players]) => {
          if (!Array.isArray(players)) {
            return [teamName, []];
          }

          const sanitized = players.map((player) => {
            if (!player || typeof player !== 'object') {
              return { id: '', name: '', team: teamName, division: '' };
            }

            const { number: _ignoredNumber, ...rest } = player;
            // eslint-disable-next-line no-unused-vars
            const _ = _ignoredNumber; // Keep number destructuring but acknowledge we're ignoring it
            return { ...rest, team: player.team ?? teamName };
          });

          return [teamName, sanitized];
        }),
      );
    } else {
      this.rosters = {};
    }
  }

  async loadSchedule() {
    const response = await this.safeFetch('data/schedule.json');
    if (response) {
      this.schedule = response;
    }
  }

  async loadGamesData() {
    const [legacyResponse, indexResponse] = await Promise.all([
      this.safeFetch('data/games.json'),
      this.safeFetch('data/games/index.json'),
    ]);

    const indexEntries = Array.isArray(indexResponse)
      ? indexResponse
          .map((entry) => {
            if (!entry || typeof entry !== 'object') {
              return null;
            }

            const id = `${entry.id ?? ''}`.trim();
            if (!id) {
              return null;
            }

            const normalized = {
              id,
              status: entry.status && entry.status !== 'in_progress' ? entry.status : 'completed',
              homeTeam: entry.homeTeam ?? '',
              awayTeam: entry.awayTeam ?? '',
              homeScore: entry.homeScore ?? null,
              awayScore: entry.awayScore ?? null,
              division: entry.division ?? '',
              date: entry.date ?? null,
              time: entry.time ?? null,
              created: entry.created ?? entry.lastUpdated ?? null,
              lastUpdated: entry.lastUpdated ?? entry.created ?? null,
              overtimeResult: entry.overtimeResult ?? null,
              file: entry.file ?? '',
              source: 'remote-index',
            };

            if (!normalized.created) {
              normalized.created = new Date().toISOString();
            }

            this.ensureShotCounters(normalized);
            this.ensureOvertimeResult(normalized);
            return normalized;
          })
          .filter(Boolean)
      : [];

    this.remoteCompletedGameIds = new Set(indexEntries.map((game) => game.id));

    const gamesById = new Map(indexEntries.map((game) => [game.id, game]));

    if (Array.isArray(legacyResponse)) {
      legacyResponse.forEach((game) => {
        if (!game || typeof game !== 'object') {
          return;
        }

        const id = `${game.id ?? ''}`.trim();
        if (!id) {
          return;
        }

        this.ensureShotCounters(game);
        this.ensureOvertimeResult(game);
        gamesById.set(id, game);
      });
    }

    this.gamesData = Array.from(gamesById.values());
  }

  loadCachedGames() {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (!cached) {
        return;
      }

      const parsed = JSON.parse(cached);
      if (!Array.isArray(parsed)) {
        return;
      }

      const gamesById = new Map(
        Array.isArray(this.gamesData)
          ? this.gamesData
              .filter((game) => game && typeof game === 'object' && game.id)
              .map((game) => [game.id, game])
          : [],
      );

      parsed.forEach((game) => {
        if (!game || typeof game !== 'object') {
          return;
        }

        const id = `${game.id ?? ''}`.trim();
        if (!id) {
          return;
        }

        this.ensureShotCounters(game);
        this.ensureOvertimeResult(game);
        gamesById.set(id, game);
      });

      this.gamesData = Array.from(gamesById.values());
    } catch (error) {
      console.error('Failed to parse cached games', error);
    }
  }

  persistGames() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.gamesData));
    } catch (error) {
      console.error('Failed to persist games', error);
    }
  }

  saveCurrentGameState() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.currentGame) {
        window.localStorage.removeItem(IN_PROGRESS_STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(IN_PROGRESS_STORAGE_KEY, JSON.stringify(this.currentGame));
    } catch (error) {
      console.error('Failed to persist in-progress game', error);
    }
  }

  ensureShotCounters(game) {
    if (!game || typeof game !== 'object') {
      return;
    }

    game.homeShots = toShotCount(game.homeShots);
    game.awayShots = toShotCount(game.awayShots);
  }

  ensureOvertimeResult(game) {
    if (!game || typeof game !== 'object') {
      return;
    }

    const result = game.overtimeResult;
    if (!result || typeof result !== 'object') {
      game.overtimeResult = null;
      return;
    }

    const winner = typeof result.winner === 'string' ? result.winner.trim() : '';
    if (!winner) {
      game.overtimeResult = null;
      return;
    }

    const decidedBy = typeof result.decidedBy === 'string' && result.decidedBy
      ? result.decidedBy
      : 'ot_shootout';
    const recordedAt = typeof result.recordedAt === 'string' && result.recordedAt
      ? result.recordedAt
      : null;

    const normalized = {
      winner,
      decidedBy,
    };
    if (recordedAt) {
      normalized.recordedAt = recordedAt;
    }

    game.overtimeResult = normalized;
  }

  restoreCurrentGame() {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(IN_PROGRESS_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.currentGame = parsed;
        this.ensureShotCounters(this.currentGame);
        return this.currentGame;
      }
    } catch (error) {
      console.error('Failed to restore in-progress game', error);
    }
    return null;
  }

  clearCurrentGameState() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(IN_PROGRESS_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear in-progress game', error);
    }
  }

  discardCurrentGame() {
    this.currentGame = null;
    this.clearCurrentGameState();
  }

  ensureSeedVersion() {
    if (typeof window === 'undefined') return;

    try {
      const version = this.computeSeedVersion();
      const stored = window.localStorage.getItem(DATA_VERSION_KEY);

      if (stored === version) {
        return;
      }

      if (stored === null) {
        window.localStorage.setItem(DATA_VERSION_KEY, version);
        return;
      }

      this.handleSeedChange();
      window.localStorage.setItem(DATA_VERSION_KEY, version);
    } catch (error) {
      console.error('Failed to ensure seed version', error);
    }
  }

  computeSeedVersion() {
    const signature = buildSeedSignature(this.schedule, this.rosters);
    return simpleHash(signature);
  }

  handleSeedChange() {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error('Failed to clear cached games', error);
      }
    }

    this.clearCurrentGameState();
    this.currentGame = null;

    if (!Array.isArray(this.gamesData)) {
      this.gamesData = [];
    }

    this.remoteCompletedGameIds = new Set();

    if (this.syncQueue && typeof this.syncQueue.clear === 'function') {
      this.syncQueue.clear();
    }

    const pending = this.syncQueue && typeof this.syncQueue.size === 'number' ? this.syncQueue.size : 0;
    this.notifySync({ type: 'queue:pending', pending });
  }

  createGame(gameInfo) {
    const baseGame = {
      id: `${Date.now()}`,
      ...gameInfo,
      attendance: gameInfo.attendance || [],
      goals: [],
      penalties: [],
      overtimeResult: gameInfo.overtimeResult ?? null,
      homeScore: 0,
      awayScore: 0,
      homeShots: toShotCount(gameInfo?.homeShots),
      awayShots: toShotCount(gameInfo?.awayShots),
      status: 'in_progress',
      created: new Date().toISOString(),
    };

    if (!baseGame.division) {
      baseGame.division = this.resolveDivisionForGame(baseGame);
    }

    this.ensureShotCounters(baseGame);
    this.ensureOvertimeResult(baseGame);

    return baseGame;
  }

  resolveDivisionForGame(game) {
    const collectDivision = (teamName) => {
      if (!teamName) return null;
      const players = this.getPlayersForTeam(teamName);
      const divisions = new Set();

      players.forEach((player) => {
        if (player && player.division) {
          divisions.add(player.division);
        }
      });

      if (!divisions.size) {
        return null;
      }

      return divisions.values().next().value;
    };

    const homeDivision = collectDivision(game.homeTeam);
    const awayDivision = collectDivision(game.awayTeam);

    if (homeDivision && awayDivision && homeDivision === awayDivision) {
      return homeDivision;
    }

    return homeDivision || awayDivision || '';
  }

  beginGame(gameInfo) {
    this.currentGame = this.createGame(gameInfo);
    this.saveCurrentGameState();
    return this.currentGame;
  }

  addAttendance(attendanceList) {
    if (!this.currentGame) return;

    const validTeams = new Set([this.currentGame.homeTeam, this.currentGame.awayTeam].filter(Boolean));
    const unique = new Map();

    if (Array.isArray(attendanceList)) {
      attendanceList.forEach((record) => {
        if (!record || !validTeams.has(record.team)) {
          return;
        }

        const normalizedJersey = (record.jersey ?? '').trim();
        const entry = {
          id: record.id ?? record.playerId ?? `${record.team}-${unique.size}`,
          name: record.name ?? '',
          team: record.team,
          jersey: normalizedJersey || '##',
          present: Boolean(record.present),
        };

        unique.set(entry.id, entry);
      });
    }

    this.currentGame.attendance = Array.from(unique.values());
    this.saveCurrentGameState();
  }

  addShotOnGoal(team) {
    if (!this.currentGame || !team) return;

    this.ensureShotCounters(this.currentGame);

    if (team === this.currentGame.homeTeam) {
      this.currentGame.homeShots += 1;
    } else if (team === this.currentGame.awayTeam) {
      this.currentGame.awayShots += 1;
    } else {
      return;
    }

    this.saveCurrentGameState();
  }

  addGoal(goalData) {
    if (!this.currentGame) return;

    const normalizedTeamScore = toScoreValue(goalData?.teamScore);
    const normalizedOpponentScore = toScoreValue(goalData?.opponentScore);
    const payload = { ...goalData };

    if (normalizedTeamScore !== null) {
      payload.teamScore = normalizedTeamScore;
    } else {
      delete payload.teamScore;
    }

    if (normalizedOpponentScore !== null) {
      payload.opponentScore = normalizedOpponentScore;
    } else {
      delete payload.opponentScore;
    }

    if (!payload.scoreImpact) {
      const impact = deriveScoreImpact(normalizedTeamScore, normalizedOpponentScore);
      if (impact) {
        payload.scoreImpact = impact;
      }
    }

    const existingGoals = Array.isArray(this.currentGame.goals) ? this.currentGame.goals : [];
    const previousGoalsForPlayer = existingGoals.filter((goal) => goal.playerId === goalData.playerId).length;
    const fallbackTotal = previousGoalsForPlayer + 1;
    const providedTotal = toScoreValue(payload.totalGameGoals);
    const totalGameGoalsValue = Number.isInteger(providedTotal) && providedTotal > 0 ? providedTotal : fallbackTotal;
    payload.totalGameGoals = totalGameGoalsValue;

    payload.hatTrickIndicator = normalizeYesNo(payload.hatTrickIndicator, toYesNo(totalGameGoalsValue >= 3));

    const periodValue = `${payload.period ?? ''}`;
    const clockSecondsValue = Number.isFinite(payload.clockSeconds) ? payload.clockSeconds : toScoreValue(payload.clockSeconds);
    const teamScoreValue = normalizedTeamScore !== null ? normalizedTeamScore : null;
    const opponentScoreValue = normalizedOpponentScore !== null ? normalizedOpponentScore : null;

    const lateGoalComputed = isLateGameGoal(periodValue, clockSecondsValue);
    const earlyGoalComputed = isEarlyGameGoal(periodValue, clockSecondsValue);
    const comebackComputed = isComebackGoal(teamScoreValue, opponentScoreValue);
    const clutchComputed = isClutchGoal(periodValue, clockSecondsValue, teamScoreValue, opponentScoreValue);

    payload.lateGameGoal = normalizeYesNo(payload.lateGameGoal, toYesNo(lateGoalComputed));
    payload.earlyGameGoal = normalizeYesNo(payload.earlyGameGoal, toYesNo(earlyGoalComputed));
    payload.comebackGoal = normalizeYesNo(payload.comebackGoal, toYesNo(comebackComputed));
    payload.clutchGoal = normalizeYesNo(payload.clutchGoal, toYesNo(clutchComputed));

    const goalRecord = {
      id: `${Date.now()}`,
      ...payload,
      timestamp: new Date().toISOString(),
    };

    this.currentGame.goals.push(goalRecord);

    if (goalRecord.team === this.currentGame.homeTeam) {
      this.currentGame.homeScore += 1;
    } else if (goalRecord.team === this.currentGame.awayTeam) {
      this.currentGame.awayScore += 1;
    }

    this.saveCurrentGameState();
  }

  addPenalty(penaltyData) {
    if (!this.currentGame) return;

    const normalizedTeamScore = toScoreValue(penaltyData?.teamScore);
    const normalizedOpponentScore = toScoreValue(penaltyData?.opponentScore);
    const payload = { ...penaltyData };

    if (normalizedTeamScore !== null) {
      payload.teamScore = normalizedTeamScore;
    } else {
      delete payload.teamScore;
    }

    if (normalizedOpponentScore !== null) {
      payload.opponentScore = normalizedOpponentScore;
    } else {
      delete payload.opponentScore;
    }

    const currentPenalties = Array.isArray(this.currentGame.penalties) ? this.currentGame.penalties : [];

    const previousPenaltiesForPlayer = currentPenalties.filter((penalty) => penalty.playerId === penaltyData.playerId).length;
    const fallbackPlayerTotal = previousPenaltiesForPlayer + 1;
    const providedPlayerTotal = toScoreValue(payload.penaltiesThisGame);
    const penaltiesThisGameValue = Number.isInteger(providedPlayerTotal) && providedPlayerTotal > 0 ? providedPlayerTotal : fallbackPlayerTotal;
    payload.penaltiesThisGame = penaltiesThisGameValue;

    const teamPenaltyCountFallback = currentPenalties.filter((penalty) => penalty.team === penaltyData.team).length + 1;
    const providedTeamPenaltyCount = toScoreValue(payload.teamPenaltyCount);
    const teamPenaltyCountValue = Number.isInteger(providedTeamPenaltyCount) && providedTeamPenaltyCount > 0 ? providedTeamPenaltyCount : teamPenaltyCountFallback;
    payload.teamPenaltyCount = teamPenaltyCountValue;

    const periodValue = `${payload.period ?? ''}`;
    const rawClockSeconds = Number.isFinite(payload.clockSeconds) ? payload.clockSeconds : toScoreValue(payload.clockSeconds);
    const clockSecondsValue = Number.isFinite(rawClockSeconds) ? rawClockSeconds : null;
    if (clockSecondsValue !== null) {
      payload.clockSeconds = clockSecondsValue;
    } else {
      delete payload.clockSeconds;
    }

    const teamScoreValue = normalizedTeamScore !== null ? normalizedTeamScore : null;
    const opponentScoreValue = normalizedOpponentScore !== null ? normalizedOpponentScore : null;

    const latePenaltyComputed = isLateGameGoal(periodValue, clockSecondsValue);
    const earlyPenaltyComputed = isEarlyGameGoal(periodValue, clockSecondsValue);
    const comebackThreatComputed =
      periodValue === '3' && Number.isFinite(teamScoreValue) && Number.isFinite(opponentScoreValue) && teamScoreValue > opponentScoreValue && teamScoreValue - opponentScoreValue <= 1;
    const clutchPenaltyComputed = isClutchGoal(periodValue, clockSecondsValue, teamScoreValue, opponentScoreValue);

    payload.latePenalty = normalizeYesNo(payload.latePenalty, toYesNo(latePenaltyComputed));
    payload.earlyPenalty = normalizeYesNo(payload.earlyPenalty, toYesNo(earlyPenaltyComputed));
    payload.comebackThreat = normalizeYesNo(payload.comebackThreat, toYesNo(comebackThreatComputed));
    payload.clutchPenalty = normalizeYesNo(payload.clutchPenalty, toYesNo(clutchPenaltyComputed));

    const lastGoal = this.currentGame.goals?.length ? this.currentGame.goals[this.currentGame.goals.length - 1] : null;
    const momentumComputed = lastGoal ? lastGoal.team === penaltyData.team : false;
    payload.momentumSwing = normalizeYesNo(payload.momentumSwing, toYesNo(momentumComputed));

    if (!payload.penaltyImpact) {
      if (Number.isFinite(teamScoreValue) && Number.isFinite(opponentScoreValue)) {
        const scoreDiff = teamScoreValue - opponentScoreValue;
        if (scoreDiff < 0) {
          payload.penaltyImpact = 'trailing penalty';
        } else if (scoreDiff === 0) {
          payload.penaltyImpact = 'tied penalty';
        } else if (scoreDiff >= 2) {
          payload.penaltyImpact = 'costly penalty';
        } else {
          payload.penaltyImpact = 'leading penalty';
        }
      } else {
        payload.penaltyImpact = '';
      }
    }

    payload.powerPlayConverted = payload.powerPlayConverted ?? '';

    const penaltyRecord = {
      id: `${Date.now()}`,
      ...payload,
      timestamp: new Date().toISOString(),
    };

    this.currentGame.penalties.push(penaltyRecord);
    this.saveCurrentGameState();
  }

  annotatePenaltyPowerPlays(game) {
    if (!game || !Array.isArray(game.penalties) || !game.penalties.length) {
      return;
    }

    const penalties = game.penalties;
    const goals = Array.isArray(game.goals) ? game.goals : [];
    const goalTimeline = goals
      .map((goal) => {
        const periodValue = `${goal.period ?? ''}`;
        const rawClock = Number.isFinite(goal.clockSeconds) ? goal.clockSeconds : toScoreValue(goal.clockSeconds);
        const clockValue = Number.isFinite(rawClock) ? rawClock : null;
        const absoluteTime = computeAbsoluteSeconds(periodValue, clockValue);
        return { team: goal.team, absoluteTime };
      })
      .sort((a, b) => a.absoluteTime - b.absoluteTime);

    penalties.forEach((penalty) => {
      if (!penalty || typeof penalty !== 'object') {
        return;
      }

      const minutes = Number.parseInt(penalty.minutes, 10) || 0;
      const periodValue = `${penalty.period ?? ''}`;
      const rawClock = Number.isFinite(penalty.clockSeconds) ? penalty.clockSeconds : toScoreValue(penalty.clockSeconds);
      const clockValue = Number.isFinite(rawClock) ? rawClock : null;
      const startTime = computeAbsoluteSeconds(periodValue, clockValue);

      if (!Number.isFinite(startTime)) {
        if (!penalty.powerPlayConverted) {
          penalty.powerPlayConverted = '';
        }
        return;
      }

      if (minutes < 2) {
        if (!penalty.powerPlayConverted) {
          penalty.powerPlayConverted = '';
        }
        return;
      }

      if (minutes >= 10) {
        if (!penalty.powerPlayConverted) {
          penalty.powerPlayConverted = 'not_applicable';
        }
        return;
      }

      const durationSeconds = minutes * 60;
      const endTime = startTime + durationSeconds;
      const opponentTeam = penalty.team === game.homeTeam ? game.awayTeam : game.homeTeam;

      const goalDuring = goalTimeline.find((goal) => goal.team === opponentTeam && goal.absoluteTime > startTime && goal.absoluteTime <= endTime);

      penalty.powerPlayConverted = goalDuring ? 'yes' : 'no';
    });
  }

  recordOvertimeWinner(teamName) {
    if (!this.currentGame) return;

    const normalized = typeof teamName === 'string' ? teamName.trim() : '';
    if (!normalized) return;

    const validTeams = new Set([this.currentGame.homeTeam, this.currentGame.awayTeam].filter(Boolean));
    if (!validTeams.has(normalized)) {
      return;
    }

    this.currentGame.overtimeResult = {
      winner: normalized,
      decidedBy: 'ot_shootout',
      recordedAt: new Date().toISOString(),
    };
    this.ensureOvertimeResult(this.currentGame);
    this.saveCurrentGameState();
  }

  endCurrentGame() {
    if (!this.currentGame) return null;

    const isPracticeGame = Boolean(this.currentGame?.isPractice);

    this.currentGame.status = 'completed';
    this.currentGame.ended = new Date().toISOString();

    this.annotatePenaltyPowerPlays(this.currentGame);

    const validation = safeValidateGame(this.currentGame);
    const completedGame = validation.success ? validation.data : { ...this.currentGame };
    this.ensureOvertimeResult(completedGame);

    if (!validation.success) {
      console.warn('Game validation warnings:', validation.error.flatten());
    }

    if (!isPracticeGame) {
      this.gamesData.push(completedGame);
      this.persistGames();
      this.syncQueue.enqueue(completedGame);
      this.notifySync({ type: 'queue:pending', pending: this.syncQueue.size });
    }

    this.clearCurrentGameState();
    this.currentGame = null;
    void this.triggerSync();

    return completedGame;
  }

  getPlayersForTeam(teamName) {
    return this.rosters[teamName] || [];
  }

  getUpcomingGames() {
    if (!Array.isArray(this.schedule)) {
      return [];
    }

    const completedGameIds = new Set(
      this.remoteCompletedGameIds instanceof Set ? this.remoteCompletedGameIds : [],
    );

    (Array.isArray(this.gamesData) ? this.gamesData : []).forEach((game) => {
      if (game && game.id && game.status !== 'in_progress') {
        completedGameIds.add(game.id);
      }
    });

    return this.schedule.filter((game) => {
      if (!game || !game.id) {
        return false;
      }

      if (game.isPractice) {
        return true;
      }

      return !completedGameIds.has(game.id);
    });
  }

  getGameById(gameId) {
    return this.schedule.find((game) => game.id === gameId) || null;
  }

  getHistory() {
    return [...this.gamesData].sort((a, b) => new Date(b.created) - new Date(a.created));
  }

  async triggerSync() {
    if (this.isSyncing) return;
    if (!this.syncQueue.size) return;

    if (!this.syncService || !this.syncService.isConfigured) {
      this.notifySync({ type: 'queue:awaiting-config', pending: this.syncQueue.size });
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notifySync({ type: 'queue:offline', pending: this.syncQueue.size });
      return;
    }

    this.isSyncing = true;

    const pending = this.syncQueue.getPending();
    for (const item of pending) {
      this.notifySync({ type: 'sync:start', gameId: item.id, pending: this.syncQueue.size });
      try {
        await this.syncService.syncGame(item.payload);
        this.syncQueue.markSynced(item.id);
        this.notifySync({ type: 'sync:success', gameId: item.id, pending: this.syncQueue.size });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync error';
        this.syncQueue.markFailed(item.id, message);
        this.notifySync({
          type: 'sync:error',
          gameId: item.id,
          error: message,
          pending: this.syncQueue.size,
        });
      }
    }

    this.isSyncing = false;
  }

  async safeFetch(url) {
    try {
      const response = await this.fetchImpl(url, { cache: 'no-cache' });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch ${url}`, error);
      return null;
    }
  }
}

export const dataManager = new DataManager();

