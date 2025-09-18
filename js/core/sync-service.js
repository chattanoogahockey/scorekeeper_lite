export class SyncService {
  constructor({ endpoint, apiKey, fetchImpl = window.fetch.bind(window) }) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  get isConfigured() {
    return Boolean(this.endpoint);
  }

  async syncGame(game) {
    if (!this.isConfigured) {
      throw new Error('Sync service endpoint not configured');
    }

    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        version: '1.0.0',
        source: 'scorekeeper-lite',
        game,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sync failed: ${response.status} ${errorText}`);
    }

    return response.json().catch(() => ({}));
  }
}