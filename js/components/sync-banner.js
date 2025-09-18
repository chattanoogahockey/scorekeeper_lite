const STATE_CLASSES = {
  pending: 'sync-info',
  syncing: 'sync-info',
  success: 'sync-success',
  error: 'sync-error',
  offline: 'sync-warning',
  awaiting: 'sync-warning',
};

export class SyncBanner {
  constructor(element) {
    this.element = element;
    this.currentClass = null;
    this.hideTimeout = null;
    this.hide();
  }

  update(event) {
    switch (event.type) {
      case 'queue:pending':
        this.show(`Pending sync: ${event.pending} game(s)`, 'pending');
        break;
      case 'queue:offline':
        this.show(`Offline. ${event.pending} game(s) will sync once you're back online.`, 'offline');
        break;
      case 'queue:awaiting-config':
        this.show('Sync endpoint not configured. Games are stored locally.', 'awaiting');
        break;
      case 'sync:start':
        this.show('Syncing game data…', 'syncing');
        break;
      case 'sync:success':
        if (event.pending > 0) {
          this.show(`Game synced. ${event.pending} remaining.`, 'pending');
        } else {
          this.show('All games synced!', 'success', 2500);
        }
        break;
      case 'sync:error':
        this.show(`Sync failed. ${event.error}`, 'error');
        break;
      default:
        break;
    }
  }

  show(message, state, autoHideMs) {
    this.clearState();
    const className = STATE_CLASSES[state] ?? 'sync-info';
    this.element.classList.add(className);
    this.currentClass = className;
    this.element.textContent = message;
    this.element.hidden = false;
    this.element.style.display = 'block';

    if (autoHideMs) {
      window.clearTimeout(this.hideTimeout);
      this.hideTimeout = window.setTimeout(() => this.hide(), autoHideMs);
    }
  }

  hide() {
    this.clearState();
    this.element.textContent = '';
    this.element.hidden = true;
    this.element.style.display = 'none';
  }

  clearState() {
    if (this.currentClass) {
      this.element.classList.remove(this.currentClass);
    }
    this.currentClass = null;
  }
}