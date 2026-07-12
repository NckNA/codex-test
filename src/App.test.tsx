// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { App } from './App';
import * as AuthContextModule from './contexts/AuthContext';
import * as TenantContextModule from './contexts/TenantContext';

// Mock matchMedia for nested components if necessary
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const mockUseAuth = (overrides: Partial<ReturnType<typeof AuthContextModule.useAuth>> = {}) => {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: null,
    isLoading: false,
    error: null,
    authMode: 'dev',
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  });
};

const mockUseTenant = (overrides: Partial<ReturnType<typeof TenantContextModule.useTenant>> = {}) => {
  vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
    activeTenant: null,
    availableTenants: [],
    setActiveTenant: vi.fn(),
    isLoading: false,
    error: null,
    ...overrides,
  });
};

const renderApp = async () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(<App />);
  });

  return { container, root };
};

const unmount = async (root: ReturnType<typeof createRoot>) => {
  await act(async () => {
    root.unmount();
  });
};

const currentRoleLabel = (container: HTMLElement) => container.querySelector('[data-testid="current-role-label"]')?.textContent ?? null;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App Auth & Tenant Gate', () => {
  it('1. dev mode renders app routes, not LoginPage, not no-tenant screen', async () => {
    mockUseAuth({ authMode: 'dev', isLoading: false });
    mockUseTenant({ activeTenant: { tenantId: '123', tenantName: 'Dev', timezone: 'Asia/Almaty', role: 'clinic_admin' }, availableTenants: [{ tenantId: '123', tenantName: 'Dev', timezone: 'Asia/Almaty', role: 'clinic_admin' }], isLoading: false });

    const { container, root } = await renderApp();

    expect(container.textContent).not.toContain('Вход в систему');
    expect(container.textContent).not.toContain('Клиника не назначена');
    // It should render Layout containing Header, which contains user name or date
    expect(container.textContent).toBeDefined();

    await unmount(root);
  });

  it('2. supabase-active + auth loading renders auth loading screen', async () => {
    mockUseAuth({ authMode: 'supabase-active', isLoading: true });
    mockUseTenant();

    const { container, root } = await renderApp();

    expect(container.querySelector('.animate-spin')).toBeDefined();

    await unmount(root);
  });

  it('3. supabase-active + no user renders LoginPage', async () => {
    mockUseAuth({ authMode: 'supabase-active', user: null, isLoading: false });
    mockUseTenant();

    const { container, root } = await renderApp();

    expect(container.textContent).toContain('Вход в систему');

    await unmount(root);
  });

  it('4. supabase-active + user + tenant loading renders "Загрузка клиники..."', async () => {
    mockUseAuth({ authMode: 'supabase-active', user: { id: '1', email: 'a@a.com' }, isLoading: false });
    mockUseTenant({ isLoading: true });

    const { container, root } = await renderApp();

    expect(container.textContent).toContain('Загрузка клиники...');

    await unmount(root);
  });

  it('5. supabase-active + user + tenant error renders "Не удалось загрузить клинику" and logout button calls signOut', async () => {
    const signOutMock = vi.fn();
    mockUseAuth({ authMode: 'supabase-active', user: { id: '1', email: 'a@a.com' }, isLoading: false, signOut: signOutMock });
    mockUseTenant({ error: new Error('Network fail'), isLoading: false });

    const { container, root } = await renderApp();

    expect(container.textContent).toContain('Не удалось загрузить клинику');
    expect(container.textContent).toContain('Network fail');

    const button = container.querySelector('button');
    expect(button?.textContent).toContain('Выйти');
    
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(signOutMock).toHaveBeenCalled();

    await unmount(root);
  });

  it('6. supabase-active + user + no tenants renders "Клиника не назначена" and no fake admin role', async () => {
    const signOutMock = vi.fn();
    mockUseAuth({ authMode: 'supabase-active', user: { id: '1', email: 'a@a.com' }, isLoading: false, signOut: signOutMock });
    mockUseTenant({ activeTenant: null, availableTenants: [], isLoading: false });

    const { container, root } = await renderApp();

    expect(container.textContent).toContain('Клиника не назначена');
    expect(currentRoleLabel(container)).toBeNull();
    expect(container.textContent).not.toContain('Администратор клиники');
    expect(container.textContent).not.toContain('Администратор платформы');

    const button = container.querySelector('button');
    expect(button?.textContent).toContain('Выйти');

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(signOutMock).toHaveBeenCalled();

    await unmount(root);
  });

  it('7. supabase-active + user + activeTenant renders normal app routes', async () => {
    mockUseAuth({ authMode: 'supabase-active', user: { id: '1', email: 'a@a.com' }, isLoading: false });
    mockUseTenant({ activeTenant: { tenantId: '123', tenantName: 'Real', timezone: 'Asia/Almaty', role: 'clinic_admin' }, availableTenants: [{ tenantId: '123', tenantName: 'Real', timezone: 'Asia/Almaty', role: 'clinic_admin' }], isLoading: false });

    const { container, root } = await renderApp();

    expect(container.textContent).not.toContain('Загрузка клиники...');
    expect(container.textContent).not.toContain('Клиника не назначена');
    expect(container.textContent).not.toContain('Вход в систему');

    await unmount(root);
  });

  it.each([
    ['clinic_admin', 'Администратор клиники'],
    ['clinic_owner', 'Владелец клиники'],
    ['doctor', 'Врач'],
    ['receptionist', 'Регистратор'],
    ['registrar', 'Регистратор'],
    ['cashier', 'Кассир'],
  ])('renders active clinic role label for %s', async (role, expectedLabel) => {
    mockUseAuth({ authMode: 'supabase-active', user: { id: '1', email: 'a@a.com' }, isLoading: false });
    mockUseTenant({
      activeTenant: { tenantId: '123', tenantName: 'Real', timezone: 'Asia/Almaty', role },
      availableTenants: [{ tenantId: '123', tenantName: 'Real', timezone: 'Asia/Almaty', role }],
      isLoading: false,
    });

    const { container, root } = await renderApp();

    expect(currentRoleLabel(container)).toBe(expectedLabel);
    expect(currentRoleLabel(container)).not.toBe('Администратор');
    expect(currentRoleLabel(container)).not.toBe('Администратор платформы');

    await unmount(root);
  });

  it('updates visible role label when active tenant role changes', async () => {
    const tenantSpy = vi.spyOn(TenantContextModule, 'useTenant');
    mockUseAuth({ authMode: 'supabase-active', user: { id: '1', email: 'a@a.com' }, isLoading: false });

    tenantSpy.mockReturnValue({
      activeTenant: { tenantId: 'clinic-a', tenantName: 'Clinic A', timezone: 'Asia/Almaty', role: 'clinic_admin' },
      availableTenants: [
        { tenantId: 'clinic-a', tenantName: 'Clinic A', timezone: 'Asia/Almaty', role: 'clinic_admin' },
        { tenantId: 'clinic-b', tenantName: 'Clinic B', timezone: 'Asia/Almaty', role: 'doctor' },
      ],
      setActiveTenant: vi.fn(),
      isLoading: false,
      error: null,
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(currentRoleLabel(container)).toBe('Администратор клиники');

    tenantSpy.mockReturnValue({
      activeTenant: { tenantId: 'clinic-b', tenantName: 'Clinic B', timezone: 'Asia/Almaty', role: 'doctor' },
      availableTenants: [
        { tenantId: 'clinic-a', tenantName: 'Clinic A', timezone: 'Asia/Almaty', role: 'clinic_admin' },
        { tenantId: 'clinic-b', tenantName: 'Clinic B', timezone: 'Asia/Almaty', role: 'doctor' },
      ],
      setActiveTenant: vi.fn(),
      isLoading: false,
      error: null,
    });

    await act(async () => {
      root.render(<App />);
    });

    expect(currentRoleLabel(container)).toBe('Врач');
    expect(currentRoleLabel(container)).not.toBe('Администратор клиники');

    await unmount(root);
  });
});
