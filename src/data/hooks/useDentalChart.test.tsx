// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useDentalChart } from './useDentalChart';
import * as DentalChartRepositoryModule from '../repositories/DentalChartRepository';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useAsyncQuery } from './useAsyncQuery';

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

vi.mock('./useAsyncQuery', () => ({
  useAsyncQuery: vi.fn().mockReturnValue({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe('useDentalChart', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('routes to supabase backend when authMode is supabase-active, activeTenant exists, and supabase is configured', async () => {
    const factorySpy = vi.spyOn(DentalChartRepositoryModule, 'createDentalChartRepository');

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 'real-tenant-id', tenantName: 'Clinic' } } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      useDentalChart('patient_1');
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

  it('routes to local backend when authMode is dev', async () => {
    const factorySpy = vi.spyOn(DentalChartRepositoryModule, 'createDentalChartRepository');

    vi.mocked(useAuth).mockReturnValue({ authMode: 'dev' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 'real-tenant-id', tenantName: 'Clinic' } } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      useDentalChart('patient_1');
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(factorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'local', tenantId: 'real-tenant-id' }));

    await act(async () => {
      root.unmount();
    });
  });

  it('creates local repository but blocks operations when no active tenant in supabase-active mode', async () => {
    const factorySpy = vi.spyOn(DentalChartRepositoryModule, 'createDentalChartRepository');
    const mockRepo = {
      getDentalChart: vi.fn(),
      saveDentalChart: vi.fn(),
    };
    factorySpy.mockReturnValue(mockRepo as unknown as ReturnType<typeof DentalChartRepositoryModule.createDentalChartRepository>);

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);

    let hookResult: ReturnType<typeof useDentalChart>;

    const TestComponent = () => {
      hookResult = useDentalChart('patient_1');
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    // It instantiates local repo
    expect(factorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'local', tenantId: undefined }));

    // But fails safely on write
    await expect(hookResult!.saveDentalChart({} as never)).rejects.toThrow("Active clinic is required for Supabase data access.");
    expect(mockRepo.saveDentalChart).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('immediately exposes null chart even if query had previous data when transitioning to no-tenant', async () => {
    vi.mocked(useAsyncQuery).mockReturnValueOnce({
      data: { id: 'old-chart', patientId: 'patient_1', toothStates: [] },
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);

    let hookResult: ReturnType<typeof useDentalChart>;

    const TestComponent = () => {
      hookResult = useDentalChart('patient_1');
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(hookResult!.dentalChart).toBeNull();
    expect(hookResult!.isLoading).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });
});
