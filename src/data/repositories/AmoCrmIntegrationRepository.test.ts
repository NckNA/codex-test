import { describe, expect, it, vi } from 'vitest';
import { AmoCrmIntegrationRepository } from './AmoCrmIntegrationRepository';

const tenantId = '11111111-1111-4111-8111-111111111111';

function response(payload: unknown, ok = true, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

describe('AmoCrmIntegrationRepository', () => {
  it('sends authenticated tenant-scoped status request and maps only safe health', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({
      status: 'connected',
      connected: true,
      externalAccountId: '12345',
      externalAccountDomain: 'clinic.amocrm.ru',
      accessToken: 'must-not-map',
      refreshToken: 'must-not-map',
    }));
    const repository = new AmoCrmIntegrationRepository(tenantId, {
      baseUrl: 'http://localhost:4000',
      fetchImpl,
      tokenProvider: vi.fn().mockResolvedValue('session-token'),
    });

    const health = await repository.getAmoCrmIntegrationHealth();
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:4000/api/integrations/amocrm/status',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token',
          'X-Tenant-Id': tenantId,
        }),
      }),
    );
    expect(health).toMatchObject({ status: 'connected', externalAccountId: '12345' });
    expect(health).not.toHaveProperty('accessToken');
    expect(health).not.toHaveProperty('refreshToken');
  });

  it('binds the native browser fetch function to globalThis', async () => {
    const originalFetch = globalThis.fetch;
    const boundFetch = vi.fn(function (this: unknown) {
      expect(this).toBe(globalThis);
      return Promise.resolve(response({ status: 'disconnected', connected: false }));
    });
    globalThis.fetch = boundFetch as typeof fetch;
    try {
      const repository = new AmoCrmIntegrationRepository(tenantId, {
        tokenProvider: vi.fn().mockResolvedValue('session-token'),
      });
      await repository.getAmoCrmIntegrationHealth();
      expect(boundFetch).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it('starts, reconnects, refreshes and disconnects through backend only', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({
        authorizationUrl: 'https://www.amocrm.ru/oauth?client_id=x&state=opaque',
        expiresAt: '2026-07-14T12:10:00Z',
        integrationAccountId: 'integration-a',
        status: 'authorization_pending',
      }))
      .mockResolvedValueOnce(response({
        authorizationUrl: 'https://www.amocrm.ru/oauth?client_id=x&state=opaque-2',
        expiresAt: '2026-07-14T12:10:00Z',
        integrationAccountId: 'integration-a',
        status: 'connected',
      }))
      .mockResolvedValueOnce(response({ status: 'connected', connected: true }))
      .mockResolvedValueOnce(response({ status: 'disconnected', connected: false }));
    const repository = new AmoCrmIntegrationRepository(tenantId, {
      fetchImpl,
      tokenProvider: vi.fn().mockResolvedValue('session-token'),
    });

    expect((await repository.startAmoCrmConnection()).authorizationUrl).toContain('/oauth?');
    expect((await repository.reconnectAmoCrmConnection()).authorizationUrl).toContain('opaque-2');
    expect((await repository.requestAmoCrmHealthRefresh()).status).toBe('connected');
    expect((await repository.disconnectAmoCrmConnection()).status).toBe('disconnected');

    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      'http://localhost:4000/api/integrations/amocrm/connect',
      'http://localhost:4000/api/integrations/amocrm/reconnect',
      'http://localhost:4000/api/integrations/amocrm/refresh',
      'http://localhost:4000/api/integrations/amocrm/disconnect',
    ]);
  });

  it('maps raw backend errors without exposing SQL or secret details', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({
      errorCode: 'permission',
      sqlstate: '42501',
      constraint: 'integration_credentials_secret_idx',
      token: 'secret',
    }, false, 403));
    const repository = new AmoCrmIntegrationRepository(tenantId, {
      fetchImpl,
      tokenProvider: vi.fn().mockResolvedValue('session-token'),
    });
    await expect(repository.getAmoCrmIntegrationHealth()).rejects.toMatchObject({
      code: 'permission',
    });
    await repository.getAmoCrmIntegrationHealth().catch((error: Error) => {
      expect(error.message).not.toMatch(/SQLSTATE|constraint|token|secret/i);
    });
  });

  it('does not use localStorage or call amoCRM directly', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ status: 'disconnected', connected: false }));
    const repository = new AmoCrmIntegrationRepository(tenantId, {
      fetchImpl,
      tokenProvider: vi.fn().mockResolvedValue('session-token'),
    });
    await repository.getAmoCrmIntegrationHealth();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const target = String(fetchImpl.mock.calls[0][0]);
    expect(target).toMatch(/^http:\/\/localhost:4000\/api\/integrations\/amocrm/);
    expect(target).not.toMatch(/amocrm\.ru|kommo\.com/);
    expect(AmoCrmIntegrationRepository.toString()).not.toContain('localStorage');
  });

  it('supports tenant-scoped external references without sync payloads', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ items: [{
        id: 'ref-a', entity_type: 'contact', internal_entity_id: 'internal-a', external_entity_id: 'external-a', version: 1,
      }] }))
      .mockResolvedValueOnce(response({
        id: 'ref-b', entityType: 'lead', internalEntityId: 'internal-b', externalEntityId: 'external-b', version: 1,
      }))
      .mockResolvedValueOnce(response({ id: 'ref-b', archived: true, version: 2 }));
    const repository = new AmoCrmIntegrationRepository(tenantId, {
      fetchImpl,
      tokenProvider: vi.fn().mockResolvedValue('session-token'),
    });

    expect(await repository.listExternalReferences('contact')).toHaveLength(1);
    expect((await repository.createExternalReference({
      entityType: 'lead',
      internalEntityId: 'internal-b',
      externalEntityId: 'external-b',
    })).externalEntityId).toBe('external-b');
    expect(await repository.archiveExternalReference('ref-b')).toMatchObject({ archived: true, version: 2 });
  });
});
