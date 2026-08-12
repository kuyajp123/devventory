import { CalendarDate, parseDate } from '@internationalized/date';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildExactResetAt,
  buildRelativeResetAt,
  format24HourTo12HourText,
  formatCalendarDateToText,
  formatResetSummary,
  parseExistingResetAt,
  parseTextDate,
  parseTextTime,
} from './reset-at';

// Fixed "now" so tests don't depend on wall-clock time
const NOW = new Date('2026-08-10T06:00:00Z'); // 14:00 Asia/Manila (UTC+8)
const MANILA = 'Asia/Manila';

describe('buildExactResetAt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('converts a future local date+time to a UTC ISO string', () => {
    const calDate = parseDate('2026-08-14');
    const result = buildExactResetAt(calDate, '15:00', MANILA);
    // 2026-08-14 15:00 Asia/Manila = UTC+8 → 07:00 UTC
    expect(result).toBe('2026-08-14T07:00:00.000Z');
  });

  it('returns null for a past datetime', () => {
    const calDate = parseDate('2026-08-09'); // yesterday relative to NOW
    const result = buildExactResetAt(calDate, '09:00', MANILA);
    expect(result).toBeNull();
  });

  it('returns null for an invalid time format', () => {
    const calDate = parseDate('2026-08-14');
    expect(buildExactResetAt(calDate, 'not-a-time', MANILA)).toBeNull();
    expect(buildExactResetAt(calDate, '25:00', MANILA)).toBeNull();
    expect(buildExactResetAt(calDate, '12:60', MANILA)).toBeNull();
    expect(buildExactResetAt(calDate, '', MANILA)).toBeNull();
  });

  it('accepts HH:MM with leading zero', () => {
    const calDate = parseDate('2026-08-14');
    const result = buildExactResetAt(calDate, '09:00', MANILA);
    // 2026-08-14 09:00 Asia/Manila = 01:00 UTC
    expect(result).toBe('2026-08-14T01:00:00.000Z');
  });

  it('returns null for an invalid timezone', () => {
    const calDate = parseDate('2026-08-14');
    const result = buildExactResetAt(calDate, '09:00', 'Invalid/Tz');
    expect(result).toBeNull();
  });

  it('handles midnight (00:00) correctly', () => {
    const calDate = parseDate('2026-08-14');
    const result = buildExactResetAt(calDate, '00:00', 'UTC');
    expect(result).toBe('2026-08-14T00:00:00.000Z');
  });

  it('handles single-digit hour input without leading zero', () => {
    const calDate = parseDate('2026-08-14');
    const result = buildExactResetAt(calDate, '9:00', MANILA);
    expect(result).toBe('2026-08-14T01:00:00.000Z');
  });
});

describe('buildRelativeResetAt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes a UTC timestamp delta days + hours + minutes from now', () => {
    const result = buildRelativeResetAt(1, 2, 30);
    // 1d 2h 30m = 26h 30m = 1590 minutes
    const expected = new Date(NOW.getTime() + 1590 * 60 * 1000).toISOString();
    expect(result).toBe(expected);
  });

  it('returns null when total delta is zero', () => {
    expect(buildRelativeResetAt(0, 0, 0)).toBeNull();
  });

  it('returns null when any value is negative', () => {
    expect(buildRelativeResetAt(-1, 0, 0)).toBeNull();
    expect(buildRelativeResetAt(0, -1, 0)).toBeNull();
    expect(buildRelativeResetAt(0, 0, -1)).toBeNull();
  });

  it('accepts only minutes being non-zero', () => {
    const result = buildRelativeResetAt(0, 0, 30);
    const expected = new Date(NOW.getTime() + 30 * 60 * 1000).toISOString();
    expect(result).toBe(expected);
  });

  it('accepts only hours being non-zero', () => {
    const result = buildRelativeResetAt(0, 2, 0);
    const expected = new Date(NOW.getTime() + 120 * 60 * 1000).toISOString();
    expect(result).toBe(expected);
  });

  it('truncates fractional inputs', () => {
    // 1.9 days treated as 1 day
    const resultFrac = buildRelativeResetAt(1.9, 0, 0);
    const resultInt = buildRelativeResetAt(1, 0, 0);
    expect(resultFrac).toBe(resultInt);
  });

  it('returns null for excessively large values', () => {
    // 11 years worth of minutes
    expect(buildRelativeResetAt(11 * 366, 0, 0)).toBeNull();
  });
});

