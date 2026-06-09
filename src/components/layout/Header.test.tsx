// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Header } from './Header';
import * as AuthContextModule from '../../contexts/AuthContext';
import * as ScheduleContextModule from '../../hooks/useScheduleContext';
import * as ClinicDoctorsModule from '../../data/hooks/useClinicDoctors';

describe('Header Auth Behavior', () => {
  it('renders dev fallback correctly', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'dev-user-000000000000', email: 'dev@example.com' },
      isLoading: false,
      error: null,
      authMode: 'dev',
      signIn: vi.fn(),
      signOut: vi.fn()
    });

    vi.spyOn(ScheduleContextModule, 'useScheduleContext').mockReturnValue({
      selectedDate: new Date(),
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

    vi.spyOn(ClinicDoctorsModule, 'useClinicDoctors').mockReturnValue({
      doctors: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn()
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<Header />);
    });

    // Dev mode should show default name and NO logout button
    expect(container.textContent).toContain('Иван И.');
    expect(container.textContent).not.toContain('dev@example.com');
    const logoutBtn = container.querySelector('button[title="Выйти"]');
    expect(logoutBtn).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('renders real email and logout button in supabase-active mode', async () => {
    const signOutMock = vi.fn();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'real-user-123', email: 'real@example.com' },
      isLoading: false,
      error: null,
      authMode: 'supabase-active',
      signIn: vi.fn(),
      signOut: signOutMock
    });

    vi.spyOn(ScheduleContextModule, 'useScheduleContext').mockReturnValue({
      selectedDate: new Date(),
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

    vi.spyOn(ClinicDoctorsModule, 'useClinicDoctors').mockReturnValue({
      doctors: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn()
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<Header />);
    });

    // Supabase mode should show real email and logout button
    expect(container.textContent).not.toContain('Иван И.');
    expect(container.textContent).toContain('real@example.com');
    
    const logoutBtn = container.querySelector('button[title="Выйти"]') as HTMLButtonElement;
    expect(logoutBtn).not.toBeNull();

    await act(async () => {
      logoutBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(signOutMock).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });
});
