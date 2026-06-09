/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useScheduleAppointments } from './useScheduleAppointments';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import * as AppointmentRepo from '../repositories/AppointmentRepository';

vi.mock('../../contexts/AuthContext');
vi.mock('../../contexts/TenantContext');
vi.mock('../../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {}
}));
vi.mock('./useAsyncQuery', () => ({
  useAsyncQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
}));

describe('useScheduleAppointments', () => {
  const mockCreateRepo = vi.spyOn(AppointmentRepo, 'createAppointmentRepository');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderTestHook = async () => {
    let hookResult: ReturnType<typeof useScheduleAppointments> | undefined;
    const TestComponent = () => {
      hookResult = useScheduleAppointments();
      return null;
    };
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(<TestComponent />);
    });
    return { hookResult, root };
  };

  it('routes to local when authMode is dev', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'dev' } as any);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1' } } as any);

    const { root } = await renderTestHook();
    
    expect(mockCreateRepo).toHaveBeenCalledWith({
      backend: 'local',
      tenantId: 't1'
    });
    
    await act(async () => { root.unmount(); });
  });

  it('routes to supabase when authMode is supabase-active with tenant and config', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as any);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1' } } as any);

    const { root } = await renderTestHook();
    
    expect(mockCreateRepo).toHaveBeenCalledWith({
      backend: 'supabase',
      tenantId: 't1'
    });
    
    await act(async () => { root.unmount(); });
  });

  it('routes to local when authMode is supabase-active but no tenant', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as any);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as any);

    const { root } = await renderTestHook();
    
    expect(mockCreateRepo).toHaveBeenCalledWith({
      backend: 'local',
      tenantId: undefined
    });
    
    await act(async () => { root.unmount(); });
  });

  it('returns expected API', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'dev' } as any);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as any);

    const { hookResult, root } = await renderTestHook();
    
    expect(hookResult).toBeDefined();
    expect(hookResult).toHaveProperty('appointments');
    expect(hookResult).toHaveProperty('createAppointment');
    expect(hookResult).toHaveProperty('updateAppointment');
    expect(hookResult).toHaveProperty('deleteAppointment');
    expect(hookResult).toHaveProperty('isLoading');
    expect(hookResult).toHaveProperty('isSaving');
    
    await act(async () => { root.unmount(); });
  });
});
