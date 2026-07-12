/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Appointment } from '../../types';
import { usePatientAppointments } from './usePatientAppointments';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { createAppointmentRepository } from '../repositories/AppointmentRepository';

vi.mock('../../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {},
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/TenantContext', () => ({ useTenant: vi.fn() }));
vi.mock('../repositories/AppointmentRepository', () => ({
  createAppointmentRepository: vi.fn(),
}));

const makeAppointment = (id: string, patientId: string, status: Appointment['status'] = 'confirmed'): Appointment => ({
  id,
  patientId,
  doctorId: 'doctor-1',
  cabinet: 'A1',
  service: 'Осмотр',
  status,
  start: '2026-08-01T10:00:00',
  end: '2026-08-01T11:00:00',
  createdAt: '2026-07-01T09:00:00',
  updatedAt: '2026-07-01T09:00:00+00:00',
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('usePatientAppointments', () => {
  let authState: any;
  let tenantState: any;
  let current: ReturnType<typeof usePatientAppointments> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    authState = { authMode: 'supabase-active', user: { id: 'user-a' } };
    tenantState = { activeTenant: { tenantId: 'tenant-a', tenantName: 'A', timezone: 'Asia/Almaty'} };
    vi.mocked(useAuth).mockImplementation(() => authState);
    vi.mocked(useTenant).mockImplementation(() => tenantState);
  });

  const mount = async (patientId: string) => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const Harness = ({ id, tick = 0 }: { id: string; tick?: number }) => {
      void tick;
      current = usePatientAppointments(id);
      return null;
    };
    await act(async () => {
      root.render(<Harness id={patientId} />);
    });
    return { root, Harness };
  };

  it('uses the Supabase repository with tenant scope and retains cancelled history rows', async () => {
    const list = vi.fn().mockResolvedValue([makeAppointment('cancelled', 'patient-a', 'cancelled')]);
    vi.mocked(createAppointmentRepository).mockReturnValue({ listAppointmentsByPatient: list } as any);

    const { root } = await mount('patient-a');

    expect(createAppointmentRepository).toHaveBeenCalledWith({ backend: 'supabase', tenantId: 'tenant-a' });
    expect(list).toHaveBeenCalledWith('patient-a');
    expect(current?.appointments[0].status).toBe('cancelled');
    await act(async () => root.unmount());
  });

  it('uses local repository only in explicit dev mode', async () => {
    authState = { authMode: 'dev', user: { id: 'dev-user' } };
    tenantState = { activeTenant: null };
    const list = vi.fn().mockResolvedValue([]);
    vi.mocked(createAppointmentRepository).mockReturnValue({ listAppointmentsByPatient: list } as any);

    const { root } = await mount('patient-a');

    expect(createAppointmentRepository).toHaveBeenCalledWith({ backend: 'local' });
    expect(list).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it('does not create a repository or fetch without tenant in Supabase mode', async () => {
    tenantState = { activeTenant: null };
    const { root } = await mount('patient-a');

    expect(createAppointmentRepository).not.toHaveBeenCalled();
    expect(current).toMatchObject({ appointments: [], isLoading: false, isError: false });
    await act(async () => root.unmount());
  });

  it('does not fetch without a patient id', async () => {
    const list = vi.fn().mockResolvedValue([]);
    vi.mocked(createAppointmentRepository).mockReturnValue({ listAppointmentsByPatient: list } as any);
    const { root } = await mount('');

    expect(list).not.toHaveBeenCalled();
    expect(current?.appointments).toEqual([]);
    await act(async () => root.unmount());
  });

  it('refetches on patient change and clears the previous patient immediately', async () => {
    const list = vi.fn((patientId: string) => Promise.resolve([makeAppointment(patientId, patientId)]));
    vi.mocked(createAppointmentRepository).mockReturnValue({ listAppointmentsByPatient: list } as any);
    const { root, Harness } = await mount('patient-a');
    expect(current?.appointments[0].patientId).toBe('patient-a');

    await act(async () => {
      root.render(<Harness id="patient-b" tick={1} />);
    });

    expect(list).toHaveBeenLastCalledWith('patient-b');
    expect(current?.appointments[0].patientId).toBe('patient-b');
    await act(async () => root.unmount());
  });

  it('ignores a stale patient response that arrives after navigation', async () => {
    const patientA = deferred<Appointment[]>();
    const patientB = deferred<Appointment[]>();
    const list = vi.fn((patientId: string) => patientId === 'patient-a' ? patientA.promise : patientB.promise);
    vi.mocked(createAppointmentRepository).mockReturnValue({ listAppointmentsByPatient: list } as any);
    const { root, Harness } = await mount('patient-a');

    await act(async () => {
      root.render(<Harness id="patient-b" tick={1} />);
    });
    expect(current?.appointments).toEqual([]);

    await act(async () => patientA.resolve([makeAppointment('a', 'patient-a')]));
    expect(current?.appointments).toEqual([]);

    await act(async () => patientB.resolve([makeAppointment('b', 'patient-b')]));
    expect(current?.appointments[0].patientId).toBe('patient-b');
    await act(async () => root.unmount());
  });

  it('ignores a stale tenant response and loads the new tenant repository', async () => {
    const tenantA = deferred<Appointment[]>();
    const tenantB = deferred<Appointment[]>();
    const listA = vi.fn(() => tenantA.promise);
    const listB = vi.fn(() => tenantB.promise);
    vi.mocked(createAppointmentRepository).mockImplementation(({ tenantId }) => (
      { listAppointmentsByPatient: tenantId === 'tenant-a' ? listA : listB } as any
    ));
    const { root, Harness } = await mount('patient-a');

    tenantState = { activeTenant: { tenantId: 'tenant-b', tenantName: 'B', timezone: 'Asia/Almaty'} };
    await act(async () => root.render(<Harness id="patient-a" tick={1} />));
    expect(current?.appointments).toEqual([]);

    await act(async () => tenantA.resolve([makeAppointment('a', 'patient-a')]));
    expect(current?.appointments).toEqual([]);

    await act(async () => tenantB.resolve([makeAppointment('b', 'patient-a')]));
    expect(current?.appointments[0].id).toBe('b');
    expect(createAppointmentRepository).toHaveBeenLastCalledWith({ backend: 'supabase', tenantId: 'tenant-b' });
    await act(async () => root.unmount());
  });

  it('exposes a safe error and never falls back to local data', async () => {
    const list = vi.fn().mockRejectedValue({ message: 'SQLSTATE 42501 public.appointments' });
    vi.mocked(createAppointmentRepository).mockReturnValue({ listAppointmentsByPatient: list } as any);
    const { root } = await mount('patient-a');

    expect(current?.isError).toBe(true);
    expect(current?.error?.message).toBe('Не удалось загрузить записи пациента.');
    expect(createAppointmentRepository).toHaveBeenCalledTimes(1);
    expect(createAppointmentRepository).not.toHaveBeenCalledWith({ backend: 'local' });
    await act(async () => root.unmount());
  });

  it('reports loading and empty states without stale data', async () => {
    const pending = deferred<Appointment[]>();
    vi.mocked(createAppointmentRepository).mockReturnValue({ listAppointmentsByPatient: () => pending.promise } as any);
    const { root } = await mount('patient-a');
    expect(current).toMatchObject({ appointments: [], isLoading: true, isError: false });

    await act(async () => pending.resolve([]));
    expect(current).toMatchObject({ appointments: [], isLoading: false, isError: false });
    await act(async () => root.unmount());
  });

  it('ignores a late result after unmount', async () => {
    const pending = deferred<Appointment[]>();
    vi.mocked(createAppointmentRepository).mockReturnValue({ listAppointmentsByPatient: () => pending.promise } as any);
    const { root } = await mount('patient-a');
    await act(async () => root.unmount());
    await expect(act(async () => pending.resolve([makeAppointment('late', 'patient-a')]))).resolves.toBeUndefined();
  });
});
