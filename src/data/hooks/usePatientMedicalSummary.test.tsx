// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { usePatientMedicalSummary } from './usePatientMedicalSummary';
import * as ClinicalSummaryAggregatorModule from '../aggregators/ClinicalSummaryAggregator';
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

describe('usePatientMedicalSummary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('routes to supabase backend when authMode is supabase-active, activeTenant exists, and supabase is configured', async () => {
    const aggregatorSpy = vi.spyOn(ClinicalSummaryAggregatorModule, 'getPatientMedicalSummary').mockResolvedValue(ClinicalSummaryAggregatorModule.EMPTY_PATIENT_MEDICAL_SUMMARY);

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 'real-tenant-id', tenantName: 'Clinic' } } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      usePatientMedicalSummary('patient_1');
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(aggregatorSpy).toHaveBeenCalledWith('patient_1', expect.objectContaining({ backend: 'supabase', tenantId: 'real-tenant-id' }));

    await act(async () => {
      root.unmount();
    });
  });

  it('routes to local backend when authMode is supabase-active but activeTenant is missing', async () => {
    const aggregatorSpy = vi.spyOn(ClinicalSummaryAggregatorModule, 'getPatientMedicalSummary').mockResolvedValue(ClinicalSummaryAggregatorModule.EMPTY_PATIENT_MEDICAL_SUMMARY);

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      usePatientMedicalSummary('patient_1');
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(aggregatorSpy).toHaveBeenCalledWith('patient_1', expect.objectContaining({ backend: 'local' }));

    await act(async () => {
      root.unmount();
    });
  });

  it('routes to local backend when authMode is dev', async () => {
    const aggregatorSpy = vi.spyOn(ClinicalSummaryAggregatorModule, 'getPatientMedicalSummary').mockResolvedValue(ClinicalSummaryAggregatorModule.EMPTY_PATIENT_MEDICAL_SUMMARY);

    vi.mocked(useAuth).mockReturnValue({ authMode: 'dev' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: '123', tenantName: 'Dev' } } as unknown as ReturnType<typeof useTenant>);

    const TestComponent = () => {
      usePatientMedicalSummary('patient_1');
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(aggregatorSpy).toHaveBeenCalledWith('patient_1', expect.objectContaining({ backend: 'local', tenantId: '123' }));

    await act(async () => {
      root.unmount();
    });
  });
});
