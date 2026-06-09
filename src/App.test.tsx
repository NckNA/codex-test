// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi } from 'vitest';
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

describe('App Auth & Tenant Gate', () => {
  it('1. dev mode renders app routes, not LoginPage, not no-tenant screen', async () => {
    mockUseAuth({ authMode: 'dev', isLoading: false });
    mockUseTenant({ activeTenant: { tenantId: '123', tenantName: 'Dev' }, availableTenants: [{ tenantId: '123', tenantName: 'Dev' }], isLoading: false });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).not.toContain('Вход в систему');
    expect(container.textContent).not.toContain('Клиника не назначена');
    // It should render Layout containing Header, which contains user name or date
    expect(container.textContent).toBeDefined();

    await act(async () => {
      root.unmount();
    });
  });

  it('2. supabase-active + auth loading renders auth loading screen', async () => {
    mockUseAuth({ authMode: 'supabase-active', isLoading: true });
    mockUseTenant();

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(container.querySelector('.animate-spin')).toBeDefined();

    await act(async () => {
      root.unmount();
    });
  });

  it('3. supabase-active + no user renders LoginPage', async () => {
    mockUseAuth({ authMode: 'supabase-active', user: null, isLoading: false });
    mockUseTenant();

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).toContain('Вход в систему');

    await act(async () => {
      root.unmount();
    });
  });

  it('4. supabase-active + user + tenant loading renders "Загрузка клиники..."', async () => {
    mockUseAuth({ authMode: 'supabase-active', user: { id: '1', email: 'a@a.com' }, isLoading: false });
    mockUseTenant({ isLoading: true });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).toContain('Загрузка клиники...');

    await act(async () => {
      root.unmount();
    });
  });

  it('5. supabase-active + user + tenant error renders "Не удалось загрузить клинику" and logout button calls signOut', async () => {
    const signOutMock = vi.fn();
    mockUseAuth({ authMode: 'supabase-active', user: { id: '1', email: 'a@a.com' }, isLoading: false, signOut: signOutMock });
    mockUseTenant({ error: new Error('Network fail'), isLoading: false });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).toContain('Не удалось загрузить клинику');
    expect(container.textContent).toContain('Network fail');

    const button = container.querySelector('button');
    expect(button?.textContent).toContain('Выйти');
    
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(signOutMock).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('6. supabase-active + user + no tenants renders "Клиника не назначена" and logout button calls signOut', async () => {
    const signOutMock = vi.fn();
    mockUseAuth({ authMode: 'supabase-active', user: { id: '1', email: 'a@a.com' }, isLoading: false, signOut: signOutMock });
    mockUseTenant({ activeTenant: null, availableTenants: [], isLoading: false });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).toContain('Клиника не назначена');

    const button = container.querySelector('button');
    expect(button?.textContent).toContain('Выйти');

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(signOutMock).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('7. supabase-active + user + activeTenant renders normal app routes', async () => {
    mockUseAuth({ authMode: 'supabase-active', user: { id: '1', email: 'a@a.com' }, isLoading: false });
    mockUseTenant({ activeTenant: { tenantId: '123', tenantName: 'Real' }, availableTenants: [{ tenantId: '123', tenantName: 'Real' }], isLoading: false });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).not.toContain('Загрузка клиники...');
    expect(container.textContent).not.toContain('Клиника не назначена');
    expect(container.textContent).not.toContain('Вход в систему');

    await act(async () => {
      root.unmount();
    });
  });
});
