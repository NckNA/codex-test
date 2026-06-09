// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { usePatientsCollection } from './usePatientsCollection';
import * as PatientRepositoryModule from '../repositories/PatientRepository';
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

describe('usePatientsCollection', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  const renderHookTest = async (hookFn: () => unknown) => {
    let result: unknown;
    const TestComponent = () => {
      result = hookFn();
      return null;
    };
    const root = createRoot(container);
    await act(async () => {
      root.render(<TestComponent />);
    });
    return { result: result as ReturnType<typeof usePatientsCollection> };
  };

  it('renders and exposes correct public API with dev fallback', async () => {
    const factorySpy = vi.spyOn(PatientRepositoryModule, 'createPatientRepository');

    vi.mocked(useAuth).mockReturnValue({ authMode: 'dev' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1' } } as unknown as ReturnType<typeof useTenant>);

    const { result } = await renderHookTest(() => usePatientsCollection());

    expect(result).toHaveProperty('patients');
    expect(result).toHaveProperty('createPatient');
    expect(result).toHaveProperty('updatePatient');
    expect(factorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'local', tenantId: 't1' }));
  });

  it('routes to supabase when active', async () => {
    const factorySpy = vi.spyOn(PatientRepositoryModule, 'createPatientRepository');

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't2' } } as unknown as ReturnType<typeof useTenant>);

    await renderHookTest(() => usePatientsCollection());

    expect(factorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'supabase', tenantId: 't2' }));
  });

  it('routes to local if no activeTenant', async () => {
    const factorySpy = vi.spyOn(PatientRepositoryModule, 'createPatientRepository');

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);

    await renderHookTest(() => usePatientsCollection());

    expect(factorySpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'local' }));
  });
});
