const globalConfig = typeof window !== 'undefined' ? window.SCOREKEEPER_CONFIG ?? {} : {};

export function getAppConfig() {
  return {
    syncEndpoint: globalConfig.syncEndpoint || '',
    syncApiKey: globalConfig.syncApiKey || '',
  };
}