import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { CredentialVault } = require('./credentialVault');
const {
  AmoCrmProviderClient,
  normalizeAmoCrmDomain,
} = require('./amoCrmProviderClient');
const { createAmoCrmMockFetch } = require('./amoCrmMockTransport');
const { tenantIdHeader, bearerToken } = require('./requestContext');
const {
  AmoCrmIntegrationService,
  sha256,
  toSafeServiceError,
} = require('./amoCrmIntegrationService');

const key = Buffer.alloc(32, 7).toString('base64');
const config = {
  frontendUrl: 'http://localhost:5173',
  amoCrmClientId: 'client-id',
  amoCrmClientSecret: 'server-secret',
  amoCrmRedirectUri: 'http://localhost:4000/api/integrations/amocrm/callback',
  amoCrmAuthorizeUrl: 'https://www.amocrm.ru/oauth',
  amoCrmProviderBaseUrl: 'http://127.0.0.1:49001',
  amoCrmAllowedAccountDomain: '',
  credentialEncryptionKey: key,
  credentialEncryptionKeyVersion: 1,
  requestTimeoutMs: 5000,
  oauthStateTtlSeconds: 600,
};

function makeVault() {
  return new CredentialVault({
    key,
    keyVersion: 1,
    randomBytes: () => Buffer.alloc(12, 3),
  });
}