describe('parseExistingResetAt', () => {
  it('converts a UTC ISO resetAt into local CalendarDate and HH:MM time', () => {
    // 2026-08-14T07:00:00Z = 15:00 Asia/Manila
    const { calDate, time } = parseExistingResetAt(
      '2026-08-14T07:00:00Z',
      MANILA,
    );
    expect(calDate).toEqual(new CalendarDate(2026, 8, 14));
    expect(time).toBe('15:00');
  });

  it('handles UTC timezone', () => {
    const { calDate, time } = parseExistingResetAt(
      '2026-08-14T09:30:00Z',
      'UTC',
    );
    expect(calDate).toEqual(new CalendarDate(2026, 8, 14));
    expect(time).toBe('09:30');
  });

  it('handles midnight crossover correctly', () => {
    // 2026-08-13T16:00:00Z = 2026-08-14 00:00 Asia/Manila (UTC+8)
    const { calDate, time } = parseExistingResetAt(
      '2026-08-13T16:00:00Z',
      MANILA,
    );
    expect(calDate).toEqual(new CalendarDate(2026, 8, 14));
    expect(time).toBe('00:00');
  });

  it('pads single-digit hours and minutes with leading zero', () => {
    // 2026-08-14T01:05:00Z = 09:05 Asia/Manila
    const result = parseExistingResetAt('2026-08-14T01:05:00Z', MANILA);
    expect(result.time).toBe('09:05');
  });
});

describe('parseTextDate', () => {
  it('parses valid MM/DD/YYYY format', () => {
    const result = parseTextDate('08/14/2026');
    expect(result).toEqual(new CalendarDate(2026, 8, 14));
  });

  it('parses without leading zeros', () => {
    const result = parseTextDate('8/14/2026');
    expect(result).toEqual(new CalendarDate(2026, 8, 14));
  });

  it('returns null for invalid month', () => {
    expect(parseTextDate('13/14/2026')).toBeNull();
    expect(parseTextDate('00/14/2026')).toBeNull();
  });

  it('returns null for invalid day', () => {
    expect(parseTextDate('08/32/2026')).toBeNull();
    expect(parseTextDate('08/00/2026')).toBeNull();
  });

  it('returns null for invalid year', () => {
    expect(parseTextDate('08/14/1899')).toBeNull();
    expect(parseTextDate('08/14/2101')).toBeNull();
  });

  it('parses valid YYYY-MM-DD format', () => {
    const result = parseTextDate('2026-08-14');
    expect(result).toEqual(new CalendarDate(2026, 8, 14));
  });

  it('returns null for malformed format', () => {
    expect(parseTextDate('2026-99-99')).toBeNull();
    expect(parseTextDate('abcd')).toBeNull();
    expect(parseTextDate('')).toBeNull();
  });

  it('returns null for leap day when not a leap year', () => {
    expect(parseTextDate('02/29/2026')).toBeNull(); // 2026 is not a leap year
  });

  it('accepts leap day when it is a leap year', () => {
    const result = parseTextDate('02/29/2028');
    expect(result).toEqual(new CalendarDate(2028, 2, 29));
  });
});

describe('parseTextTime', () => {
  it('parses valid 12-hour AM/PM format', () => {
    expect(parseTextTime('09:00 AM')).toBe('09:00');
    expect(parseTextTime('09:00 PM')).toBe('21:00');
  });

  it('parses without leading zeros', () => {
    expect(parseTextTime('9:00 AM')).toBe('09:00');
    expect(parseTextTime('9:00 PM')).toBe('21:00');
  });

  it('defaults to AM when meridiem not specified', () => {
    expect(parseTextTime('09:00')).toBe('09:00');
    expect(parseTextTime('9:00')).toBe('09:00');
  });

  it('handles midnight correctly', () => {
    expect(parseTextTime('12:00 AM')).toBe('00:00');
  });

  it('handles noon correctly', () => {
    expect(parseTextTime('12:00 PM')).toBe('12:00');
  });

  it('returns null for invalid hour', () => {
    expect(parseTextTime('13:00 AM')).toBeNull();
    expect(parseTextTime('25:00 PM')).toBeNull();
  });

  it('returns null for invalid minute', () => {
    expect(parseTextTime('09:60 AM')).toBeNull();
    expect(parseTextTime('09:99 PM')).toBeNull();
  });

  it('returns null for malformed format', () => {
    expect(parseTextTime('not-a-time')).toBeNull();
    expect(parseTextTime('')).toBeNull();
  });
});

describe('formatting helpers', () => {
  it('formatCalendarDateToText formats CalendarDate to MM/DD/YYYY', () => {
    expect(formatCalendarDateToText(new CalendarDate(2026, 8, 14))).toBe(
      '08/14/2026',
    );
    expect(formatCalendarDateToText(new CalendarDate(2026, 1, 5))).toBe(
      '01/05/2026',
    );
  });

  it('format24HourTo12HourText formats HH:MM to 12-hour AM/PM string', () => {
    expect(format24HourTo12HourText('09:00')).toBe('09:00 AM');
    expect(format24HourTo12HourText('15:30')).toBe('03:30 PM');
    expect(format24HourTo12HourText('00:00')).toBe('12:00 AM');
    expect(format24HourTo12HourText('12:00')).toBe('12:00 PM');
  });

  it('formatResetSummary formats ISO resetAt with timezone', () => {
    // 2026-08-14T01:00:00Z = 09:00 AM Asia/Manila (UTC+8)
    const formatted = formatResetSummary('2026-08-14T01:00:00Z', MANILA);
    expect(formatted).toContain('Aug 14, 2026');
    expect(formatted).toContain('09:00 AM');
  });
});
