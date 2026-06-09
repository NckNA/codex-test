// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { TenantProvider, useTenant } from './TenantContext';
import * as AuthContextModule from './AuthContext';

describe('TenantContext Current Behavior', () => {
  it('1. Provides dev fallback behavior', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'dev-user-000000000000', email: 'dev@example.com' },
      isLoading: false,
      error: null,
      authMode: 'dev',
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    let tenantContextResult: ReturnType<typeof useTenant> | undefined;

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

    expect(tenantContextResult).toBeDefined();
    expect(tenantContextResult!.availableTenants).toHaveLength(1);
    expect(tenantContextResult!.activeTenant).toBeDefined();
    
    const devTenant = tenantContextResult!.activeTenant!;
    expect(devTenant.tenantId).toBe('11111111-1111-1111-1111-111111111111');
    expect(devTenant.tenantName).toBe('Demo Clinic');
    expect(devTenant.role).toBe('admin');
    
    expect(tenantContextResult!.isLoading).toBe(false);
    expect(tenantContextResult!.error).toBeNull();

    // setActiveTenant with existing dev tenant keeps/sets that tenant
    await act(async () => {
      tenantContextResult!.setActiveTenant('11111111-1111-1111-1111-111111111111');
    });
    expect(tenantContextResult!.activeTenant?.tenantId).toBe('11111111-1111-1111-1111-111111111111');

    // setActiveTenant with unknown tenant does not crash
    await act(async () => {
      tenantContextResult!.setActiveTenant('unknown-tenant');
    });
    // Should gracefully ignore or fallback, no crash
    expect(tenantContextResult!.activeTenant?.tenantId).toBe('11111111-1111-1111-1111-111111111111');

    await act(async () => {
      root.unmount();
    });
  });

  it('2. Preserves current supabase-active placeholder behavior (no user)', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isLoading: false,
      error: null,
      authMode: 'supabase-active',
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    let tenantContextResult: ReturnType<typeof useTenant> | undefined;

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

    expect(tenantContextResult!.availableTenants).toEqual([]);
    expect(tenantContextResult!.activeTenant).toBeNull();
    // Currently, TenantContext sets isLoading to authMode !== 'dev'
    expect(tenantContextResult!.isLoading).toBe(true);
    expect(tenantContextResult!.error).toBeNull();

    // setActiveTenant does not crash
    await act(async () => {
      tenantContextResult!.setActiveTenant('any-tenant');
    });
    expect(tenantContextResult!.activeTenant).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('3. Preserves current supabase-active with authenticated user placeholder behavior', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'real-user-123', email: 'real@example.com' },
      isLoading: false,
      error: null,
      authMode: 'supabase-active',
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    let tenantContextResult: ReturnType<typeof useTenant> | undefined;

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

    // Because real implementation is not done, this tests the blocked placeholder state
    expect(tenantContextResult!.availableTenants).toEqual([]);
    expect(tenantContextResult!.activeTenant).toBeNull();
    expect(tenantContextResult!.isLoading).toBe(true);
    expect(tenantContextResult!.error).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});

describe.skip('Future TENANT-REAL-001A Expectations', () => {
  it('supabase-active + auth loading should not query tenants', () => {});
  it('supabase-active + no user should not query tenants and should loading false', () => {});
  it('supabase-active + user should query tenant_users + tenants', () => {});
  it('zero tenants should produce empty tenants and loading false', () => {});
  it('query failure should set error and loading false', () => {});
  it('multiple tenants should populate availableTenants', () => {});
  it('setActiveTenant should reject unknown tenant', () => {});
  it('persisted tenant selection should be postponed', () => {});
});
