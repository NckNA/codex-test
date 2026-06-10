// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useDentalChart } from './useDentalChart';
import * as DentalChartRepositoryModule from '../repositories/DentalChartRepository';
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

  it('routes to local backend when no active tenant', async () => {
    const factorySpy = vi.spyOn(DentalChartRepositoryModule, 'createDentalChartRepository');

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      useDentalChart('patient_1');
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(factorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'local', tenantId: undefined }));

    await act(async () => {
      root.unmount();
    });
  });
});
