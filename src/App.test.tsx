// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import * as Auth from './contexts/AuthContext';
import * as Tenant from './contexts/TenantContext';

vi.mock('./pages/platform/PlatformTenantsPage', () => ({ PlatformTenantsPage: () => <div>PLATFORM TENANTS SAFE PAGE</div> }));
vi.mock('./pages/platform/PlatformTenantDetailsPage', () => ({ PlatformTenantDetailsPage: () => <div>PLATFORM TENANT DETAILS</div> }));

Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) });

const activeTenant = { tenantId: 't1', tenantName: 'Clinic', timezone: 'Asia/Almaty', role: 'clinic_admin', storedStatus: 'active' as const, effectiveStatus: 'active' as const, operationalAccessAllowed: true, reasonCode: 'none' as const, actionRequired: 'none' };
const authValue = (overrides: Partial<ReturnType<typeof Auth.useAuth>> = {}): ReturnType<typeof Auth.useAuth> => ({ user: { id: 'u1', email: 'u1@example.local' }, isLoading: false, error: null, authMode: 'supabase-active', signIn: vi.fn(), signOut: vi.fn(), ...overrides });
const tenantValue = (overrides: Partial<ReturnType<typeof Tenant.useTenant>> = {}): ReturnType<typeof Tenant.useTenant> => ({ activeTenant, availableTenants: [activeTenant], setActiveTenant: vi.fn(), refreshTenants: vi.fn(async () => undefined), platformAdminStatus: null, isPlatformSuperadmin: false, isLoading: false, error: null, ...overrides });

async function render(path = '/') {
  window.history.pushState({}, '', path);
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => root.render(<App />));
  return { container, root };
}

afterEach(() => { vi.restoreAllMocks(); window.history.pushState({}, '', '/'); });

describe('App auth, platform and lifecycle gates', () => {
  it('renders login without authenticated user', async () => {
    vi.spyOn(Auth, 'useAuth').mockReturnValue(authValue({ user: null }));
    vi.spyOn(Tenant, 'useTenant').mockReturnValue(tenantValue({ activeTenant: null, availableTenants: [] }));
    const view = await render();
    expect(view.container.querySelector('input[type="email"]')).toBeTruthy();
    await act(async () => view.root.unmount());
  });

  it('renders ordinary clinic app only for operational tenant', async () => {
    vi.spyOn(Auth, 'useAuth').mockReturnValue(authValue());
    vi.spyOn(Tenant, 'useTenant').mockReturnValue(tenantValue());
    const view = await render('/patients');
    expect(view.container.textContent).not.toContain('PLATFORM TENANTS SAFE PAGE');
    expect(view.container.textContent).not.toContain('Работа клиники временно приостановлена');
    await act(async () => view.root.unmount());
  });

  it('shows dedicated suspended clinic page and no medical navigation', async () => {
    vi.spyOn(Auth, 'useAuth').mockReturnValue(authValue());
    const suspended = { ...activeTenant, storedStatus: 'suspended' as const, effectiveStatus: 'suspended' as const, operationalAccessAllowed: false, reasonCode: 'tenant_suspended' as const, actionRequired: 'contact_support' };
    vi.spyOn(Tenant, 'useTenant').mockReturnValue(tenantValue({ activeTenant: suspended, availableTenants: [suspended] }));
    const view = await render('/patients');
    expect(view.container.textContent).toContain('Работа клиники временно приостановлена');
    expect(view.container.textContent).not.toContain('CRM');
    await act(async () => view.root.unmount());
  });

  it('allows active platform superadmin without clinic membership', async () => {
    vi.spyOn(Auth, 'useAuth').mockReturnValue(authValue());
    vi.spyOn(Tenant, 'useTenant').mockReturnValue(tenantValue({ activeTenant: null, availableTenants: [], isPlatformSuperadmin: true, platformAdminStatus: { isPlatformSuperadmin: true, status: 'active' } }));
    const view = await render('/platform/tenants');
    expect(view.container.textContent).toContain('PLATFORM TENANTS SAFE PAGE');
    expect(view.container.textContent).not.toContain('CRM');
    expect(view.container.textContent).not.toContain('Пациенты');
    expect(view.container.textContent).not.toContain('Финансы');
    await act(async () => view.root.unmount());
  });

  it('blocks ordinary and disabled platform users from platform route', async () => {
    vi.spyOn(Auth, 'useAuth').mockReturnValue(authValue());
    vi.spyOn(Tenant, 'useTenant').mockReturnValue(tenantValue({ isPlatformSuperadmin: false, platformAdminStatus: { isPlatformSuperadmin: false, status: 'disabled' } }));
    const view = await render('/platform/tenants');
    expect(view.container.textContent).toContain('Недостаточно прав для управления платформой');
    await act(async () => view.root.unmount());
  });

  it('lets multi-tenant user switch away from blocked clinic', async () => {
    vi.spyOn(Auth, 'useAuth').mockReturnValue(authValue());
    const setActiveTenant = vi.fn();
    const blocked = { ...activeTenant, tenantId: 'blocked', storedStatus: 'expired' as const, effectiveStatus: 'expired' as const, operationalAccessAllowed: false, reasonCode: 'subscription_expired' as const, actionRequired: 'renew_subscription' };
    const other = { ...activeTenant, tenantId: 'active', tenantName: 'Other Clinic' };
    vi.spyOn(Tenant, 'useTenant').mockReturnValue(tenantValue({ activeTenant: blocked, availableTenants: [blocked, other], setActiveTenant }));
    const view = await render('/');
    const select = view.container.querySelector('select[aria-label="Переключить клинику"]') as HTMLSelectElement;
    await act(async () => { select.value = 'active'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(setActiveTenant).toHaveBeenCalledWith('active');
    await act(async () => view.root.unmount());
  });
});
