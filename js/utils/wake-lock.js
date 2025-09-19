const RETRY_DELAY_MS = 3000;
let wakeLock = null;
let retryTimer = null;

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    return;
  }

  if (wakeLock) {
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
      scheduleWakeLockRetry();
    });
  } catch (error) {
    console.warn('Screen wake lock request failed', error);
    scheduleWakeLockRetry();
  }
}

function scheduleWakeLockRetry(delay = RETRY_DELAY_MS) {
  clearRetryTimer();
  if (document.visibilityState !== 'visible') {
    return;
  }
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    requestWakeLock();
  }, delay);
}

export function enableScreenWakeLock() {
  if (!('wakeLock' in navigator)) {
    console.info('Screen Wake Lock API not supported in this browser.');
    return;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scheduleWakeLockRetry(0);
    } else if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  });

  window.addEventListener('beforeunload', () => {
    clearRetryTimer();
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  });

  document.addEventListener(
    'pointerdown',
    () => {
      scheduleWakeLockRetry(0);
    },
    { once: true },
  );

  scheduleWakeLockRetry(0);
}
