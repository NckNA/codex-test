/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Appointment } from '../../types';
import { usePatientListVisitSummary } from './usePatientListVisitSummary';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { createAppointmentRepository } from '../repositories/AppointmentRepository';

vi.mock('../../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: {} }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/TenantContext', () => ({ useTenant: vi.fn() }));
vi.mock('../repositories/AppointmentRepository', () => ({ createAppointmentRepository: vi.fn() }));

const appointment = (id: string, patientId: string, start: string): Appointment => ({
  id,
  patientId,
  doctorId: 'doctor-1',
  cabinet: 'A1',
  service: 'Осмотр',
  status: 'confirmed',
  start,
  end: start,
  createdAt: start,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
};

describe('usePatientListVisitSummary', () => {
  let authState: any;
  let tenantState: any;
  let current: ReturnType<typeof usePatientListVisitSummary> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    authState = { authMode: 'supabase-active', user: { id: 'user-a' } };
    tenantState = { activeTenant: { tenantId: 'tenant-a', tenantName: 'A' } };
    vi.mocked(useAuth).mockImplementation(() => authState);
    vi.mocked(useTenant).mockImplementation(() => tenantState);
  });

  const mount = async () => {
    const root = createRoot(document.createElement('div'));
    const Harness = ({ tick = 0 }: { tick?: number }) => {
      void tick;
      current = usePatientListVisitSummary();
      return null;
    };
    await act(async () => root.render(<Harness />));
    return { root, Harness };
  };

  it('loads all tenant appointments once and groups many patients without N+1 calls', async () => {
    const list = vi.fn().mockResolvedValue([
      appointment('past-a', 'patient-a', '2020-01-01T10:00:00.000Z'),
      appointment('future-a', 'patient-a', '2099-01-01T10:00:00.000Z'),
      appointment('future-b', 'patient-b', '2099-02-01T10:00:00.000Z'),
    ]);
    vi.mocked(createAppointmentRepository).mockReturnValue({ listAppointments: list } as any);

    const { root } = await mount();

    expect(createAppointmentRepository).toHaveBeenCalledWith({ backend: 'supabase', tenantId: 'tenant-a' });
    expect(list).toHaveBeenCalledTimes(1);
    expect(current?.visitSummaryByPatientId['patient-a'].lastVisit?.toISOString()).toBe('2020-01-01T10:00:00.000Z');
    expect(current?.visitSummaryByPatientId['patient-a'].nextVisit?.toISOString()).toBe('2099-01-01T10:00:00.000Z');
    expect(current?.visitSummaryByPatientId['patient-b'].nextVisit?.toISOString()).toBe('2099-02-01T10:00:00.000Z');
    await act(async () => root.unmount());
  });

  it('uses local backend only in explicit dev mode', async () => {
    authState = { authMode: 'dev', user: { id: 'dev-user' } };
    tenantState = { activeTenant: null };
    vi.mocked(createAppointmentRepository).mockReturnValue({ listAppointments: vi.fn().mockResolvedValue([]) } as any);
    const { root } = await mount();

    expect(createAppointmentRepository).toHaveBeenCalledWith({ backend: 'local' });
    await act(async () => root.unmount());
  });

  it('does not query or expose stale local values without tenant in Supabase mode', async () => {
    tenantState = { activeTenant: null };
    const { root } = await mount();

    expect(createAppointmentRepository).not.toHaveBeenCalled();
    expect(current).toMatchObject({ visitSummaryByPatientId: {}, isLoading: false, isError: false });
    await act(async () => root.unmount());
  });

  it('clears tenant A data immediately and ignores its late response after switching to tenant B', async () => {
    const a = deferred<Appointment[]>();
    const b = deferred<Appointment[]>();
    vi.mocked(createAppointmentRepository).mockImplementation(({ tenantId }) => ({
      listAppointments: () => tenantId === 'tenant-a' ? a.promise : b.promise,
    } as any));
    const { root, Harness } = await mount();

    tenantState = { activeTenant: { tenantId: 'tenant-b', tenantName: 'B' } };
    await act(async () => root.render(<Harness tick={1} />));
    expect(current?.visitSummaryByPatientId).toEqual({});

    await act(async () => a.resolve([appointment('a', 'patient-a', '2099-01-01T10:00:00.000Z')]));
    expect(current?.visitSummaryByPatientId).toEqual({});

    await act(async () => b.resolve([appointment('b', 'patient-b', '2099-02-01T10:00:00.000Z')]));
    expect(current?.visitSummaryByPatientId['patient-b'].nextVisit).toBeDefined();
    expect(current?.visitSummaryByPatientId['patient-a']).toBeUndefined();
    await act(async () => root.unmount());
  });

  it('shows a neutral safe error and does not retry through local storage', async () => {
    vi.mocked(createAppointmentRepository).mockReturnValue({
      listAppointments: vi.fn().mockRejectedValue({ message: 'SQLSTATE 42501 public.appointments' }),
    } as any);
    const { root } = await mount();

    expect(current?.visitSummaryByPatientId).toEqual({});
    expect(current?.isError).toBe(true);
    expect(current?.error?.message).toBe('Не удалось загрузить сводку по записям.');
    expect(createAppointmentRepository).toHaveBeenCalledTimes(1);
    expect(createAppointmentRepository).not.toHaveBeenCalledWith({ backend: 'local' });
    await act(async () => root.unmount());
  });
});
