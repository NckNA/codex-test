// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useChiefComplaint } from './useChiefComplaint';
import * as ChiefComplaintRepositoryModule from '../repositories/ChiefComplaintRepository';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {},
  isSupabaseConfigured: true,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../contexts/TenantContext', () => ({
  useTenant: vi.fn(),
}));

describe('useChiefComplaint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders and exposes the correct public API and defaults to local backend in dev mode', async () => {
    const factorySpy = vi.spyOn(ChiefComplaintRepositoryModule, 'createChiefComplaintRepository');

    vi.mocked(useAuth).mockReturnValue({ authMode: 'dev' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: '123', tenantName: 'Dev', timezone: 'Asia/Almaty'} } as unknown as ReturnType<typeof useTenant>);

    let hookResult: ReturnType<typeof useChiefComplaint> | undefined;

    const TestComponent = () => {
      hookResult = useChiefComplaint('patient_1');
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(hookResult).toBeDefined();
    
    // Assert public API shape
    expect(hookResult).toHaveProperty('complaint');
    expect(hookResult).toHaveProperty('isLoading');
    expect(hookResult).toHaveProperty('isError');
    expect(hookResult).toHaveProperty('error');
    expect(hookResult).toHaveProperty('isSaving');
    expect(typeof hookResult!.refetch).toBe('function');
    expect(typeof hookResult!.saveComplaint).toBe('function');
    
    // Dev auth mode should always use local backend even if supabase env is configured
    expect(factorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'local', tenantId: '123' }));

    await act(async () => {
      root.unmount();
    });
  });

  it('routes to supabase backend when authMode is supabase-active, activeTenant exists, and supabase is configured', async () => {
    const factorySpy = vi.spyOn(ChiefComplaintRepositoryModule, 'createChiefComplaintRepository');

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 'real-tenant-id', tenantName: 'Clinic', timezone: 'Asia/Almaty'} } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      useChiefComplaint('patient_1');
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(factorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'supabase', tenantId: 'real-tenant-id' }));

    await act(async () => {
      root.unmount();
    });
  });

  it('routes to local backend when authMode is supabase-active but activeTenant is missing', async () => {
    const factorySpy = vi.spyOn(ChiefComplaintRepositoryModule, 'createChiefComplaintRepository');

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      useChiefComplaint('patient_1');
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(factorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'local' }));

    await act(async () => {
      root.unmount();
    });
  });
});
