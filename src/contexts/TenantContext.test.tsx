// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { TenantProvider, useTenant } from './TenantContext';
import * as AuthContextModule from './AuthContext';

const { mockFrom, mockSelect, mockEq } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from: mockFrom },
}));

type AuthValue = ReturnType<typeof AuthContextModule.useAuth>;
type TenantContextValue = ReturnType<typeof useTenant>;

const baseAuth: AuthValue = {
  user: { id: 'dev-user-000000000000', email: 'dev@example.com' },
  isLoading: false,
  error: null,
  authMode: 'dev',
  signIn: vi.fn(),
  signOut: vi.fn(),
};

const tenantRow = (tenantId: string, name: string, role: string) => ({
  tenant_id: tenantId,
  role,
  tenants: { id: tenantId, name, status: 'active' },
});

const renderTenantContext = async (authValue: AuthValue) => {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(authValue);
  let current: TenantContextValue | undefined;

  const Probe = () => {
    current = useTenant();
    return null;
  };

  const root = createRoot(document.createElement('div'));

  await act(async () => {
    root.render(
      <TenantProvider>
        <Probe />
      </TenantProvider>
    );
  });

  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return {
    get result() {
      if (!current) throw new Error('TenantContext did not render');
      return current;
    },
    root,
  };
};

