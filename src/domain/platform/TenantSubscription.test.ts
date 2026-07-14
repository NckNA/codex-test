import { describe, expect, it } from 'vitest';
import { isSubscriptionShortening, mapTenantSubscription, validateSubscriptionChange, validateSubscriptionDates } from './TenantSubscription';

describe('TenantSubscription', () => {
  it('validates required date ordering and grace', () => {
    expect(validateSubscriptionDates(undefined, undefined).error).toBe('start_required');
    expect(validateSubscriptionDates('2026-01-01', undefined).error).toBe('expiry_required');
    expect(validateSubscriptionDates('2026-02-01', '2026-01-01').error).toBe('expiry_before_start');
    expect(validateSubscriptionDates('2026-01-01', '2026-02-01', '2026-01-15').error).toBe('grace_before_expiry');
    expect(validateSubscriptionDates('2026-01-01', '2026-02-01', '2026-02-10').valid).toBe(true);
  });

  it('requires explicit confirmation for shortening', () => {
    expect(isSubscriptionShortening('2026-12-01', '2026-11-01')).toBe(true);
    expect(validateSubscriptionChange('2026-12-01', '2026-11-01', false).error).toBe('shortening_confirmation_required');
    expect(validateSubscriptionChange('2026-12-01', '2026-11-01', true).valid).toBe(true);
  });

  it('maps safe history record', () => {
    expect(mapTenantSubscription({ id: 'p1', starts_at: '2026-01-01', expires_at: '2026-02-01', status: 'active' })).toEqual({
      id: 'p1', tenantId: undefined, startsAt: '2026-01-01', expiresAt: '2026-02-01', graceExpiresAt: undefined,
      status: 'active', reasonCode: undefined, previousPeriodId: undefined, createdBy: undefined, createdAt: undefined, supersededAt: undefined,
    });
    expect(() => mapTenantSubscription({ status: 'paid' })).toThrow();
  });
});
