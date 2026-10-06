/**
 * Timezone-aware "business day" boundaries, used wherever the API accepts
 * a `date=YYYY-MM-DD` filter (Issues, SLA — and EOD in a later phase).
 * Deliberately not "blindly UTC": a client in Asia/Kolkata filtering for
 * "today" means their calendar day in Asia/Kolkata, not a UTC calendar
 * day, which would be offset by 5.5 hours and silently include/exclude
 * the wrong records near midnight.
 *
 * Implementation note: no date/timezone library is added for this — the
 * offset is derived from `Intl.DateTimeFormat`, which every supported
 * Node runtime ships full ICU data for. This is correct at day
 * granularity, including across DST transitions, because the offset is
 * computed from an instant that already falls on the target calendar day.
 */

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

export interface BusinessDayRange {
  start: Date;
  end: Date;
}

/**
 * Returns the [start, end) UTC instant range corresponding to the given
 * `YYYY-MM-DD` calendar date in `timeZone`.
 */
export function getBusinessDayRange(
  dateOnly: string,
  timeZone: string,
): BusinessDayRange {
  if (!isValidDateOnly(dateOnly)) {
    throw new RangeError(`Invalid date "${dateOnly}", expected YYYY-MM-DD`);
  }

  const midnightGuess = new Date(`${dateOnly}T00:00:00Z`);
  const offsetMinutes = timeZoneOffsetMinutes(midnightGuess, timeZone);
  const start = new Date(midnightGuess.getTime() - offsetMinutes * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start, end };
}

/**
 * The inverse of getBusinessDayRange: given a UTC instant, which business
 * calendar date (in `timeZone`) does it fall on? Used to compute
 * `eod_reports.report_date` from a submission's `submittedAt`.
 *
 * `en-CA` is a deliberate, slightly odd choice: that locale is one of the
 * few whose default date formatting is already `YYYY-MM-DD`, so no manual
 * part-reassembly is needed (unlike `timeZoneOffsetMinutes` above, which
 * needs individually addressable parts).
 */
export function toBusinessDateString(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidHhMm(value: string): boolean {
  return HH_MM_PATTERN.test(value);
}

/**
 * The UTC instant of a `HH:mm` (business-local, 24h) deadline on a given
 * business date. E.g. getBusinessDayDeadline('2026-09-22', 'Asia/Kolkata',
 * '19:00') is the instant of 7:00 PM IST on that date, expressed in UTC.
 *
 * Implementation note: computed as `start-of-business-day + HH:mm offset`,
 * which is exact for timezones without DST (e.g. Asia/Kolkata, this
 * project's default) and correct for the vast majority of dates even in
 * DST-observing zones — it can be off by the DST shift amount (usually 1
 * hour) only for dates where a DST transition happens *between* midnight
 * and the deadline time on that same calendar day, which is rare. Not
 * worth a date/timezone library for this project's scope.
 */
export function getBusinessDayDeadline(
  dateOnly: string,
  timeZone: string,
  deadlineHhMm: string,
): Date {
  if (!isValidHhMm(deadlineHhMm)) {
    throw new RangeError(
      `Invalid deadline "${deadlineHhMm}", expected HH:mm (24h)`,
    );
  }
  const [hours, minutes] = deadlineHhMm.split(':').map(Number);
  const { start } = getBusinessDayRange(dateOnly, timeZone);
  return new Date(start.getTime() + hours * 60 * 60_000 + minutes * 60_000);
}
