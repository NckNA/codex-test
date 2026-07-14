import { describe, expect, it } from 'vitest';
import { deriveTenantOperationalAccess, lifecycleBlockedMessage, parseTenantLifecycleStatus, validateLifecycleTransition } from './TenantLifecycle';

const base = { storedStatus: 'active' as const, subscriptionStartedAt: '2026-01-01T00:00:00Z', subscriptionExpiresAt: '2026-12-31T00:00:00Z' };

describe('TenantLifecycle', () => {
  it('parses stable statuses', () => {
    expect(parseTenantLifecycleStatus('active')).toBe('active');
    expect(() => parseTenantLifecycleStatus('deleted')).toThrow();
  });

  it('derives active, future, grace and expired access', () => {
    expect(deriveTenantOperationalAccess(base, new Date('2026-06-01T00:00:00Z')).allowed).toBe(true);
    expect(deriveTenantOperationalAccess({ ...base, subscriptionStartedAt: '2026-08-01T00:00:00Z' }, new Date('2026-06-01T00:00:00Z')).reasonCode).toBe('subscription_not_started');
    expect(deriveTenantOperationalAccess({ ...base, subscriptionExpiresAt: '2026-05-01T00:00:00Z', graceExpiresAt: '2026-07-01T00:00:00Z' }, new Date('2026-06-01T00:00:00Z')).allowed).toBe(true);
    expect(deriveTenantOperationalAccess({ ...base, subscriptionExpiresAt: '2026-05-01T00:00:00Z', graceExpiresAt: '2026-05-15T00:00:00Z' }, new Date('2026-06-01T00:00:00Z')).effectiveStatus).toBe('expired');
  });

  it('handles temporary and indefinite suspension', () => {
    expect(deriveTenantOperationalAccess({ ...base, storedStatus: 'suspended', suspendedUntil: '2026-08-01T00:00:00Z' }, new Date('2026-06-01T00:00:00Z')).effectiveStatus).toBe('suspended');
    expect(deriveTenantOperationalAccess({ ...base, storedStatus: 'suspended', suspendedUntil: '2026-05-01T00:00:00Z' }, new Date('2026-06-01T00:00:00Z')).effectiveStatus).toBe('active');
    expect(deriveTenantOperationalAccess({ ...base, storedStatus: 'suspended' }, new Date('2026-06-01T00:00:00Z')).allowed).toBe(false);
  });

  it('keeps archive terminal and maps safe messages', () => {
    expect(validateLifecycleTransition('archived', 'active')).toBe(false);
    expect(validateLifecycleTransition('suspended', 'active')).toBe(true);
    expect(deriveTenantOperationalAccess({ ...base, storedStatus: 'archived', archivedAt: '2026-05-01T00:00:00Z' }).reasonCode).toBe('tenant_archived');
    expect(lifecycleBlockedMessage('archived')).toContain('архивирована');
  });
});
