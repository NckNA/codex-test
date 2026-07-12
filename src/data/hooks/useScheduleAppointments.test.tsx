/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Appointment } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import {
  AppointmentRepositoryError,
  type IAppointmentRepository,
  type AppointmentWriteOptions,
} from '../repositories/AppointmentRepository';
import * as AppointmentRepo from '../repositories/AppointmentRepository';
import { useScheduleAppointments } from './useScheduleAppointments';

vi.mock('../../contexts/AuthContext');
vi.mock('../../contexts/TenantContext');
vi.mock('../../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {},
}));

const refetchMock = vi.fn().mockResolvedValue(undefined);
vi.mock('./useAsyncQuery', () => ({
  useAsyncQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: refetchMock,
  }),
}));

const appointment: Appointment = {
  id: '11111111-1111-4111-8111-111111111111',
  patientId: '22222222-2222-4222-8222-222222222222',
  doctorId: '33333333-3333-4333-8333-333333333333',
  cabinet: 'A1',
  service: 'Осмотр',
  status: 'new',
  paymentType: 'unpaid',
  source: 'phone',
  price: 1000,
  comment: 'Test',
  start: '2026-08-01T10:00:00',
  end: '2026-08-01T11:00:00',
  createdAt: '2026-07-01T09:00:00',
  updatedAt: '2026-07-01T09:00:00+00:00',
};

