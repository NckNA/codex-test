/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePatientMedicalSummary } from './usePatientMedicalSummary';
import * as ClinicalSummary from '../aggregators/ClinicalSummaryAggregator';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/TenantContext', () => ({ useTenant: vi.fn() }));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
};

const summary = (amount: number): ClinicalSummary.PatientMedicalSummaryData => ({
  dentalSummary: {
    ...ClinicalSummary.EMPTY_PATIENT_DENTAL_SUMMARY,
    totalAmount: amount,
  },
});

describe('usePatientMedicalSummary', () => {
  let authState: any;
  let tenantState: any;
  let current: ReturnType<typeof usePatientMedicalSummary> | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    authState = { authMode: 'supabase-active', user: { id: 'user-a' } };
    tenantState = { activeTenant: { tenantId: 'tenant-a', tenantName: 'A' } };
    vi.mocked(useAuth).mockImplementation(() => authState);
    vi.mocked(useTenant).mockImplementation(() => tenantState);
  });

  const mount = async (patientId: string) => {
    const root = createRoot(document.createElement('div'));
    const Harness = ({ id, tick = 0 }: { id: string; tick?: number }) => {
      void tick;
      current = usePatientMedicalSummary(id);
      return null;
    };
    await act(async () => root.render(<Harness id={patientId} />));
    return { root, Harness };
  };

  it('uses Supabase only with an authenticated tenant context', async () => {
    const spy = vi.spyOn(ClinicalSummary, 'getPatientMedicalSummary').mockResolvedValue(summary(100));
    const { root } = await mount('patient-a');

    expect(spy).toHaveBeenCalledWith('patient-a', { backend: 'supabase', tenantId: 'tenant-a' });
    expect(current?.data.dentalSummary.totalAmount).toBe(100);
    await act(async () => root.unmount());
  });

  it('does not fall back to local storage without tenant in Supabase mode', async () => {
    tenantState = { activeTenant: null };
    const spy = vi.spyOn(ClinicalSummary, 'getPatientMedicalSummary').mockResolvedValue(summary(999));
    const { root } = await mount('patient-a');

    expect(spy).not.toHaveBeenCalled();
    expect(current).toMatchObject({
      data: ClinicalSummary.EMPTY_PATIENT_MEDICAL_SUMMARY,
      isLoading: false,
      isError: false,
    });
    await act(async () => root.unmount());
  });

  it('uses local backend only in explicit dev mode', async () => {
    authState = { authMode: 'dev', user: { id: 'dev-user' } };
    tenantState = { activeTenant: { tenantId: 'dev-tenant', tenantName: 'Dev' } };
    const spy = vi.spyOn(ClinicalSummary, 'getPatientMedicalSummary').mockResolvedValue(summary(200));
    const { root } = await mount('patient-a');

    expect(spy).toHaveBeenCalledWith('patient-a', { backend: 'local', tenantId: 'dev-tenant' });
    await act(async () => root.unmount());
  });

  it('clears stale patient data and ignores a late response', async () => {
    const a = deferred<ClinicalSummary.PatientMedicalSummaryData>();
    const b = deferred<ClinicalSummary.PatientMedicalSummaryData>();
    vi.spyOn(ClinicalSummary, 'getPatientMedicalSummary')
      .mockImplementation((patientId) => patientId === 'patient-a' ? a.promise : b.promise);
    const { root, Harness } = await mount('patient-a');

    await act(async () => root.render(<Harness id="patient-b" tick={1} />));
    expect(current?.data).toEqual(ClinicalSummary.EMPTY_PATIENT_MEDICAL_SUMMARY);

    await act(async () => a.resolve(summary(111)));
    expect(current?.data).toEqual(ClinicalSummary.EMPTY_PATIENT_MEDICAL_SUMMARY);

    await act(async () => b.resolve(summary(222)));
    expect(current?.data.dentalSummary.totalAmount).toBe(222);
    await act(async () => root.unmount());
  });

  it('clears stale tenant data and ignores a late response', async () => {
    const a = deferred<ClinicalSummary.PatientMedicalSummaryData>();
    const b = deferred<ClinicalSummary.PatientMedicalSummaryData>();
    vi.spyOn(ClinicalSummary, 'getPatientMedicalSummary')
      .mockImplementation((_patientId, config) => config.tenantId === 'tenant-a' ? a.promise : b.promise);
    const { root, Harness } = await mount('patient-a');

    tenantState = { activeTenant: { tenantId: 'tenant-b', tenantName: 'B' } };
    await act(async () => root.render(<Harness id="patient-a" tick={1} />));
    expect(current?.data).toEqual(ClinicalSummary.EMPTY_PATIENT_MEDICAL_SUMMARY);

    await act(async () => a.resolve(summary(111)));
    expect(current?.data).toEqual(ClinicalSummary.EMPTY_PATIENT_MEDICAL_SUMMARY);

    await act(async () => b.resolve(summary(222)));
    expect(current?.data.dentalSummary.totalAmount).toBe(222);
    await act(async () => root.unmount());
  });

  it('clears data when the Supabase session ends during a request', async () => {
    const pending = deferred<ClinicalSummary.PatientMedicalSummaryData>();
    const spy = vi.spyOn(ClinicalSummary, 'getPatientMedicalSummary').mockReturnValue(pending.promise);
    const { root, Harness } = await mount('patient-a');

    authState = { authMode: 'supabase-active', user: null };
    await act(async () => root.render(<Harness id="patient-a" tick={1} />));
    expect(current).toMatchObject({ data: ClinicalSummary.EMPTY_PATIENT_MEDICAL_SUMMARY, isLoading: false });

    await act(async () => pending.resolve(summary(999)));
    expect(current?.data).toEqual(ClinicalSummary.EMPTY_PATIENT_MEDICAL_SUMMARY);
    expect(spy).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it('maps failures to a safe summary error without fallback', async () => {
    vi.spyOn(ClinicalSummary, 'getPatientMedicalSummary')
      .mockRejectedValue({ message: 'SQLSTATE 42501 public.appointments' });
    const { root } = await mount('patient-a');

    expect(current?.data).toEqual(ClinicalSummary.EMPTY_PATIENT_MEDICAL_SUMMARY);
    expect(current?.isError).toBe(true);
    expect(current?.error?.message).toBe('Не удалось загрузить сводку пациента.');
    await act(async () => root.unmount());
  });
});
