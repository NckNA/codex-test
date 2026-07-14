import { describe, expect, it } from 'vitest';
import {
  canConsumeAmoCrmOAuthState,
  isAmoCrmOAuthStateCancelled,
  isAmoCrmOAuthStateConsumed,
  isAmoCrmOAuthStateExpired,
} from './AmoCrmOAuthState';

describe('AmoCrmOAuthState', () => {
  const now = new Date('2026-07-14T12:00:00Z');

  it('detects an expired state', () => {
    expect(isAmoCrmOAuthStateExpired({ expiresAt: '2026-07-14T11:59:59Z' }, now)).toBe(true);
    expect(canConsumeAmoCrmOAuthState({ expiresAt: '2026-07-14T11:59:59Z' }, now)).toBe(false);
  });

  it('detects consumed and cancelled terminal states', () => {
    const consumed = { expiresAt: '2026-07-14T12:05:00Z', consumedAt: '2026-07-14T12:00:01Z' };
    const cancelled = { expiresAt: '2026-07-14T12:05:00Z', cancelledAt: '2026-07-14T12:00:01Z' };
    expect(isAmoCrmOAuthStateConsumed(consumed)).toBe(true);
    expect(isAmoCrmOAuthStateCancelled(cancelled)).toBe(true);
    expect(canConsumeAmoCrmOAuthState(consumed, now)).toBe(false);
    expect(canConsumeAmoCrmOAuthState(cancelled, now)).toBe(false);
  });

  it('allows only a live unused state', () => {
    expect(canConsumeAmoCrmOAuthState({ expiresAt: '2026-07-14T12:10:00Z' }, now)).toBe(true);
  });
});
