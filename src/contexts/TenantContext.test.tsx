// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Auth from './AuthContext';
import { TenantProvider, useTenant } from './TenantContext';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { rpc } }));

const baseAuth: ReturnType<typeof Auth.useAuth> = {
  user: { id: 'u1', email: 'u1@example.local' }, isLoading: false, error: null, authMode: 'supabase-active', signIn: vi.fn(), signOut: vi.fn(),
};

async function render(auth = baseAuth) {
  vi.spyOn(Auth, 'useAuth').mockReturnValue(auth);
  let value: ReturnType<typeof useTenant> | undefined;
  function Probe() { value = useTenant(); return null; }
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(<TenantProvider><Probe /></TenantProvider>));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  return { get value() { return value!; }, root };
}

beforeEach(() => { vi.restoreAllMocks(); rpc.mockReset(); });

describe('TenantContext lifecycle bootstrap', () => {
  it('uses dev tenant without Supabase', async () => {
    const view = await render({ ...baseAuth, authMode: 'dev' });
    expect(view.value.activeTenant?.operationalAccessAllowed).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
    await act(async () => view.root.unmount());
  });

  it('loads platform status and authoritative tenant access RPCs', async () => {
    rpc.mockImplementation(async (name: string) => name === 'get_platform_admin_status'
      ? { data: { isPlatformSuperadmin: true, status: 'active' }, error: null }
      : { data: [{ tenant_id: 't1', tenant_name: 'Clinic', timezone: 'Asia/Almaty', role: 'clinic_owner', stored_status: 'active', effective_status: 'active', operational_access_allowed: true, reason_code: 'none', action_required: 'none' }], error: null });
    const view = await render();
    expect(rpc.mock.calls.map((call) => call[0])).toEqual(['get_platform_admin_status', 'list_my_tenant_access']);
    expect(view.value.isPlatformSuperadmin).toBe(true);
    expect(view.value.activeTenant?.tenantName).toBe('Clinic');
    await act(async () => view.root.unmount());
  });

  it('keeps suspended tenant visible but blocked', async () => {
    rpc.mockImplementation(async (name: string) => name === 'get_platform_admin_status'
      ? { data: { isPlatformSuperadmin: false, status: 'none' }, error: null }
      : { data: [{ tenant_id: 't1', tenant_name: 'Suspended', timezone: 'Asia/Almaty', role: 'clinic_owner', stored_status: 'suspended', effective_status: 'suspended', operational_access_allowed: false, reason_code: 'tenant_suspended', action_required: 'contact_support' }], error: null });
    const view = await render();
    expect(view.value.activeTenant?.effectiveStatus).toBe('suspended');
    expect(view.value.activeTenant?.operationalAccessAllowed).toBe(false);
    await act(async () => view.root.unmount());
  });

  it('prefers another operational tenant for multi-tenant user', async () => {
    rpc.mockImplementation(async (name: string) => name === 'get_platform_admin_status'
      ? { data: { isPlatformSuperadmin: false, status: 'none' }, error: null }
      : { data: [
        { tenant_id: 'blocked', tenant_name: 'Blocked', timezone: 'Asia/Almaty', role: 'doctor', stored_status: 'expired', effective_status: 'expired', operational_access_allowed: false, reason_code: 'subscription_expired', action_required: 'renew_subscription' },
        { tenant_id: 'active', tenant_name: 'Active', timezone: 'Europe/Berlin', role: 'doctor', stored_status: 'active', effective_status: 'active', operational_access_allowed: true, reason_code: 'none', action_required: 'none' },
      ], error: null });
    const view = await render();
    expect(view.value.activeTenant?.tenantId).toBe('active');
    expect(view.value.activeTenant?.timezone).toBe('Europe/Berlin');
    await act(async () => view.root.unmount());
  });

  it('does not query without authenticated user', async () => {
    const view = await render({ ...baseAuth, user: null });
    expect(view.value.activeTenant).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
    await act(async () => view.root.unmount());
  });
});
