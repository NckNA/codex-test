import { describe, expect, it } from 'vitest';
import { deriveAmoCrmActionRequired, mapAmoCrmHealth } from './AmoCrmHealth';

describe('AmoCrmHealth', () => {
  it('derives safe actions from stable statuses', () => {
    expect(deriveAmoCrmActionRequired('connected')).toBe('none');
    expect(deriveAmoCrmActionRequired('refresh_required')).toBe('reconnect');
    expect(deriveAmoCrmActionRequired('account_mismatch')).toBe('reconnect');
    expect(deriveAmoCrmActionRequired('degraded')).toBe('check_later');
    expect(deriveAmoCrmActionRequired('disconnected')).toBe('connect');
    expect(deriveAmoCrmActionRequired('authorization_pending')).toBe('complete_authorization');
  });

  it('maps only frontend-safe fields', () => {
    const health = mapAmoCrmHealth({
      integrationAccountId: 'integration-a',
      providerCode: 'amocrm',
      status: 'connected',
      connected: true,
      externalAccountId: '12345',
      externalAccountDomain: 'clinic.amocrm.ru',
      displayName: 'Clinic',
      credentialVersion: 3,
      accessToken: 'secret-access',
      refreshToken: 'secret-refresh',
      encryptedRefreshCredential: 'ciphertext',
      authorizationCode: 'secret-code',
      stateHash: 'secret-state-hash',
    });
    expect(health).toMatchObject({
      status: 'connected',
      externalAccountId: '12345',
      credentialVersion: 3,
      actionRequired: 'none',
    });
    expect(health).not.toHaveProperty('accessToken');
    expect(health).not.toHaveProperty('refreshToken');
    expect(health).not.toHaveProperty('encryptedRefreshCredential');
    expect(health).not.toHaveProperty('authorizationCode');
    expect(health).not.toHaveProperty('stateHash');
  });
});
