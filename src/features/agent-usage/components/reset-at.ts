import {
  CalendarDate,
  fromDate,
  toCalendarDate,
  toZoned,
} from '@internationalized/date';

const MAX_RELATIVE_MINUTES = 10 * 366 * 24 * 60; // ~10 years

/**
 * Parses a text date in MM/DD/YYYY format and converts it to a CalendarDate.
 * Returns null for invalid dates.
 */
export function parseTextDate(dateText: string): CalendarDate | null {
  const trimmed = dateText.trim();
  let year: number;
  let month: number;
  let day: number;

  const matchIso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (matchIso) {
    year = parseInt(matchIso[1], 10);
    month = parseInt(matchIso[2], 10);
    day = parseInt(matchIso[3], 10);
  } else {
    const matchSlash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (!matchSlash) return null;
    month = parseInt(matchSlash[1], 10);
    day = parseInt(matchSlash[2], 10);
    year = parseInt(matchSlash[3], 10);
  }

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;

  try {
    // Use the IANA calendar to validate the date (handles leap years, etc.)
    const calDate = new CalendarDate(year, month, day);
    if (
      calDate.day !== day ||
      calDate.month !== month ||
      calDate.year !== year
    ) {
      return null;
    }
    return calDate;
  } catch {
    return null;
  }
}

/**
 * Parses a time string in hh:mm AM/PM format and converts to HH:MM 24-hour format.
 * Returns null for invalid times.
 */
export function parseTextTime(timeText: string): string | null {
  const trimmed = timeText.trim().toUpperCase();
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/.exec(trimmed);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridiem = match[3] || 'AM'; // Default to AM if not specified

  if (hour < 0 || hour > 12) return null;
  if (minute < 0 || minute > 59) return null;

  // Convert to 24-hour format
  if (meridiem === 'PM' && hour !== 12) {
    hour += 12;
  } else if (meridiem === 'AM' && hour === 12) {
    hour = 0;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

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

/**
 * Formats a CalendarDate object into an MM/DD/YYYY text date string.
 */
export function formatCalendarDateToText(calDate: CalendarDate): string {
  const month = String(calDate.month).padStart(2, '0');
  const day = String(calDate.day).padStart(2, '0');
  const year = String(calDate.year).padStart(4, '0');
  return `${month}/${day}/${year}`;
}

/**
 * Formats a 24-hour time string (HH:MM) into a 12-hour hh:mm AM/PM text time string.
 */
export function format24HourTo12HourText(time24: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time24.trim());
  if (!match) return time24;
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  if (hour === 0) {
    hour = 12;
  } else if (hour > 12) {
    hour -= 12;
  }
  return `${String(hour).padStart(2, '0')}:${minute} ${meridiem}`;
}

/**
 * Formats an ISO resetAt timestamp string in the given timezone into a human-readable summary string.
 * Example output: "Aug 14, 2026 · 09:00 AM"
 */
export function formatResetSummary(resetAt: string, timezone: string): string {
  try {
    const date = new Date(resetAt);
    const dateStr = date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      timeZone: timezone,
      year: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      hour12: true,
      minute: '2-digit',
      timeZone: timezone,
    });
    return `${dateStr} · ${timeStr}`;
  } catch {
    return new Date(resetAt).toLocaleString();
  }
}
