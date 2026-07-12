// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Header } from './Header';
import * as AuthContextModule from '../../contexts/AuthContext';
import * as TenantContextModule from '../../contexts/TenantContext';
import * as ScheduleContextModule from '../../hooks/useScheduleContext';
import * as ClinicDoctorsModule from '../../data/hooks/useClinicDoctors';

const mockAuth = (overrides: Partial<ReturnType<typeof AuthContextModule.useAuth>> = {}) => {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: { id: 'dev-user-000000000000', email: 'dev@example.com' },
    isLoading: false,
    error: null,
    authMode: 'dev',
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  });
};

const mockTenant = (role?: string) => {
  vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
    activeTenant: { tenantId: 'tenant-1', tenantName: 'Demo Clinic', timezone: 'Asia/Almaty', role },
    availableTenants: [{ tenantId: 'tenant-1', tenantName: 'Demo Clinic', timezone: 'Asia/Almaty', role }],
    setActiveTenant: vi.fn(),
    isLoading: false,
    error: null,
  });
};

const mockSchedule = () => {
  vi.spyOn(ScheduleContextModule, 'useScheduleContext').mockReturnValue({
    selectedDate: '2026-06-15',
    setSelectedDate: vi.fn(),
    viewMode: 'day',
    setViewMode: vi.fn(),
    doctorFilter: null,
    setDoctorFilter: vi.fn(),
    statusFilter: null,
    setStatusFilter: vi.fn(),
    sourceFilter: null,
    setSourceFilter: vi.fn(),
  });
};

const mockDoctors = () => {
  vi.spyOn(ClinicDoctorsModule, 'useClinicDoctors').mockReturnValue({
    doctors: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
};

const renderHeader = async () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(<Header />);
  });

  return { container, root };
};

const unmount = async (root: ReturnType<typeof createRoot>) => {
  await act(async () => {
    root.unmount();
  });
};

const roleLabel = (container: HTMLElement) => container.querySelector('[data-testid="current-role-label"]')?.textContent ?? null;

beforeEach(() => {
  mockAuth();
  mockTenant('clinic_admin');
  mockSchedule();
  mockDoctors();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Header Auth Behavior', () => {
  it('renders dev fallback correctly', async () => {
    mockAuth({
      user: { id: 'dev-user-000000000000', email: 'dev@example.com' },
      authMode: 'dev',
    });
    mockTenant('clinic_admin');

    const { container, root } = await renderHeader();

    // Dev mode should show default name and NO logout button
    expect(container.textContent).toContain('Иван И.');
    expect(container.textContent).not.toContain('dev@example.com');
    expect(roleLabel(container)).toBe('Администратор клиники');
    const logoutBtn = container.querySelector('button[title="Выйти"]');
    expect(logoutBtn).toBeNull();

    await unmount(root);
  });

  it('renders real email and logout button in supabase-active mode', async () => {
    const signOutMock = vi.fn();
    mockAuth({
      user: { id: 'real-user-123', email: 'real@example.com' },
      authMode: 'supabase-active',
      signOut: signOutMock,
    });
    mockTenant('clinic_admin');

    const { container, root } = await renderHeader();

    // Supabase mode should show real email and logout button
    expect(container.textContent).not.toContain('Иван И.');
    expect(container.textContent).toContain('real@example.com');
    expect(roleLabel(container)).toBe('Администратор клиники');
    
    const logoutBtn = container.querySelector('button[title="Выйти"]') as HTMLButtonElement;
    expect(logoutBtn).not.toBeNull();

    await act(async () => {
      logoutBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(signOutMock).toHaveBeenCalled();

    await unmount(root);
  });
});

describe('Header role label', () => {
  it.each([
    ['clinic_admin', 'Администратор клиники'],
    ['clinic_owner', 'Владелец клиники'],
    ['doctor', 'Врач'],
    ['receptionist', 'Регистратор'],
    ['registrar', 'Регистратор'],
    ['cashier', 'Кассир'],
  ])('renders clinic label for %s', async (role, expectedLabel) => {
    mockTenant(role);

    const { container, root } = await renderHeader();

    expect(roleLabel(container)).toBe(expectedLabel);
    expect(roleLabel(container)).not.toBe('Администратор');
    expect(roleLabel(container)).not.toBe('Администратор платформы');

    await unmount(root);
  });

  it('does not display a platform role as a clinic role in clinic header context', async () => {
    mockTenant('platform_admin');

    const { container, root } = await renderHeader();

    expect(roleLabel(container)).toBe('Неизвестная роль');
    expect(roleLabel(container)).not.toBe('Администратор клиники');
    expect(roleLabel(container)).not.toBe('Администратор платформы');

    await unmount(root);
  });

  it('uses safe fallback when active tenant role is missing', async () => {
    mockTenant(undefined);

    const { container, root } = await renderHeader();

    expect(roleLabel(container)).toBe('Роль не назначена');
    expect(roleLabel(container)).not.toBe('Администратор');

    await unmount(root);
  });

  it('updates the visible label when active tenant role changes', async () => {
    const tenantSpy = vi.spyOn(TenantContextModule, 'useTenant');
    tenantSpy.mockReturnValue({
      activeTenant: { tenantId: 'tenant-a', tenantName: 'Clinic A', timezone: 'Asia/Almaty', role: 'clinic_admin' },
      availableTenants: [
        { tenantId: 'tenant-a', tenantName: 'Clinic A', timezone: 'Asia/Almaty', role: 'clinic_admin' },
        { tenantId: 'tenant-b', tenantName: 'Clinic B', timezone: 'Asia/Almaty', role: 'doctor' },
      ],
      setActiveTenant: vi.fn(),
      isLoading: false,
      error: null,
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<Header />);
    });

    expect(roleLabel(container)).toBe('Администратор клиники');

    tenantSpy.mockReturnValue({
      activeTenant: { tenantId: 'tenant-b', tenantName: 'Clinic B', timezone: 'Asia/Almaty', role: 'doctor' },
      availableTenants: [
        { tenantId: 'tenant-a', tenantName: 'Clinic A', timezone: 'Asia/Almaty', role: 'clinic_admin' },
        { tenantId: 'tenant-b', tenantName: 'Clinic B', timezone: 'Asia/Almaty', role: 'doctor' },
      ],
      setActiveTenant: vi.fn(),
      isLoading: false,
      error: null,
    });

    await act(async () => {
      root.render(<Header />);
    });

    expect(roleLabel(container)).toBe('Врач');

    await unmount(root);
  });
});
