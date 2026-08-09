import {
  type CalendarDate,
  fromDate,
  toCalendarDate,
  toZoned,
} from '@internationalized/date';

const MAX_RELATIVE_MINUTES = 10 * 366 * 24 * 60; // ~10 years

/**
 * Converts a CalendarDate (from HeroUI DatePicker) + HH:MM time string into a
 * UTC ISO 8601 string, respecting the given IANA timezone.
 *
 * Returns null when:
 * - The time string is not a valid HH:MM value
 * - The local datetime is ambiguous (DST gap) – chrono parity: return null
 * - The resulting moment is in the past
 */
export function buildExactResetAt(
  calDate: CalendarDate,
  time: string,
  timezone: string,
): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour > 23 || minute > 59) return null;

  try {
    const zoned = toZoned(calDate, timezone).set({
      hour,
      millisecond: 0,
      minute,
      second: 0,
    });
    const isoString = zoned.toAbsoluteString();
    if (new Date(isoString) <= new Date()) return null;
    return isoString;
  } catch {
    // toZoned throws on invalid timezone or ambiguous DST gap
    return null;
  }
}

/**
 * Computes a UTC ISO 8601 timestamp that is `days`/`hours`/`minutes` from
 * now. At least one of the three must be non-zero and positive.
 *
 * Returns null when the total delta is zero, negative, or exceeds ~10 years.
 */
export function buildRelativeResetAt(
  days: number,
  hours: number,
  minutes: number,
): string | null {
  const d = Math.trunc(days);
  const h = Math.trunc(hours);
  const m = Math.trunc(minutes);
  if (d < 0 || h < 0 || m < 0) return null;

  const totalMinutes = d * 24 * 60 + h * 60 + m;
  if (totalMinutes <= 0 || totalMinutes > MAX_RELATIVE_MINUTES) return null;

  return new Date(Date.now() + totalMinutes * 60 * 1000).toISOString();
}

/**
 * Given an existing quota's UTC `resetAt` ISO string and its `timezone`,
 * returns the pre-populated CalendarDate and HH:MM time in local time.
 *
 * Used to initialize the DatePicker and time input when editing an
 * existing quota window.
 */
export function parseExistingResetAt(
  resetAt: string,
  timezone: string,
): { calDate: CalendarDate; time: string } {
  const zoned = fromDate(new Date(resetAt), timezone);
  const calDate = toCalendarDate(zoned);
  const time = `${String(zoned.hour).padStart(2, '0')}:${String(zoned.minute).padStart(2, '0')}`;
  return { calDate, time };
}
