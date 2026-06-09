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
  supabase: {
    from: mockFrom,
  },
}));

type AuthValue = ReturnType<typeof AuthContextModule.useAuth>;
type TenantContextValue = ReturnType<typeof useTenant>;

const devAuth: AuthValue = {
  user: { id: 'dev-user-000000000000', email: 'dev@example.com' },
  isLoading: false,
  error: null,
  authMode: 'dev',
  signIn: vi.fn(),
  signOut: vi.fn(),
};

const renderTenantContext = async (authValue: AuthValue) => {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(authValue);

  let tenantContextResult: TenantContextValue | undefined;

  const TestComponent = () => {
    tenantContextResult = useTenant();
    return null;
  };

  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <TenantProvider>
        <TestComponent />
      </TenantProvider>
    );
  });

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    get result() {
      if (!tenantContextResult) {
        throw new Error('TenantContext did not render');
      }

      return tenantContextResult;
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
    const { result, root } = await renderTenantContext(devAuth);

    expect(result.availableTenants).toHaveLength(1);
    expect(result.activeTenant?.tenantId).toBe('11111111-1111-1111-1111-111111111111');
    expect(result.activeTenant?.tenantName).toBe('Demo Clinic');
    expect(result.activeTenant?.role).toBe('admin');
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();

    await act(async () => {
      result.setActiveTenant('11111111-1111-1111-1111-111111111111');
    });
    expect(result.activeTenant?.tenantId).toBe('11111111-1111-1111-1111-111111111111');

    await act(async () => {
      result.setActiveTenant('unknown-tenant');
    });
    expect(result.activeTenant?.tenantId).toBe('11111111-1111-1111-1111-111111111111');

    await unmount(root);
  });

  it('keeps loading during supabase-active auth loading and does not query tenants', async () => {
    const { result, root } = await renderTenantContext({
      ...devAuth,
      user: null,
      isLoading: true,
      authMode: 'supabase-active',
    });

    expect(result.availableTenants).toEqual([]);
    expect(result.activeTenant).toBeNull();
    expect(result.isLoading).toBe(true);
    expect(result.error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();

    await unmount(root);
  });

  it('returns empty tenants for supabase-active without user and does not query tenants', async () => {
    const { result, root } = await renderTenantContext({
      ...devAuth,
      user: null,
      isLoading: false,
      authMode: 'supabase-active',
    });

    expect(result.availableTenants).toEqual([]);
    expect(result.activeTenant).toBeNull();
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();

    await act(async () => {
      result.setActiveTenant('any-tenant');
    });
    expect(result.activeTenant).toBeNull();

    await unmount(root);
  });

  it('loads tenants for a supabase-active authenticated user', async () => {
    mockEq.mockResolvedValue({
      data: [
        {
          tenant_id: '11111111-1111-1111-1111-111111111111',
          role: 'clinic_admin',
          tenants: {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Demo Clinic A',
            status: 'active',
          },
        },
      ],
      error: null,
    });

    const { result, root } = await renderTenantContext({
      ...devAuth,
      user: { id: 'real-user-123', email: 'real@example.com' },
      isLoading: false,
      authMode: 'supabase-active',
    });

    expect(mockFrom).toHaveBeenCalledWith('tenant_users');
    expect(mockSelect).toHaveBeenCalledWith('role, tenant_id, tenants(id, name, status)');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'real-user-123');
    expect(result.availableTenants).toEqual([
      {
        tenantId: '11111111-1111-1111-1111-111111111111',
        tenantName: 'Demo Clinic A',
        role: 'clinic_admin',
      },
    ]);
    expect(result.activeTenant?.tenantId).toBe('11111111-1111-1111-1111-111111111111');
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();

    await unmount(root);
  });

  it('returns empty tenants and loading false when user has zero tenants', async () => {
    mockEq.mockResolvedValue({ data: [], error: null });

    const { result, root } = await renderTenantContext({
      ...devAuth,
      user: { id: 'real-user-123', email: 'real@example.com' },
      isLoading: false,
      authMode: 'supabase-active',
    });

    expect(result.availableTenants).toEqual([]);
    expect(result.activeTenant).toBeNull();
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();

    await unmount(root);
  });

  it('sets error and loading false when tenant query fails', async () => {
    mockEq.mockResolvedValue({ data: null, error: new Error('RLS denied') });

    const { result, root } = await renderTenantContext({
      ...devAuth,
      user: { id: 'real-user-123', email: 'real@example.com' },
      isLoading: false,
      authMode: 'supabase-active',
    });

    expect(result.availableTenants).toEqual([]);
    expect(result.activeTenant).toBeNull();
    expect(result.isLoading).toBe(false);
    expect(result.error?.message).toBe('RLS denied');

    await unmount(root);
  });

  it('supports multiple tenants and rejects unknown tenant selection', async () => {
    mockEq.mockResolvedValue({
      data: [
        {
          tenant_id: '11111111-1111-1111-1111-111111111111',
          role: 'clinic_admin',
          tenants: {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Demo Clinic A',
            status: 'active',
          },
        },
        {
          tenant_id: '22222222-2222-2222-2222-222222222222',
          role: 'registrar',
          tenants: {
            id: '22222222-2222-2222-2222-222222222222',
            name: 'Demo Clinic B',
            status: 'active',
          },
        },
      ],
      error: null,
    });

    const { result, root } = await renderTenantContext({
      ...devAuth,
      user: { id: 'real-user-123', email: 'real@example.com' },
      isLoading: false,
      authMode: 'supabase-active',
    });

    expect(result.availableTenants).toHaveLength(2);
    expect(result.activeTenant?.tenantId).toBe('11111111-1111-1111-1111-111111111111');

    await act(async () => {
      result.setActiveTenant('22222222-2222-2222-2222-222222222222');
    });
    expect(result.activeTenant?.tenantId).toBe('22222222-2222-2222-2222-222222222222');

    await act(async () => {
      result.setActiveTenant('unknown-tenant');
    });
    expect(result.activeTenant?.tenantId).toBe('22222222-2222-2222-2222-222222222222');

    await unmount(root);
  });
});
