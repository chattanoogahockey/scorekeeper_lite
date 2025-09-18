import { describe, expect, it } from 'vitest';

import { formatGameTime } from '../js/utils/formatters.js';

describe('formatGameTime', () => {
  it('converts 24-hour time to 12-hour format', () => {
    expect(formatGameTime('18:30:00')).toBe('6:30 PM');
    expect(formatGameTime('09:05:00')).toBe('9:05 AM');
  });

  it('handles malformed input gracefully', () => {
    expect(formatGameTime(null)).toBe('TBD');
    expect(formatGameTime('')).toBe('TBD');
    expect(formatGameTime('invalid')).toBe('TBD');
  });
});