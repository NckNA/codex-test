// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useClinicDoctors } from './useClinicDoctors';
import * as AuthContext from '../../contexts/AuthContext';
import * as TenantContext from '../../contexts/TenantContext';
import * as DoctorRepository from '../repositories/DoctorRepository';

vi.mock('../../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {},
}));

vi.mock('./useAsyncQuery', () => ({
  useAsyncQuery: vi.fn(() => {
    return {
      data: [{ id: 'mocked' }],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  }),
}));

const mockCreateDoctorRepository = vi.spyOn(DoctorRepository, 'createDoctorRepository');

function TestComponent() {
  useClinicDoctors();
  return null;
}

describe('useClinicDoctors', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('routes to local backend in dev mode', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      authMode: 'dev',
    } as unknown as ReturnType<typeof AuthContext.useAuth>);
    
    vi.spyOn(TenantContext, 'useTenant').mockReturnValue({
      activeTenant: null,
    } as unknown as ReturnType<typeof TenantContext.useTenant>);

    await act(async () => {
      createRoot(container).render(<TestComponent />);
    });

    expect(mockCreateDoctorRepository).toHaveBeenCalledWith({
      backend: 'local',
      tenantId: undefined,
    });
  });

  it('routes to supabase backend when supabase-active with tenant and configured', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      authMode: 'supabase-active',
    } as unknown as ReturnType<typeof AuthContext.useAuth>);
    
    vi.spyOn(TenantContext, 'useTenant').mockReturnValue({
      activeTenant: { tenantId: 'tenant-1' },
    } as unknown as ReturnType<typeof TenantContext.useTenant>);

    await act(async () => {
      createRoot(container).render(<TestComponent />);
    });

    expect(mockCreateDoctorRepository).toHaveBeenCalledWith({
      backend: 'supabase',
      tenantId: 'tenant-1',
    });
  });

  it('routes to local safely when supabase-active but no tenant', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      authMode: 'supabase-active',
    } as unknown as ReturnType<typeof AuthContext.useAuth>);
    
    vi.spyOn(TenantContext, 'useTenant').mockReturnValue({
      activeTenant: null,
    } as unknown as ReturnType<typeof TenantContext.useTenant>);

    await act(async () => {
      createRoot(container).render(<TestComponent />);
    });

    expect(mockCreateDoctorRepository).toHaveBeenCalledWith({
      backend: 'local',
      tenantId: undefined,
    });
  });
});
