import { ScorekeeperApp } from './app/scorekeeper-app.js';
import { SyncBanner } from './components/sync-banner.js';
import { getAppConfig } from './core/config.js';
import { SyncService } from './core/sync-service.js';

function bootstrap() {
  const mainContent = document.getElementById('main-content');
  const topNavigation = document.getElementById('top-navigation');
  const header = document.querySelector('header');
  const bannerContainer = document.getElementById('sync-banner');

  if (!mainContent || !topNavigation || !header) {
    console.error('Required DOM nodes not found.');
    return;
  }

  const app = new ScorekeeperApp(mainContent, topNavigation, header);

  const config = getAppConfig();
  const syncService = new SyncService({
    endpoint: config.syncEndpoint,
    apiKey: config.syncApiKey,
  });
  app.data.setSyncService(syncService);

  if (bannerContainer) {
    const banner = new SyncBanner(bannerContainer);
    app.data.onSyncStatus((event) => banner.update(event));
  }

  app
    .init()
    .then(() => {
      window.app = app; // expose for debugging
    })
    .catch((error) => {
      console.error('Failed to initialize ScorekeeperApp', error);
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}



