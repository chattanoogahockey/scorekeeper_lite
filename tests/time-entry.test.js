/* @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from 'vitest';
import { deriveTimeFromDigits, TimeEntry, timeEntryMarkup } from '../js/components/time-entry.js';

describe('deriveTimeFromDigits', () => {
  it('formats sequential digits into mm:ss', () => {
    const result = deriveTimeFromDigits(['1', '1']);
    expect(result?.value).toBe('00:11');
  });

  it('handles uneven input like 5,3,5', () => {
    const result = deriveTimeFromDigits(['5', '3', '5']);
    expect(result?.value).toBe('05:35');
  });

  it('rejects values above 16:59', () => {
    const result = deriveTimeFromDigits(['1', '7', '0', '0']);
    expect(result).toBeNull();
  });

  it('rejects invalid seconds', () => {
    const result = deriveTimeFromDigits(['1', '2', '6', '5']);
    expect(result).toBeNull();
  });
});

describe('TimeEntry interaction', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = timeEntryMarkup();
  });

  it('builds a valid time when digits are entered', () => {
    const root = container.querySelector('[data-time-input]');
    const entry = new TimeEntry(root);

    entry.handleDigit('1');
    entry.handleDigit('1');

    const hidden = root.querySelector('[data-field="time"]');
    expect(hidden.value).toBe('00:11');
  });

  it('clears the value', () => {
    const root = container.querySelector('[data-time-input]');
    const entry = new TimeEntry(root);

    entry.handleDigit('5');
    entry.clear();

    const hidden = root.querySelector('[data-field="time"]');
    expect(hidden.value).toBe('');
    const display = root.querySelector('[data-time-display]');
    expect(display.textContent).toBe('00:00');
  });
});


