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
    const response = await this.safeFetch('data/games.json');
    if (Array.isArray(response)) {
      this.gamesData = response.map((game) => {
        if (game && typeof game === 'object') {
          this.ensureShotCounters(game);
        }
        return game;
      });
    }
  }

  loadCachedGames() {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          this.gamesData = parsed.map((game) => {
            if (game && typeof game === 'object') {
              this.ensureShotCounters(game);
            }
            return game;
          });
        }
      }
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
    this.currentGame.attendance = attendanceList;
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
    this.saveCurrentGameState();

    if (goalRecord.team === this.currentGame.homeTeam) {
      this.currentGame.homeScore += 1;
    } else if (goalRecord.team === this.currentGame.awayTeam) {
      this.currentGame.awayScore += 1;
    }
  }

  addPenalty(penaltyData) {
    if (!this.currentGame) return;

    const penaltyRecord = {
      id: `${Date.now()}`,
      ...penaltyData,
      timestamp: new Date().toISOString(),
    };

    this.currentGame.penalties.push(penaltyRecord);
    this.saveCurrentGameState();
  }

  endCurrentGame() {
    if (!this.currentGame) return null;

    this.currentGame.status = 'completed';
    this.currentGame.ended = new Date().toISOString();

    const validation = safeValidateGame(this.currentGame);
    const completedGame = validation.success ? validation.data : { ...this.currentGame };

    if (!validation.success) {
      console.warn('Game validation warnings:', validation.error.flatten());
    }

    this.gamesData.push(completedGame);
    this.persistGames();
    this.syncQueue.enqueue(completedGame);
    this.notifySync({ type: 'queue:pending', pending: this.syncQueue.size });

    this.clearCurrentGameState();
    this.currentGame = null;
    void this.triggerSync();

    return completedGame;
  }

  getPlayersForTeam(teamName) {
    return this.rosters[teamName] || [];
  }

  getUpcomingGames() {
    return this.schedule;
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

