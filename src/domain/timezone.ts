export type TimezoneErrorCode =
  | 'invalid_timezone'
  | 'invalid_local_datetime'
  | 'invalid_instant'
  | 'nonexistent_local_time'
  | 'ambiguous_local_time'
  | 'missing_timezone';

export class TimezoneError extends Error {
  readonly code: TimezoneErrorCode;

  constructor(code: TimezoneErrorCode, message: string) {
    super(message);
    this.name = 'TimezoneError';
    this.code = code;
  }
}

export const TIMEZONE_ERROR_MESSAGES: Record<TimezoneErrorCode, string> = {
  invalid_timezone: 'Укажите корректный часовой пояс клиники.',
  invalid_local_datetime: 'Укажите корректные дату и время.',
  invalid_instant: 'Не удалось обработать время записи. Обновите страницу и попробуйте снова.',
  nonexistent_local_time: 'Выбранное местное время не существует из-за перехода часового пояса.',
  ambiguous_local_time: 'Выбранное местное время неоднозначно из-за перехода часового пояса.',
  missing_timezone: 'Не удалось определить часовой пояс клиники.',
};

interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const OFFSET_AWARE_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

const pad = (value: number) => String(value).padStart(2, '0');

export function isValidIanaTimezone(timezone: string | null | undefined): timezone is string {
  if (!timezone || timezone.trim() !== timezone || /^[+-]?\d{1,2}(?::?\d{2})?$/.test(timezone)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(0);
    return timezone.includes('/') || timezone === 'UTC';
  } catch {
    return false;
  }
}

export function requireIanaTimezone(timezone: string | null | undefined): string {
  if (!timezone) throw new TimezoneError('missing_timezone', TIMEZONE_ERROR_MESSAGES.missing_timezone);
  if (!isValidIanaTimezone(timezone)) {
    throw new TimezoneError('invalid_timezone', TIMEZONE_ERROR_MESSAGES.invalid_timezone);
  }
  return timezone;
}

function parseLocalDate(value: string): Pick<DateTimeParts, 'year' | 'month' | 'day'> {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) throw new TimezoneError('invalid_local_datetime', TIMEZONE_ERROR_MESSAGES.invalid_local_datetime);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const test = new Date(Date.UTC(year, month - 1, day));
  if (test.getUTCFullYear() !== year || test.getUTCMonth() !== month - 1 || test.getUTCDate() !== day) {
    throw new TimezoneError('invalid_local_datetime', TIMEZONE_ERROR_MESSAGES.invalid_local_datetime);
  }
  return { year, month, day };
}

function parseLocalDateTime(value: string): DateTimeParts {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) throw new TimezoneError('invalid_local_datetime', TIMEZONE_ERROR_MESSAGES.invalid_local_datetime);
  const parts: DateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? '0'),
  };
  if (parts.hour > 23 || parts.minute > 59 || parts.second > 59) {
    throw new TimezoneError('invalid_local_datetime', TIMEZONE_ERROR_MESSAGES.invalid_local_datetime);
  }
  const test = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  if (
    test.getUTCFullYear() !== parts.year
    || test.getUTCMonth() !== parts.month - 1
    || test.getUTCDate() !== parts.day
    || test.getUTCHours() !== parts.hour
    || test.getUTCMinutes() !== parts.minute
    || test.getUTCSeconds() !== parts.second
  ) {
    throw new TimezoneError('invalid_local_datetime', TIMEZONE_ERROR_MESSAGES.invalid_local_datetime);
  }
  return parts;
}

function toInstantDate(instant: string | Date): Date {
  if (instant instanceof Date) {
    if (Number.isNaN(instant.getTime())) throw new TimezoneError('invalid_instant', TIMEZONE_ERROR_MESSAGES.invalid_instant);
    return new Date(instant.getTime());
  }
  if (!OFFSET_AWARE_PATTERN.test(instant)) {
    throw new TimezoneError('invalid_instant', TIMEZONE_ERROR_MESSAGES.invalid_instant);
  }
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) throw new TimezoneError('invalid_instant', TIMEZONE_ERROR_MESSAGES.invalid_instant);
  return date;
}

