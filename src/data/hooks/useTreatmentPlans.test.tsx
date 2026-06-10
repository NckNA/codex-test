// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useTreatmentPlans } from './useTreatmentPlans';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import * as TreatmentPlansRepositoryModule from '../repositories/TreatmentPlansRepository';
import * as SupabaseClientModule from '../../lib/supabaseClient';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../contexts/TenantContext', () => ({
  useTenant: vi.fn(),
}));

vi.mock('../../lib/supabaseClient', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));

vi.mock('./useAsyncQuery', () => ({
  useAsyncQuery: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe('useTreatmentPlans hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('routes to local backend when authMode is dev', async () => {
    const factorySpy = vi.spyOn(TreatmentPlansRepositoryModule, 'createTreatmentPlansRepository');

    // Override isSupabaseConfigured dynamically using Object.defineProperty since it's a mocked export
    Object.defineProperty(SupabaseClientModule, 'isSupabaseConfigured', { value: false, configurable: true });

    vi.mocked(useAuth).mockReturnValue({ authMode: 'dev' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      useTreatmentPlans('patient_1');
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

  it('routes to local backend if Supabase is active but not configured', async () => {
    const factorySpy = vi.spyOn(TreatmentPlansRepositoryModule, 'createTreatmentPlansRepository');

    Object.defineProperty(SupabaseClientModule, 'isSupabaseConfigured', { value: false, configurable: true });

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 'tenant-1', tenantName: 'Clinic' } } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      useTreatmentPlans('patient_1');
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

  it('routes to local backend if Supabase is active but no tenant selected', async () => {
    const factorySpy = vi.spyOn(TreatmentPlansRepositoryModule, 'createTreatmentPlansRepository');

    Object.defineProperty(SupabaseClientModule, 'isSupabaseConfigured', { value: true, configurable: true });

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      useTreatmentPlans('patient_1');
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

  it('routes to Supabase backend when supabase-active, configured, and tenant selected', async () => {
    const factorySpy = vi.spyOn(TreatmentPlansRepositoryModule, 'createTreatmentPlansRepository');

    Object.defineProperty(SupabaseClientModule, 'isSupabaseConfigured', { value: true, configurable: true });

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 'tenant-1', tenantName: 'Clinic' } } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      useTreatmentPlans('patient_1');
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(factorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'supabase', tenantId: 'tenant-1' }));

    await act(async () => {
      root.unmount();
    });
  });
});