const writeResult = (value: Appointment = appointment, operationType: 'create' | 'reschedule' | 'details' = 'create') => ({
  appointment: value,
  replayed: false,
  recovered: false,
  operationType,
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

const makeRepository = (): IAppointmentRepository => ({
  listAppointmentsByPatient: vi.fn().mockResolvedValue([]),
  listAppointments: vi.fn().mockResolvedValue([]),
  createAppointment: vi.fn().mockResolvedValue(writeResult()),
  rescheduleAppointment: vi.fn().mockResolvedValue(writeResult(appointment, 'reschedule')),
  updateAppointmentDetails: vi.fn().mockResolvedValue(writeResult(appointment, 'details')),
  recoverAppointmentOperation: vi.fn().mockResolvedValue({ found: false }),
  deleteAppointment: vi.fn().mockResolvedValue(undefined),
});

interface HookHarness {
  getResult: () => ReturnType<typeof useScheduleAppointments>;
  root: Root;
  rerender: () => Promise<void>;
  unmount: () => Promise<void>;
}

const renderHook = async (): Promise<HookHarness> => {
  let result: ReturnType<typeof useScheduleAppointments> | undefined;
  const TestComponent = () => {
    result = useScheduleAppointments();
    return null;
  };
  const container = document.createElement('div');
  const root = createRoot(container);
  const rerender = async () => {
    await act(async () => root.render(<TestComponent />));
  };
  await rerender();

  return {
    getResult: () => {
      if (!result) throw new Error('Hook not rendered');
      return result;
    },
    root,
    rerender,
    unmount: async () => act(async () => root.unmount()),
  };
};

describe('useScheduleAppointments', () => {
  const createRepositorySpy = vi.spyOn(AppointmentRepo, 'createAppointmentRepository');
  let repository: IAppointmentRepository;
  let activeTenant: { tenantId: string } | null;
  let authMode: 'dev' | 'supabase-active';

  beforeEach(() => {
    vi.clearAllMocks();
    refetchMock.mockResolvedValue(undefined);
    repository = makeRepository();
    createRepositorySpy.mockReturnValue(repository);
    activeTenant = { tenantId: 'tenant-a' };
    authMode = 'supabase-active';
    vi.mocked(useAuth).mockImplementation(() => ({ authMode, user: { id: 'user-a' } } as any));
    vi.mocked(useTenant).mockImplementation(() => ({ activeTenant } as any));
  });

  it('selects Supabase only for active configured tenant and exposes hardened mutation state', async () => {
    const harness = await renderHook();

    expect(createRepositorySpy).toHaveBeenCalledWith({ backend: 'supabase', tenantId: 'tenant-a' });
    expect(harness.getResult()).toMatchObject({
      appointments: [],
      isSaving: false,
      isReconciling: false,
      saveError: null,
    });
    expect(harness.getResult()).toHaveProperty('createAppointment');
    expect(harness.getResult()).toHaveProperty('updateAppointment');
    await harness.unmount();

    authMode = 'dev';
    activeTenant = null;
    const localHarness = await renderHook();
    expect(createRepositorySpy).toHaveBeenLastCalledWith({ backend: 'local' });
    await localHarness.unmount();
  });

  it('does not select local storage when Supabase mode has no tenant', async () => {
    activeTenant = null;
    const harness = await renderHook();

    expect(createRepositorySpy).not.toHaveBeenCalled();
    expect(harness.getResult()).toMatchObject({ appointments: [], isLoading: false });
    expect(() => harness.getResult().createAppointment(appointment)).toThrow('Клиника не выбрана.');
    await harness.unmount();
  });

  it('rapid duplicate create calls share one logical operation, one key, and one refetch', async () => {
    const save = deferred<ReturnType<typeof writeResult>>();
    const create = vi.fn((value: Appointment, options: AppointmentWriteOptions) => {
      void value;
      void options;
      return save.promise;
    });
    repository.createAppointment = create;
    const harness = await renderHook();

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = harness.getResult().createAppointment(appointment);
      second = harness.getResult().createAppointment(appointment);
      await Promise.resolve();
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(create.mock.calls[0][1].operationKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(harness.getResult().isSaving).toBe(true);

    await act(async () => save.resolve(writeResult()));
    await expect(first).resolves.toMatchObject({ appointment: { id: appointment.id } });
    expect(refetchMock).toHaveBeenCalledTimes(1);
    expect(harness.getResult().isSaving).toBe(false);
    await harness.unmount();
  });

  it('retains the same operation key when an ambiguous attempt is retried', async () => {
    const keys: string[] = [];
    const create = vi.fn()
      .mockImplementationOnce((_value: Appointment, options: AppointmentWriteOptions) => {
        keys.push(options.operationKey);
        return Promise.reject(new AppointmentRepositoryError(
          'generic',
          'Не удалось сохранить запись. Обновите расписание и проверьте результат.',
          true,
        ));
      })
      .mockImplementationOnce((_value: Appointment, options: AppointmentWriteOptions) => {
        keys.push(options.operationKey);
        return Promise.resolve(writeResult());
      });
    repository.createAppointment = create;
    const harness = await renderHook();

    await act(async () => {
      await expect(harness.getResult().createAppointment(appointment)).rejects.toMatchObject({ ambiguous: true });
    });
    await act(async () => {
      await expect(harness.getResult().createAppointment(appointment)).resolves.toMatchObject({ appointment: { id: appointment.id } });
    });

    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    expect(refetchMock).toHaveBeenCalledTimes(1);
    await harness.unmount();
  });

  it('routes protected changes to reschedule RPC and details-only changes to details RPC', async () => {
    const reschedule = vi.fn().mockResolvedValue(writeResult(appointment, 'reschedule'));
    const details = vi.fn().mockResolvedValue(writeResult(appointment, 'details'));
    repository.rescheduleAppointment = reschedule;
    repository.updateAppointmentDetails = details;
    const harness = await renderHook();

    const moved = { ...appointment, start: '2026-08-01T11:00:00', end: '2026-08-01T12:00:00' };
    await act(async () => {
      await harness.getResult().updateAppointment(appointment, moved);
    });
    expect(reschedule).toHaveBeenCalledTimes(1);
    expect(reschedule.mock.calls[0][2].operationKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(details).not.toHaveBeenCalled();

    await act(async () => {
      await harness.getResult().updateAppointment(appointment, { ...appointment, comment: 'Details' });
    });
    expect(details).toHaveBeenCalledTimes(1);
    expect(reschedule).toHaveBeenCalledTimes(1);
    expect(refetchMock).toHaveBeenCalledTimes(2);
    await harness.unmount();
  });

  it('shows reconciliation state while repository checks an uncertain result', async () => {
    const recovery = deferred<ReturnType<typeof writeResult>>();
    repository.createAppointment = vi.fn((_value, options) => {
      options.onRecoveryStateChange?.(true);
      return recovery.promise.finally(() => options.onRecoveryStateChange?.(false));
    });
    const harness = await renderHook();

    let pending!: Promise<unknown>;
    await act(async () => {
      pending = harness.getResult().createAppointment(appointment);
      await Promise.resolve();
    });
    expect(harness.getResult().isSaving).toBe(true);
    expect(harness.getResult().isReconciling).toBe(true);

    await act(async () => recovery.resolve({ ...writeResult(), recovered: true, replayed: true }));
    await pending;
    expect(harness.getResult().isSaving).toBe(false);
    expect(harness.getResult().isReconciling).toBe(false);
    await harness.unmount();
  });

  it('ignores stale success after tenant context changes and does not refresh the new tenant', async () => {
    const save = deferred<ReturnType<typeof writeResult>>();
    repository.createAppointment = vi.fn(() => save.promise);
    const harness = await renderHook();

    let pending!: Promise<unknown>;
    await act(async () => {
      pending = harness.getResult().createAppointment(appointment);
      await Promise.resolve();
    });

    activeTenant = { tenantId: 'tenant-b' };
    await harness.rerender();
    expect(createRepositorySpy).toHaveBeenLastCalledWith({ backend: 'supabase', tenantId: 'tenant-b' });
    expect(harness.getResult().isSaving).toBe(false);

    await act(async () => save.resolve(writeResult()));
    await expect(pending).resolves.toBeNull();
    expect(refetchMock).not.toHaveBeenCalled();
    expect(harness.getResult().saveError).toBeNull();
    await harness.unmount();
  });

  it('stores safe server conflict and does not refresh after failure', async () => {
    repository.createAppointment = vi.fn().mockRejectedValue(
      new AppointmentRepositoryError('patient_conflict', 'У пациента уже есть другая запись на это время.'),
    );
    const harness = await renderHook();

    await act(async () => {
      await expect(harness.getResult().createAppointment(appointment)).rejects.toThrow('У пациента уже есть другая запись');
    });

    expect(harness.getResult().saveError?.message).toBe('У пациента уже есть другая запись на это время.');
    expect(refetchMock).not.toHaveBeenCalled();
    await harness.unmount();
  });
});