function zonedParts(instant: Date, timezone: string): DateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(
    formatter.formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

const sameParts = (left: DateTimeParts, right: DateTimeParts) => (
  left.year === right.year
  && left.month === right.month
  && left.day === right.day
  && left.hour === right.hour
  && left.minute === right.minute
  && left.second === right.second
);

export function instantToTenantDate(instant: string | Date, timezone: string): string {
  const zone = requireIanaTimezone(timezone);
  const parts = zonedParts(toInstantDate(instant), zone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function instantToTenantDateTimeInput(instant: string | Date, timezone: string): string {
  const zone = requireIanaTimezone(timezone);
  const parts = zonedParts(toInstantDate(instant), zone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function tenantDateTimeToInstant(localDateTime: string, timezone: string): string {
  const zone = requireIanaTimezone(timezone);
  const wanted = parseLocalDateTime(localDateTime);
  const localAsUtc = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute, wanted.second);
  const offsets = new Set<number>();
  const sampleWindow = 36 * 60 * 60 * 1000;
  const sampleStep = 30 * 60 * 1000;

  for (let sample = localAsUtc - sampleWindow; sample <= localAsUtc + sampleWindow; sample += sampleStep) {
    const sampleDate = new Date(sample);
    const parts = zonedParts(sampleDate, zone);
    const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    offsets.add(representedAsUtc - sampleDate.getTime());
  }

  const candidates = [...offsets]
    .map((offset) => new Date(localAsUtc - offset))
    .filter((candidate) => sameParts(zonedParts(candidate, zone), wanted))
    .map((candidate) => candidate.getTime());
  const uniqueCandidates = [...new Set(candidates)].sort((a, b) => a - b);

  if (uniqueCandidates.length === 0) {
    throw new TimezoneError('nonexistent_local_time', TIMEZONE_ERROR_MESSAGES.nonexistent_local_time);
  }
  if (uniqueCandidates.length > 1) {
    throw new TimezoneError('ambiguous_local_time', TIMEZONE_ERROR_MESSAGES.ambiguous_local_time);
  }
  return new Date(uniqueCandidates[0]).toISOString();
}

export function addTenantCalendarDays(date: string, days: number): string {
  const parts = parseLocalDate(date);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function tenantDateStartInstant(date: string, timezone: string): string {
  parseLocalDate(date);
  return tenantDateTimeToInstant(`${date}T00:00`, timezone);
}

export function tenantDateEndExclusiveInstant(date: string, timezone: string): string {
  return tenantDateStartInstant(addTenantCalendarDays(date, 1), timezone);
}

export function tenantNowDate(timezone: string, now: string | Date = new Date()): string {
  return instantToTenantDate(now, timezone);
}

export function compareInstantToTenantDay(instant: string | Date, date: string, timezone: string): -1 | 0 | 1 {
  const instantMs = toInstantDate(instant).getTime();
  const startMs = new Date(tenantDateStartInstant(date, timezone)).getTime();
  const endMs = new Date(tenantDateEndExclusiveInstant(date, timezone)).getTime();
  if (instantMs < startMs) return -1;
  if (instantMs >= endMs) return 1;
  return 0;
}

export function formatInstantInTenant(
  instant: string | Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' },
  locale = 'ru-RU',
): string {
  const zone = requireIanaTimezone(timezone);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: zone }).format(toInstantDate(instant));
}

export function formatTenantDate(
  date: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'ru-RU',
): string {
  const parts = parseLocalDate(date);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
    .format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)));
}

export function isOffsetAwareInstant(value: string): boolean {
  if (!OFFSET_AWARE_PATTERN.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}