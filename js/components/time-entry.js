const MIN_SECONDS = 1;
const MAX_SECONDS = 16 * 60 + 59;

export function formatTime(minutes, seconds) {
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function deriveTimeFromDigits(digits) {
  if (!Array.isArray(digits)) {
    return { status: 'invalid' };
  }

  const trimmed = digits
    .map((digit) => `${digit}`.trim())
    .filter((digit) => /^[0-9]$/.test(digit));

  if (!trimmed.length) {
    return { status: 'empty', value: '', display: '00:00', seconds: 0 };
  }

  const recent = trimmed.slice(-4);
  const raw = recent.join('');
  const padded = raw.padStart(4, '0');
  const minutesDigits = padded.slice(0, 2);
  const secondsDigits = padded.slice(2);

  const minutes = Number.parseInt(minutesDigits, 10);
  const seconds = Number.parseInt(secondsDigits, 10);

  if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return { status: 'invalid' };
  }

  const totalSeconds = minutes * 60 + seconds;

  if (trimmed.length < 4 && (seconds > 59 || minutes > 16)) {
    return { status: 'partial', seconds: totalSeconds };
  }

  if (seconds > 59 || minutes > 16 || totalSeconds > MAX_SECONDS) {
    return { status: 'invalid' };
  }

  if (totalSeconds === 0) {
    return { status: 'zero', value: '', display: '00:00', seconds: 0 };
  }

  if (totalSeconds < MIN_SECONDS) {
    return { status: 'invalid' };
  }

  const formatted = formatTime(minutes, seconds);
  return { status: 'valid', value: formatted, display: formatted, seconds: totalSeconds };
}

export class TimeEntry {
  constructor(container, { initialValue = '' } = {}) {
    if (!container) {
      throw new Error('TimeEntry requires a container element');
    }

    this.container = container;
    this.displayEl = container.querySelector('[data-time-display]');
    this.keypadEl = container.querySelector('[data-time-keypad]');
    this.clearEl = container.querySelector('[data-time-clear]');
    this.hiddenInput = container.querySelector('[data-field="time"]');
    this.digits = [];

    if (!this.displayEl || !this.keypadEl || !this.hiddenInput) {
      throw new Error('TimeEntry container missing required child elements');
    }

    this.renderKeypad();
    this.bindEvents();

    if (initialValue && /^\d{2}:\d{2}$/.test(initialValue)) {
      this.applyInitialValue(initialValue);
    } else {
      this.syncState({ value: '', display: '00:00' });
    }
  }

  renderKeypad() {
    if (this.keypadEl.children.length) {
      return;
    }

    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    digits.forEach((digit) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'time-keypad-button';
      button.textContent = digit;
      button.dataset.digit = digit;
      this.keypadEl.appendChild(button);
    });

    if (this.clearEl) {
      this.clearEl.type = 'button';
      this.clearEl.classList.add('time-keypad-clear');
    } else {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'time-keypad-clear';
      clearBtn.textContent = 'Clear';
      clearBtn.dataset.action = 'clear';
      this.keypadEl.parentElement?.appendChild(clearBtn);
      this.clearEl = clearBtn;
    }
  }

  bindEvents() {
    this.keypadEl.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const digit = target.dataset.digit;
      if (!digit) {
        return;
      }
      this.handleDigit(digit);
    });

    this.clearEl?.addEventListener('click', () => {
      this.clear();
    });
  }

  handleDigit(digit) {
    const nextDigits = [...this.digits, digit];
    if (nextDigits.length > 4) {
      nextDigits.splice(0, nextDigits.length - 4);
    }

    const result = deriveTimeFromDigits(nextDigits);

    switch (result.status) {
      case 'partial':
        this.digits = nextDigits;
        break;
      case 'zero':
      case 'empty':
        this.digits = nextDigits;
        this.syncState({ value: '', display: '00:00' });
        break;
      case 'valid':
        this.digits = nextDigits;
        this.syncState(result);
        break;
      default:
        break;
    }
  }

  applyInitialValue(value) {
    const normalized = value.trim();
    const [mm, ss] = normalized.split(':');
    const minutes = Number.parseInt(mm, 10);
    const seconds = Number.parseInt(ss, 10);
    if (
      Number.isNaN(minutes) ||
      Number.isNaN(seconds) ||
      seconds > 59 ||
      minutes > 16 ||
      minutes * 60 + seconds < MIN_SECONDS
    ) {
      this.syncState({ value: '', display: '00:00' });
      return;
    }

    const digits = `${mm}${ss}`.split('');
    this.digits = digits.slice(-4);
    this.syncState({ value: normalized, display: normalized });
  }

  clear() {
    this.digits = [];
    this.syncState({ value: '', display: '00:00' });
  }

  syncState({ value, display }) {
    this.hiddenInput.value = value ?? '';
    if (this.displayEl) {
      this.displayEl.textContent = display ?? '00:00';
    }
  }
}

export function attachTimeEntry(container, options = {}) {
  return new TimeEntry(container, options);
}

export function timeEntryMarkup() {
  return `
    <div class="time-entry" data-time-input>
      <div class="time-entry-display" data-time-display>00:00</div>
      <div class="time-entry-keypad" data-time-keypad></div>
      <div class="time-entry-actions">
        <button type="button" class="time-entry-clear" data-time-clear>Clear</button>
      </div>
      <input type="hidden" data-field="time" value="">
    </div>
  `;
}

export const TimeEntryLimits = Object.freeze({ MIN_SECONDS, MAX_SECONDS });
