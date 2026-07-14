import { describe, expect, it } from 'vitest';
import {
  AmoCrmIntegrationError,
  detectAmoCrmAccountMismatch,
  normalizeAmoCrmDomain,
  sameAmoCrmAccount,
  toSafeAmoCrmError,
} from './AmoCrmIntegration';

const actual = {
  externalAccountId: '12345',
  domain: 'clinic.amocrm.ru',
  displayName: 'Clinic',
};

describe('AmoCrmIntegration domain', () => {
  it('normalizes equivalent amoCRM domains deterministically', () => {
    expect(normalizeAmoCrmDomain(' HTTPS://Clinic.AMOCRM.RU/path ')).toBe('clinic.amocrm.ru');
    expect(normalizeAmoCrmDomain('clinic')).toBe('clinic.amocrm.ru');
    expect(normalizeAmoCrmDomain('clinic', 'tenant.kommo.com')).toBe('clinic.kommo.com');
  });

  it('rejects domains outside supported amoCRM platforms', () => {
    expect(() => normalizeAmoCrmDomain('evil.example.com')).toThrowError(
      expect.objectContaining({ code: 'account_mismatch' }),
    );
  });

  it('compares authoritative account ID and normalized domain', () => {
    expect(sameAmoCrmAccount(actual, {
      externalAccountId: '12345',
      domain: 'https://CLINIC.amocrm.ru/',
    })).toBe(true);
    expect(sameAmoCrmAccount(actual, {
      externalAccountId: '54321',
      domain: 'clinic.amocrm.ru',
    })).toBe(false);
  });

  it('detects expected ID and domain mismatch', () => {
    expect(detectAmoCrmAccountMismatch({ externalAccountId: '999' }, actual)).toBe(true);
    expect(detectAmoCrmAccountMismatch({ domain: 'other.amocrm.ru' }, actual)).toBe(true);
    expect(detectAmoCrmAccountMismatch({
      externalAccountId: '12345',
      domain: 'clinic.amocrm.ru',
    }, actual)).toBe(false);
  });

  it('maps raw failures to a bounded safe error', () => {
    expect(toSafeAmoCrmError({
      code: '23505',
      details: 'access_token=secret refresh_token=secret',
    })).toEqual(expect.objectContaining({ code: 'generic' }));
    expect(toSafeAmoCrmError({ errorCode: 'permission' })).toEqual(
      expect.objectContaining({ code: 'permission' }),
    );
  });

  it('public error messages never echo supplied secrets', () => {
    const error = new AmoCrmIntegrationError('generic');
    expect(error.message).not.toMatch(/access_token|refresh_token|client_secret|authorization code/i);
  });
});