const unmount = async (root: ReturnType<typeof createRoot>) => {
  await act(async () => {
    root.unmount();
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
  mockFrom.mockReset();
  mockSelect.mockReset();
  mockEq.mockReset();
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TenantContext behavior', () => {
  it('uses dev fallback without querying Supabase', async () => {
    const view = await renderTenantContext(baseAuth);

    expect(view.result.availableTenants).toHaveLength(1);
    expect(view.result.activeTenant?.tenantId).toBe('11111111-1111-1111-1111-111111111111');
    expect(view.result.activeTenant?.tenantName).toBe('Demo Clinic');
    expect(view.result.activeTenant?.role).toBe('admin');
    expect(view.result.isLoading).toBe(false);
    expect(view.result.error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();

    await act(async () => view.result.setActiveTenant('unknown-tenant'));
    expect(view.result.activeTenant?.tenantId).toBe('11111111-1111-1111-1111-111111111111');

    await unmount(view.root);
  });

  it('does not query tenants while auth is loading', async () => {
    const view = await renderTenantContext({ ...baseAuth, user: null, isLoading: true, authMode: 'supabase-active' });

    expect(view.result.availableTenants).toEqual([]);
    expect(view.result.activeTenant).toBeNull();
    expect(view.result.isLoading).toBe(true);
    expect(view.result.error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();

    await unmount(view.root);
  });

  it('does not query tenants without a user', async () => {
    const view = await renderTenantContext({ ...baseAuth, user: null, isLoading: false, authMode: 'supabase-active' });

    expect(view.result.availableTenants).toEqual([]);
    expect(view.result.activeTenant).toBeNull();
    expect(view.result.isLoading).toBe(false);
    expect(view.result.error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();

    await unmount(view.root);
  });

  it('loads tenants for an authenticated user', async () => {
    mockEq.mockResolvedValue({
      data: [tenantRow('11111111-1111-1111-1111-111111111111', 'Demo Clinic A', 'clinic_admin')],
      error: null,
    });

    const view = await renderTenantContext({
      ...baseAuth,
      user: { id: 'real-user-123', email: 'real@example.com' },
      isLoading: false,
      authMode: 'supabase-active',
    });

    expect(mockFrom).toHaveBeenCalledWith('tenant_users');
    expect(mockSelect).toHaveBeenCalledWith('role, tenant_id, tenants(id, name, status)');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'real-user-123');
    expect(view.result.availableTenants).toEqual([
      { tenantId: '11111111-1111-1111-1111-111111111111', tenantName: 'Demo Clinic A', role: 'clinic_admin' },
    ]);
    expect(view.result.activeTenant?.tenantId).toBe('11111111-1111-1111-1111-111111111111');
    expect(view.result.isLoading).toBe(false);
    expect(view.result.error).toBeNull();

    await unmount(view.root);
  });

  it('handles zero tenants', async () => {
    mockEq.mockResolvedValue({ data: [], error: null });

    const view = await renderTenantContext({
      ...baseAuth,
      user: { id: 'real-user-123', email: 'real@example.com' },
      isLoading: false,
      authMode: 'supabase-active',
    });

    expect(view.result.availableTenants).toEqual([]);
    expect(view.result.activeTenant).toBeNull();
    expect(view.result.isLoading).toBe(false);
    expect(view.result.error).toBeNull();

    await unmount(view.root);
  });

  it('handles query errors', async () => {
    mockEq.mockResolvedValue({ data: null, error: new Error('Tenant query failed') });

    const view = await renderTenantContext({
      ...baseAuth,
      user: { id: 'real-user-123', email: 'real@example.com' },
      isLoading: false,
      authMode: 'supabase-active',
    });

    expect(view.result.availableTenants).toEqual([]);
    expect(view.result.activeTenant).toBeNull();
    expect(view.result.isLoading).toBe(false);
    expect(view.result.error?.message).toBe('Tenant query failed');

    await unmount(view.root);
  });

  it('supports multiple tenants and ignores unknown tenant selection', async () => {
    mockEq.mockResolvedValue({
      data: [
        tenantRow('11111111-1111-1111-1111-111111111111', 'Demo Clinic A', 'clinic_admin'),
        tenantRow('22222222-2222-2222-2222-222222222222', 'Demo Clinic B', 'registrar'),
      ],
      error: null,
    });

    const view = await renderTenantContext({
      ...baseAuth,
      user: { id: 'real-user-123', email: 'real@example.com' },
      isLoading: false,
      authMode: 'supabase-active',
    });

    expect(view.result.availableTenants).toHaveLength(2);
    expect(view.result.activeTenant?.tenantId).toBe('11111111-1111-1111-1111-111111111111');

    await act(async () => view.result.setActiveTenant('22222222-2222-2222-2222-222222222222'));
    expect(view.result.activeTenant?.tenantId).toBe('22222222-2222-2222-2222-222222222222');

    await act(async () => view.result.setActiveTenant('unknown-tenant'));
    expect(view.result.activeTenant?.tenantId).toBe('22222222-2222-2222-2222-222222222222');

    await unmount(view.root);
  });

  it('does not leak tenants across user switches', async () => {
    let pendingResolve: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      pendingResolve = resolve;
    });

    mockEq
      .mockResolvedValueOnce({
        data: [tenantRow('11111111-1111-1111-1111-111111111111', 'Demo Clinic A', 'clinic_admin')],
        error: null,
      })
      .mockReturnValueOnce(pendingPromise);

    const useAuthMock = vi.spyOn(AuthContextModule, 'useAuth');
    useAuthMock.mockReturnValue({
      ...baseAuth,
      user: { id: 'user-A', email: 'a@example.com' },
      isLoading: false,
      authMode: 'supabase-active',
    });

    let current: ReturnType<typeof useTenant> | undefined;

    const Probe = () => {
      current = useTenant();
      return null;
    };

    const root = createRoot(document.createElement('div'));

    await act(async () => {
      root.render(
        <TenantProvider>
          <Probe />
        </TenantProvider>
      );
    });

    // Wait for user A to load
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(current!.availableTenants).toHaveLength(1);
    expect(current!.activeTenant?.tenantId).toBe('11111111-1111-1111-1111-111111111111');
    expect(current!.isLoading).toBe(false);

    // Switch to user B
    useAuthMock.mockReturnValue({
      ...baseAuth,
      user: { id: 'user-B', email: 'b@example.com' },
      isLoading: false,
      authMode: 'supabase-active',
    });

    // Re-render
    await act(async () => {
      root.render(
        <TenantProvider>
          <Probe />
        </TenantProvider>
      );
    });

    // User B query is pending.
    // Assert tenant A is not exposed.
    expect(current!.isLoading).toBe(true);
    expect(current!.availableTenants).toEqual([]);
    expect(current!.activeTenant).toBeNull();

    // Resolve B's promise to cleanup
    pendingResolve!({ data: [], error: null });

    await act(async () => {
      await pendingPromise;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await unmount(root);
  });
});
