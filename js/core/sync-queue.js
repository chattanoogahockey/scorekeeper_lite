const STORAGE_KEY = 'chahky_sync_queue';

export class SyncQueue {
  constructor(storageKey = STORAGE_KEY, storage = window.localStorage) {
    this.storageKey = storageKey;
    this.storage = storage;
    this.items = this.load();
  }

  load() {
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error('Failed to load sync queue', error);
    }
    return [];
  }

  persist() {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.items));
    } catch (error) {
      console.error('Failed to persist sync queue', error);
    }
  }

  enqueue(game) {
    const payload = JSON.parse(JSON.stringify(game));
    this.items.push({
      id: payload.id,
      payload,
      status: 'pending',
      attempts: 0,
      lastError: null,
      lastAttemptAt: null,
    });
    this.persist();
  }

  markSynced(gameId) {
    this.items = this.items.filter((item) => item.id !== gameId);
    this.persist();
  }

  markFailed(gameId, errorMessage) {
    const target = this.items.find((item) => item.id === gameId);
    if (!target) return;
    target.status = 'pending';
    target.attempts += 1;
    target.lastError = errorMessage;
    target.lastAttemptAt = new Date().toISOString();
    this.persist();
  }

  clear() {
    this.items = [];

    if (this.storage && typeof this.storage.removeItem === 'function') {
      try {
        this.storage.removeItem(this.storageKey);
        return;
      } catch (error) {
        console.error('Failed to clear sync queue', error);
      }
    }

    this.persist();
  }

  getPending() {
    return [...this.items];
  }

  get size() {
    return this.items.length;
  }
}