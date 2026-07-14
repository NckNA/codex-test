/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTenant } from '../../contexts/TenantContext';
import type { AmoCrmConnectionStartResult, AmoCrmIntegrationRepositoryContract } from '../repositories/AmoCrmIntegrationRepository';
import { useAmoCrmIntegration } from './useAmoCrmIntegration';

vi.mock('../../contexts/TenantContext', () => ({ useTenant: vi.fn() }));

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

const health = (tenant: string, status = 'connected') => ({
  integrationAccountId: `integration-${tenant}`,
  providerCode: 'amocrm' as const,
  status: status as 'connected',
  connected: status === 'connected',
  externalAccountId: tenant,
  externalAccountDomain: `${tenant.slice(0, 8)}.amocrm.ru`,
  actionRequired: status === 'connected' ? 'none' as const : 'connect' as const,
  canReconnect: true,
  canDisconnect: true,
  canManage: true,
});

function makeRepository(overrides: Partial<AmoCrmIntegrationRepositoryContract> = {}): AmoCrmIntegrationRepositoryContract {
  return {
    getAmoCrmIntegrationHealth: vi.fn().mockResolvedValue(health(tenantA)),
    startAmoCrmConnection: vi.fn().mockResolvedValue({
      authorizationUrl: 'https://www.amocrm.ru/oauth?state=opaque',
      expiresAt: '2026-07-14T12:10:00Z',
      integrationAccountId: 'integration-a',
      status: 'authorization_pending',
    }),
    disconnectAmoCrmConnection: vi.fn().mockResolvedValue(health(tenantA, 'disconnected')),
    reconnectAmoCrmConnection: vi.fn().mockResolvedValue({
      authorizationUrl: 'https://www.amocrm.ru/oauth?state=opaque-2',
      expiresAt: '2026-07-14T12:10:00Z',
      integrationAccountId: 'integration-a',
      status: 'authorization_pending',
    }),
    requestAmoCrmHealthRefresh: vi.fn().mockResolvedValue(health(tenantA)),
    listExternalReferences: vi.fn().mockResolvedValue([]),
    createExternalReference: vi.fn(),
    archiveExternalReference: vi.fn(),
    ...overrides,
  };
}

describe('useAmoCrmIntegration', () => {
  let tenantState: any;
  let current: ReturnType<typeof useAmoCrmIntegration> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    tenantState = {
      activeTenant: {
        tenantId: tenantA,
        role: 'clinic_admin',
        tenantName: 'Clinic A',
        timezone: 'Asia/Almaty',
      },
    };
    vi.mocked(useTenant).mockImplementation(() => tenantState);
  });

  const mount = async (
    repositoryFactory: (tenantId: string) => AmoCrmIntegrationRepositoryContract,
    callbackSearch = '',
  ) => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const openAuthorizationWindow = vi.fn();
    const Harness = ({ tick = 0, search = callbackSearch }: { tick?: number; search?: string }) => {
      void tick;
      current = useAmoCrmIntegration({ repositoryFactory, openAuthorizationWindow, callbackSearch: search });
      return null;
    };
    await act(async () => { root.render(<Harness />); });
    return { root, Harness, openAuthorizationWindow };
  };

  it('does not fetch without an active tenant', async () => {
    tenantState = { activeTenant: null };
    const repository = makeRepository();
    const factory = vi.fn(() => repository);
    const { root } = await mount(factory);
    expect(factory).not.toHaveBeenCalled();
    expect(repository.getAmoCrmIntegrationHealth).not.toHaveBeenCalled();
    expect(current?.health).toBeNull();
    await act(async () => root.unmount());
  });

  it.each(['doctor', 'cashier'])('does not fetch integration health for %s', async (role) => {
    tenantState = {
      activeTenant: {
        tenantId: tenantA,
        role,
        tenantName: 'Clinic A',
        timezone: 'Asia/Almaty',
      },
    };
    const repository = makeRepository();
    const factory = vi.fn(() => repository);
    const { root } = await mount(factory);
    expect(factory).not.toHaveBeenCalled();
    expect(repository.getAmoCrmIntegrationHealth).not.toHaveBeenCalled();
    expect(current?.health).toBeNull();
    await act(async () => root.unmount());
  });
  it('loads safe health for the current tenant', async () => {
    const repository = makeRepository();
    const { root } = await mount(() => repository);
    expect(repository.getAmoCrmIntegrationHealth).toHaveBeenCalledTimes(1);
    expect(current?.health).toMatchObject({ externalAccountId: tenantA, status: 'connected' });
    await act(async () => root.unmount());
  });

  it('clears tenant A state and ignores its late response after tenant switch', async () => {
    let resolveA!: (value: ReturnType<typeof health>) => void;
    const repoA = makeRepository({
      getAmoCrmIntegrationHealth: vi.fn(() => new Promise<ReturnType<typeof health>>((resolve) => { resolveA = resolve; })),
    });
    const repoB = makeRepository({
      getAmoCrmIntegrationHealth: vi.fn().mockResolvedValue(health(tenantB)),
    });
    const factory = (tenantId: string) => tenantId === tenantA ? repoA : repoB;
    const { root, Harness } = await mount(factory);

    tenantState = {
      activeTenant: {
        tenantId: tenantB,
        role: 'clinic_admin',
        tenantName: 'Clinic B',
        timezone: 'Asia/Almaty',
      },
    };
    await act(async () => { root.render(<Harness tick={1} />); });
    expect(current?.health).toMatchObject({ externalAccountId: tenantB });

    await act(async () => { resolveA(health(tenantA)); });
    expect(current?.health).toMatchObject({ externalAccountId: tenantB });
    await act(async () => root.unmount());
  });

  it('blocks duplicate connect actions while one popup request is active', async () => {
    let resolveStart!: (value: AmoCrmConnectionStartResult) => void;
    const repository = makeRepository({
      startAmoCrmConnection: vi.fn(() => new Promise<AmoCrmConnectionStartResult>((resolve) => { resolveStart = resolve; })),
    });
    const { root, openAuthorizationWindow } = await mount(() => repository);
    let first!: Promise<void>;
    await act(async () => { first = current!.connect(); });
    await act(async () => { await current!.connect(); });
    expect(repository.startAmoCrmConnection).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveStart({
        authorizationUrl: 'https://www.amocrm.ru/oauth?state=opaque',
        expiresAt: '2026-07-14T12:10:00Z',
        integrationAccountId: 'integration-a',
        status: 'authorization_pending',
      });
      await first;
    });
    expect(openAuthorizationWindow).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it('handles a callback marker with exactly one safe status refresh on mount', async () => {
    const repository = makeRepository();
    const { root } = await mount(
      () => repository,
      '?amocrm_status=connected',
    );
    expect(repository.getAmoCrmIntegrationHealth).toHaveBeenCalledTimes(1);
    expect(repository.requestAmoCrmHealthRefresh).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it('uses backend actions without parsing any credential fields', async () => {
    const repository = makeRepository();
    const { root } = await mount(() => repository);
    await act(async () => { await current!.check(); });
    await act(async () => { await current!.disconnect(); });
    expect(repository.requestAmoCrmHealthRefresh).toHaveBeenCalledTimes(1);
    expect(repository.disconnectAmoCrmConnection).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(current?.health)).not.toMatch(/accessToken|refreshToken|clientSecret|stateHash/i);
    await act(async () => root.unmount());
  });
});