describe('requestContext', () => {
  it('accepts canonical project tenant UUIDs without imposing RFC variant bits', () => {
    const req = { headers: { 'x-tenant-id': '11111111-1111-1111-1111-111111111111' } };
    expect(tenantIdHeader(req)).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('rejects malformed tenant headers and extracts bearer tokens', () => {
    expect(tenantIdHeader({ headers: { 'x-tenant-id': 'tenant-a' } })).toBe('');
    expect(bearerToken({ headers: { authorization: 'Bearer session-token' } })).toBe('session-token');
    expect(bearerToken({ headers: {} })).toBe('');
  });
});
describe('CredentialVault', () => {
  it('encrypts credentials with AES-256-GCM without plaintext in the envelope', () => {
    const vault = makeVault();
    const encrypted = vault.encrypt('refresh-secret-value');
    expect(encrypted.toString('utf8')).not.toContain('refresh-secret-value');
    expect(vault.decrypt(encrypted)).toBe('refresh-secret-value');
    expect(vault.toBytea(encrypted)).toMatch(/^\\x[0-9a-f]+$/);
  });

  it('rejects wrong key material instead of inventing weak storage', () => {
    expect(() => new CredentialVault({ key: 'not-a-key', keyVersion: 1 })).toThrowError(
      expect.objectContaining({ code: 'configuration_error' }),
    );
  });
});

describe('AmoCrmProviderClient', () => {
  it('builds official authorization URL with opaque state', () => {
    const client = new AmoCrmProviderClient({ config, fetchImpl: vi.fn() });
    const url = new URL(client.buildAuthorizationUrl('opaque-state'));
    expect(url.origin + url.pathname).toBe('https://www.amocrm.ru/oauth');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('state')).toBe('opaque-state');
    expect(url.searchParams.get('mode')).toBe('popup');
  });

  it('exchanges code, verifies authoritative account and rotates refresh credentials', async () => {
    const mock = createAmoCrmMockFetch();
    const client = new AmoCrmProviderClient({ config, fetchImpl: mock.fetchImpl, now: () => 0 });
    const tokens = await client.exchangeAuthorizationCode({ code: 'valid-code', referer: 'clinic-test.amocrm.ru' });
    const account = await client.getAccountInfo({ accessToken: tokens.accessToken, accountDomain: tokens.accountDomain });
    const refreshed = await client.refreshCredentials({ refreshToken: tokens.refreshToken, accountDomain: tokens.accountDomain });

    expect(account).toMatchObject({ externalAccountId: '123456', domain: 'clinic-test.amocrm.ru' });
    expect(refreshed.refreshToken).toBe('refresh-2');
    expect(mock.state.tokenExchanges).toBe(1);
    expect(mock.state.refreshCalls).toBe(1);
    expect(mock.state.accountCalls).toBe(1);
  });

  it('maps reused refresh credential to invalid_grant', async () => {
    const mock = createAmoCrmMockFetch();
    const client = new AmoCrmProviderClient({ config, fetchImpl: mock.fetchImpl });
    await client.refreshCredentials({ refreshToken: 'refresh-1', accountDomain: 'clinic-test.amocrm.ru' });
    await expect(client.refreshCredentials({
      refreshToken: 'refresh-1',
      accountDomain: 'clinic-test.amocrm.ru',
    })).rejects.toMatchObject({ code: 'invalid_grant', terminal: true });
  });

  it.each([
    ['timeout_before_response', 'network_timeout_before_response'],
    ['timeout_after_possible_acceptance', 'network_timeout_after_possible_acceptance'],
    ['rate_limit', 'temporary_provider_error'],
    ['temporary_server_error', 'temporary_provider_error'],
  ])('maps %s to safe provider error %s', async (mode, code) => {
    const mock = createAmoCrmMockFetch({ mode });
    const client = new AmoCrmProviderClient({ config, fetchImpl: mock.fetchImpl });
    await expect(client.exchangeAuthorizationCode({
      code: 'code',
      referer: 'clinic-test.amocrm.ru',
    })).rejects.toMatchObject({ code });
  });

  it('normalizes only known amoCRM account platforms', () => {
    expect(normalizeAmoCrmDomain('HTTPS://Clinic.AMOCRM.RU/path')).toBe('clinic.amocrm.ru');
    expect(() => normalizeAmoCrmDomain('attacker.example')).toThrowError(
      expect.objectContaining({ code: 'account_mismatch' }),
    );
  });
});

describe('AmoCrmIntegrationService', () => {
  it('persists only a state hash bound to tenant and actor', async () => {
    const rpc = vi.fn(async (name, args) => {
      expect(name).toBe('amocrm_start_connection_server');
      expect(args.p_tenant_id).toBe('tenant-a');
      expect(args.p_actor_id).toBe('user-a');
      expect(args.p_state_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(args)).not.toContain('raw-state-value');
      return { integrationAccountId: 'integration-a', status: 'authorization_pending' };
    });
    const service = new AmoCrmIntegrationService({
      gateway: { rpc },
      providerClient: new AmoCrmProviderClient({ config, fetchImpl: vi.fn() }),
      vault: makeVault(),
      config,
      randomBytes: () => Buffer.from('raw-state-value'.padEnd(32, 'x')),
    });

    const result = await service.startConnection({ tenantId: 'tenant-a', actorId: 'user-a' });
    const state = new URL(result.authorizationUrl).searchParams.get('state');
    expect(state).toBeTruthy();
    expect(rpc.mock.calls[0][1].p_state_hash).toBe(sha256(state));
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('claims callback once, exchanges server-side, verifies account and stores ciphertext', async () => {
    const mock = createAmoCrmMockFetch();
    const providerClient = new AmoCrmProviderClient({ config, fetchImpl: mock.fetchImpl });
    const calls = [];
    let consumed = false;
    const gateway = {
      rpc: vi.fn(async (name, args) => {
        calls.push({ name, args });
        if (name === 'amocrm_claim_callback_state_server') {
          if (consumed) throw Object.assign(new Error('AMOCRM_STATE_CONSUMED'), { code: 'AMOCRM_STATE_CONSUMED' });
          return {
            tenantId: 'tenant-a',
            integrationAccountId: 'integration-a',
            initiatedBy: 'user-a',
            redirectUriFingerprint: sha256(config.amoCrmRedirectUri),
            credentialVersion: 0,
          };
        }
        if (name === 'amocrm_complete_callback_server') {
          consumed = true;
          expect(args.p_encrypted_access_credential).toMatch(/^\\x/);
          expect(args.p_encrypted_refresh_credential).toMatch(/^\\x/);
          expect(JSON.stringify(args)).not.toContain('access-1');
          expect(JSON.stringify(args)).not.toContain('refresh-1');
          return {
            ok: true,
            integrationAccountId: 'integration-a',
            credentialVersion: 1,
          };
        }
        if (name === 'amocrm_fail_callback_server') return { ok: true };
        throw new Error(`unexpected rpc ${name}`);
      }),
    };
    const service = new AmoCrmIntegrationService({
      gateway,
      providerClient,
      vault: makeVault(),
      config,
      randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });

    const result = await service.completeCallback({
      code: 'authorization-code-secret',
      state: 'raw-state-secret',
      referer: 'clinic-test.amocrm.ru',
    });
    expect(result).toMatchObject({ ok: true, status: 'connected' });
    expect(mock.state.tokenExchanges).toBe(1);
    expect(calls.some(({ args }) => JSON.stringify(args).includes('authorization-code-secret'))).toBe(false);

    await expect(service.completeCallback({
      code: 'authorization-code-secret',
      state: 'raw-state-secret',
      referer: 'clinic-test.amocrm.ru',
    })).rejects.toMatchObject({ code: 'consumed_state' });
    expect(mock.state.tokenExchanges).toBe(1);
  });

  it('serializes parallel refresh so only one provider rotation occurs', async () => {
    const vault = makeVault();
    const encrypted = vault.encrypt('refresh-1').toString('hex');
    const mock = createAmoCrmMockFetch();
    const providerClient = new AmoCrmProviderClient({ config, fetchImpl: mock.fetchImpl });
    let leaseTaken = false;
    let version = 1;
    const gateway = {
      rpc: vi.fn(async (name, args) => {
        if (name === 'amocrm_acquire_refresh_server') {
          if (leaseTaken) return { status: 'in_progress', credentialVersion: version };
          leaseTaken = true;
          return {
            status: 'acquired',
            integrationAccountId: 'integration-a',
            externalAccountId: '123456',
            externalAccountDomain: 'clinic-test.amocrm.ru',
            credentialVersion: version,
            encryptedRefreshCredential: encrypted,
          };
        }
        if (name === 'amocrm_commit_refresh_server') {
          expect(args.p_expected_credential_version).toBe(1);
          version += 1;
          leaseTaken = false;
          return { status: 'refreshed', credentialVersion: version };
        }
        if (name === 'amocrm_get_health_server') {
          return {
            status: 'connected',
            connected: true,
            credentialVersion: version,
            actionRequired: 'none',
            canReconnect: true,
            canDisconnect: true,
            canManage: true,
          };
        }
        if (name === 'amocrm_fail_refresh_server') return { status: 'degraded' };
        throw new Error(`unexpected rpc ${name}`);
      }),
    };
    const service = new AmoCrmIntegrationService({
      gateway,
      providerClient,
      vault,
      config,
      randomUUID: vi.fn()
        .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
        .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    });

    const [winner, loser] = await Promise.all([
      service.refreshCredentials({ tenantId: 'tenant-a', actorId: 'user-a' }),
      service.refreshCredentials({ tenantId: 'tenant-a', actorId: 'user-a' }),
    ]);
    expect(winner.credentialVersion).toBe(2);
    expect(loser.credentialVersion).toBeGreaterThanOrEqual(1);
    expect(mock.state.refreshCalls).toBe(1);
    expect(version).toBe(2);
  });

  it('maps arbitrary server failures to bounded safe messages', () => {
    const safe = toSafeServiceError(new Error('SQLSTATE 23505 access_token=secret'));
    expect(safe.code).toBe('generic');
    expect(safe.message).not.toMatch(/SQLSTATE|access_token|secret/i);
  });
});
