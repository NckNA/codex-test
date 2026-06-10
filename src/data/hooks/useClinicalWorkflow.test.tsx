// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useClinicalWorkflow } from './useClinicalWorkflow';
import * as DentalChartRepositoryModule from '../repositories/DentalChartRepository';
import * as FindingsRepositoryModule from '../repositories/FindingsRepository';
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

describe('useClinicalWorkflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('routes to supabase repositories when authMode is supabase-active, activeTenant exists, and supabase is configured', async () => {
    const dentalChartFactorySpy = vi.spyOn(DentalChartRepositoryModule, 'createDentalChartRepository');
    const findingsFactorySpy = vi.spyOn(FindingsRepositoryModule, 'createFindingsRepository');

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 'real-tenant-id', tenantName: 'Clinic' } } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      useClinicalWorkflow();
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(dentalChartFactorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'supabase', tenantId: 'real-tenant-id' }));
    expect(findingsFactorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'supabase', tenantId: 'real-tenant-id' }));

    await act(async () => {
      root.unmount();
    });
  });

  it('routes to local backend when authMode is dev', async () => {
    const dentalChartFactorySpy = vi.spyOn(DentalChartRepositoryModule, 'createDentalChartRepository');
    const findingsFactorySpy = vi.spyOn(FindingsRepositoryModule, 'createFindingsRepository');

    vi.mocked(useAuth).mockReturnValue({ authMode: 'dev' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 'real-tenant-id', tenantName: 'Clinic' } } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      useClinicalWorkflow();
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(dentalChartFactorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'local', tenantId: 'real-tenant-id' }));
    expect(findingsFactorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'local', tenantId: 'real-tenant-id' }));

    await act(async () => {
      root.unmount();
    });
  });

  it('routes to local backend when no active tenant', async () => {
    const dentalChartFactorySpy = vi.spyOn(DentalChartRepositoryModule, 'createDentalChartRepository');
    const findingsFactorySpy = vi.spyOn(FindingsRepositoryModule, 'createFindingsRepository');

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      useClinicalWorkflow();
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(dentalChartFactorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'local', tenantId: undefined }));
    expect(findingsFactorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'local', tenantId: undefined }));

    await act(async () => {
      root.unmount();
    });
  });
});
