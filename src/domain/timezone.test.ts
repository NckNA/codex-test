import { describe, expect, it } from 'vitest';
import {
  TimezoneError,
  addTenantCalendarDays,
  compareInstantToTenantDay,
  instantToTenantDate,
  instantToTenantDateTimeInput,
  isOffsetAwareInstant,
  isValidIanaTimezone,
  tenantDateEndExclusiveInstant,
  tenantDateStartInstant,
  tenantDateTimeToInstant,
  tenantNowDate,
} from './timezone';

const expectTimezoneError = (run: () => unknown, code: TimezoneError['code']) => {
  try {
    run();
    throw new Error('Expected timezone error');
  } catch (error) {
    expect(error).toBeInstanceOf(TimezoneError);
    expect((error as TimezoneError).code).toBe(code);
  }
};

describe('tenant timezone utility', () => {
  it('validates IANA zones and rejects numeric offsets', () => {
    expect(isValidIanaTimezone('Asia/Almaty')).toBe(true);
    expect(isValidIanaTimezone('Europe/Berlin')).toBe(true);
    expect(isValidIanaTimezone('America/New_York')).toBe(true);
    expect(isValidIanaTimezone('+05:00')).toBe(false);
    expect(isValidIanaTimezone('UTC+5')).toBe(false);
    expect(isValidIanaTimezone('Not/AZone')).toBe(false);
  });

  it('maps a UTC instant to Asia/Almaty local date and time', () => {
    expect(instantToTenantDateTimeInput('2026-07-12T04:00:00.000Z', 'Asia/Almaty')).toBe('2026-07-12T09:00');
    expect(instantToTenantDate('2026-07-11T21:30:00.000Z', 'Asia/Almaty')).toBe('2026-07-12');
  });

  it('converts Asia/Almaty wall time to the correct instant and round trips', () => {
    const instant = tenantDateTimeToInstant('2026-07-12T09:00', 'Asia/Almaty');
    expect(instant).toBe('2026-07-12T04:00:00.000Z');
    expect(instantToTenantDateTimeInput(instant, 'Asia/Almaty')).toBe('2026-07-12T09:00');
  });

  it('preserves an instant through local conversion', () => {
    const original = '2026-01-15T12:34:00.000Z';
    const local = instantToTenantDateTimeInput(original, 'Europe/Berlin');
    expect(tenantDateTimeToInstant(local, 'Europe/Berlin')).toBe(original);
  });

  it('uses Berlin winter and summer offsets', () => {
    expect(tenantDateTimeToInstant('2026-01-15T09:00', 'Europe/Berlin')).toBe('2026-01-15T08:00:00.000Z');
    expect(tenantDateTimeToInstant('2026-07-15T09:00', 'Europe/Berlin')).toBe('2026-07-15T07:00:00.000Z');
  });

  it('uses New York winter and summer offsets', () => {
    expect(tenantDateTimeToInstant('2026-01-15T09:00', 'America/New_York')).toBe('2026-01-15T14:00:00.000Z');
    expect(tenantDateTimeToInstant('2026-07-15T09:00', 'America/New_York')).toBe('2026-07-15T13:00:00.000Z');
  });

  it('rejects nonexistent DST wall time', () => {
    expectTimezoneError(
      () => tenantDateTimeToInstant('2026-03-29T02:30', 'Europe/Berlin'),
      'nonexistent_local_time',
    );
  });

  it('rejects ambiguous DST wall time deterministically', () => {
    expectTimezoneError(
      () => tenantDateTimeToInstant('2026-10-25T02:30', 'Europe/Berlin'),
      'ambiguous_local_time',
    );
  });

  it('rejects invalid timezone, local date and offset-free instant', () => {
    expectTimezoneError(() => tenantDateTimeToInstant('2026-07-12T09:00', 'UTC+5'), 'invalid_timezone');
    expectTimezoneError(() => tenantDateTimeToInstant('2026-02-30T09:00', 'Asia/Almaty'), 'invalid_local_datetime');
    expectTimezoneError(() => instantToTenantDate('2026-07-12T09:00', 'Asia/Almaty'), 'invalid_instant');
  });

  it('supports leap day and calendar arithmetic', () => {
    expect(tenantDateTimeToInstant('2028-02-29T09:00', 'Asia/Almaty')).toBe('2028-02-29T04:00:00.000Z');
    expect(addTenantCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addTenantCalendarDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('uses half-open tenant day boundaries', () => {
    expect(tenantDateStartInstant('2026-07-12', 'Asia/Almaty')).toBe('2026-07-11T19:00:00.000Z');
    expect(tenantDateEndExclusiveInstant('2026-07-12', 'Asia/Almaty')).toBe('2026-07-12T19:00:00.000Z');
    expect(compareInstantToTenantDay('2026-07-11T19:00:00.000Z', '2026-07-12', 'Asia/Almaty')).toBe(0);
    expect(compareInstantToTenantDay('2026-07-12T18:59:59.999Z', '2026-07-12', 'Asia/Almaty')).toBe(0);
    expect(compareInstantToTenantDay('2026-07-12T19:00:00.000Z', '2026-07-12', 'Asia/Almaty')).toBe(1);
  });

  it('injects now deterministically', () => {
    expect(tenantNowDate('Asia/Almaty', '2026-07-11T21:30:00.000Z')).toBe('2026-07-12');
    expect(tenantNowDate('Europe/Berlin', '2026-07-11T21:30:00.000Z')).toBe('2026-07-11');
  });

  it('does not depend on the browser timezone for conversion results', () => {
    const instant = tenantDateTimeToInstant('2026-07-12T09:00', 'Asia/Almaty');
    expect(instant).toBe('2026-07-12T04:00:00.000Z');
    expect(instantToTenantDateTimeInput(instant, 'Europe/Berlin')).toBe('2026-07-12T06:00');
  });

  it('recognizes only offset-aware instants', () => {
    expect(isOffsetAwareInstant('2026-07-12T04:00:00Z')).toBe(true);
    expect(isOffsetAwareInstant('2026-07-12T09:00:00+05:00')).toBe(true);
    expect(isOffsetAwareInstant('2026-07-12T09:00:00')).toBe(false);
  });
});