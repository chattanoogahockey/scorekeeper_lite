import { safeValidateGame } from './schema.js';
import { SyncQueue } from './sync-queue.js';

const STORAGE_KEY = 'chahky_games';
const IN_PROGRESS_STORAGE_KEY = 'chahky_current_game';

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
    if (response) {
      this.rosters = response;
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
      this.gamesData = response;
    }
  }

  loadCachedGames() {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          this.gamesData = parsed;
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

  restoreCurrentGame() {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(IN_PROGRESS_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.currentGame = parsed;
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

  createGame(gameInfo) {
    return {
      id: `${Date.now()}`,
      ...gameInfo,
      attendance: gameInfo.attendance || [],
      goals: [],
      penalties: [],
      homeScore: 0,
      awayScore: 0,
      status: 'in_progress',
      created: new Date().toISOString(),
    };
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

  addGoal(goalData) {
    if (!this.currentGame) return;

    const goalRecord = {
      id: `${Date.now()}`,
      ...goalData,
      timestamp: new Date().toISOString(),
    };

    this.currentGame.goals.push(goalRecord);
    this.saveCurrentGameState();

    if (goalData.team === this.currentGame.homeTeam) {
      this.currentGame.homeScore += 1;
    } else if (goalData.team === this.currentGame.awayTeam) {
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