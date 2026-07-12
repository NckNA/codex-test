/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import type { AppointmentReminderOperationResult, AppointmentReminderQueueItem } from '../../types';
import {
  AppointmentReminderRepositoryError,
  createAppointmentReminderRepository,
} from '../repositories/AppointmentReminderRepository';
import { useAppointmentReminderQueue } from './useAppointmentReminderQueue';

vi.mock('../../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: {} }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/TenantContext', () => ({ useTenant: vi.fn() }));
vi.mock('../repositories/AppointmentReminderRepository', async () => {
  const actual = await vi.importActual('../repositories/AppointmentReminderRepository');
  return { ...actual as object, createAppointmentReminderRepository: vi.fn() };
});

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const patientId = '33333333-3333-4333-8333-333333333333';
const appointmentId = '44444444-4444-4444-8444-444444444444';
const jobId = '55555555-5555-4555-8555-555555555555';

const makeItem = (id = jobId, tenantId = tenantA, state: 'scheduled' | 'completed' = 'scheduled'): AppointmentReminderQueueItem => ({
  job: {
    id,
    tenantId,
    appointmentId,
    patientId,
    reminderType: 'confirmation_request',
    executionMode: 'manual',
    dueAt: '2026-07-12T09:00:00+00:00',
    originalDueAt: '2026-07-12T09:00:00+00:00',
    state,
    operationalState: state === 'scheduled' ? 'ready' : state,
    appointmentUpdatedAt: '2026-07-11T08:00:00.123456+00:00',
    policyVersion: 2,
    planKey: 'a'.repeat(64),
    payloadFingerprint: 'b'.repeat(64),
    priority: 50,
    createdAt: '2026-07-11T08:00:00+00:00',
    updatedAt: '2026-07-11T08:00:00.123456+00:00',
    completedAt: state === 'completed' ? '2026-07-12T10:00:00+00:00' : undefined,
    completedBy: state === 'completed' ? 'user-a' : undefined,
    completionOutcome: state === 'completed' ? 'no_answer' : undefined,
    terminalReason: state === 'completed' ? 'manual_completed' : undefined,
    metadata: {},
  },
  appointment: {
    id: appointmentId,
    patientId,
    doctorId: 'doctor-a',
    cabinet: 'A1',
    service: 'Осмотр',
    status: 'new',
    start: '2026-07-20T10:00:00+00:00',
    end: '2026-07-20T11:00:00+00:00',
    confirmationState: 'unconfirmed',
    confirmationAttemptCount: 0,
    createdAt: '2026-07-01T09:00:00+00:00',
    updatedAt: '2026-07-11T08:00:00.123456+00:00',
  },
  patient: { id: patientId, fullName: 'Пациент Тестовый', phone: '+77000000000' },
  doctor: { id: 'doctor-a', fullName: 'Врач Тестовый', specialization: 'Терапевт', cabinet: 'A1' },
  attemptCount: 0,
});

const makeResult = (item = makeItem(jobId, tenantA, 'completed')): AppointmentReminderOperationResult => ({
  job: item.job,
  appointment: item.appointment,
  replayed: false,
  recovered: false,
  operationType: 'reminder_complete',
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const makeRepository = () => ({
  listActiveReminderJobs: vi.fn().mockResolvedValue([makeItem()]),
  listReminderJobHistory: vi.fn().mockResolvedValue([]),
  listReminderJobs: vi.fn(),
  listReminderJobsByAppointment: vi.fn(),
  planAppointmentReminderJobs: vi.fn(),
  reconcileTenantReminderJobs: vi.fn(),
  completeReminderJob: vi.fn().mockResolvedValue(makeResult()),
  deferReminderJob: vi.fn().mockResolvedValue({ ...makeResult(), operationType: 'reminder_defer' }),
  skipReminderJob: vi.fn().mockResolvedValue({ ...makeResult(), operationType: 'reminder_skip' }),
  getReminderOperation: vi.fn().mockResolvedValue(null),
});

describe('useAppointmentReminderQueue', () => {
  let authState: any;
  let tenantState: any;
  let repository: ReturnType<typeof makeRepository>;
  let current: ReturnType<typeof useAppointmentReminderQueue> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    authState = { authMode: 'supabase-active', user: { id: 'user-a' } };
    tenantState = { activeTenant: { tenantId: tenantA, tenantName: 'Clinic A', timezone: 'Asia/Almaty', role: 'registrar' } };
    repository = makeRepository();
    vi.mocked(useAuth).mockImplementation(() => authState);
    vi.mocked(useTenant).mockImplementation(() => tenantState);
    vi.mocked(createAppointmentReminderRepository).mockReturnValue(repository as any);
  });

  const mount = async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const Harness = ({ tick = 0 }: { tick?: number }) => {
      void tick;
      current = useAppointmentReminderQueue();
      return null;
    };
    await act(async () => { root.render(<Harness />); });
    return { root, Harness };
  };

  it('does not create a repository or fetch without a tenant', async () => {
    tenantState = { activeTenant: null };
    const { root } = await mount();
    expect(createAppointmentReminderRepository).not.toHaveBeenCalled();
    expect(current).toMatchObject({ jobs: [], history: [], loading: false });
    await act(async () => root.unmount());
  });

  it('loads active jobs and terminal history with tenant scope', async () => {
    const { root } = await mount();
    expect(createAppointmentReminderRepository).toHaveBeenCalledWith({ backend: 'supabase', tenantId: tenantA });
    expect(repository.listActiveReminderJobs).toHaveBeenCalledTimes(1);
    expect(repository.listReminderJobHistory).toHaveBeenCalledWith(100, expect.any(String));
    expect(current?.jobs).toHaveLength(1);
    await act(async () => root.unmount());
  });

  it('blocks doctor access before repository creation', async () => {
    tenantState.activeTenant.role = 'doctor';
    const { root } = await mount();
    expect(current?.canAccess).toBe(false);
    expect(createAppointmentReminderRepository).not.toHaveBeenCalled();
    expect(current?.jobs).toEqual([]);
    await act(async () => root.unmount());
  });

  it('clears the old queue on tenant switch and ignores stale responses', async () => {
    const activeA = deferred<AppointmentReminderQueueItem[]>();
    const historyA = deferred<AppointmentReminderQueueItem[]>();
    const activeB = deferred<AppointmentReminderQueueItem[]>();
    const historyB = deferred<AppointmentReminderQueueItem[]>();
    const repoA = { ...makeRepository(), listActiveReminderJobs: vi.fn(() => activeA.promise), listReminderJobHistory: vi.fn(() => historyA.promise) };
    const repoB = { ...makeRepository(), listActiveReminderJobs: vi.fn(() => activeB.promise), listReminderJobHistory: vi.fn(() => historyB.promise) };
    vi.mocked(createAppointmentReminderRepository).mockImplementation(({ tenantId }) => (tenantId === tenantA ? repoA : repoB) as any);
    const { root, Harness } = await mount();

    tenantState = { activeTenant: { tenantId: tenantB, tenantName: 'Clinic B', timezone: 'Asia/Almaty', role: 'registrar' } };
    await act(async () => { root.render(<Harness tick={1} />); });
    expect(current?.jobs).toEqual([]);

    await act(async () => { activeA.resolve([makeItem('old', tenantA)]); historyA.resolve([]); });
    expect(current?.jobs).toEqual([]);
    await act(async () => { activeB.resolve([makeItem('new', tenantB)]); historyB.resolve([]); });
    expect(current?.jobs[0].job.id).toBe('new');
    await act(async () => root.unmount());
  });

  it('blocks duplicate and mutually exclusive actions for the same job', async () => {
    const pending = deferred<AppointmentReminderOperationResult>();
    repository.completeReminderJob.mockImplementation(() => pending.promise);
    const { root } = await mount();
    const item = current!.jobs[0];
    let first!: Promise<AppointmentReminderOperationResult>;
    await act(async () => { first = current!.completeJob({ item, channel: 'phone', outcome: 'no_answer' }); });

    await expect(current!.completeJob({ item, channel: 'phone', outcome: 'no_answer' }))
      .rejects.toMatchObject({ code: 'concurrent' });
    await expect(current!.deferJob({ item, newDueAt: '2026-07-15T09:00:00+00:00', reason: 'Позже' }))
      .rejects.toMatchObject({ code: 'concurrent' });
    expect(repository.completeReminderJob).toHaveBeenCalledTimes(1);
    expect(repository.deferReminderJob).not.toHaveBeenCalled();

    repository.listActiveReminderJobs.mockResolvedValueOnce([]);
    repository.listReminderJobHistory.mockResolvedValueOnce([makeItem(jobId, tenantA, 'completed')]);
    await act(async () => { pending.resolve(makeResult()); await first; });
    await act(async () => root.unmount());
  });

  it('retains the operation key after an ambiguous failure and reuses it on retry', async () => {
    repository.completeReminderJob
      .mockRejectedValueOnce(new AppointmentReminderRepositoryError('operation_failed', 'Не удалось сохранить действие. Обновите очередь и проверьте результат.'))
      .mockResolvedValueOnce(makeResult());
    repository.getReminderOperation.mockResolvedValueOnce(null);
    const { root } = await mount();
    const item = current!.jobs[0];

    await act(async () => {
      await expect(current!.completeJob({ item, channel: 'phone', outcome: 'no_answer' })).rejects.toMatchObject({ code: 'operation_failed' });
    });
    const firstKey = repository.completeReminderJob.mock.calls[0][0].operationKey;
    repository.listActiveReminderJobs.mockResolvedValueOnce([]);
    repository.listReminderJobHistory.mockResolvedValueOnce([makeItem(jobId, tenantA, 'completed')]);
    await act(async () => { await current!.completeJob({ item, channel: 'phone', outcome: 'no_answer' }); });
    const secondKey = repository.completeReminderJob.mock.calls[1][0].operationKey;
    expect(secondKey).toBe(firstKey);
    await act(async () => root.unmount());
  });

  it('clears the operation key after a definitive domain failure', async () => {
    repository.skipReminderJob
      .mockRejectedValueOnce(new AppointmentReminderRepositoryError('stale', 'Задача устарела из-за изменения записи. Обновите очередь.'))
      .mockResolvedValueOnce({ ...makeResult(), operationType: 'reminder_skip' });
    const { root } = await mount();
    const item = current!.jobs[0];

    await act(async () => {
      await expect(current!.skipJob({ item, reason: 'Причина' })).rejects.toMatchObject({ code: 'stale' });
    });
    const firstKey = repository.skipReminderJob.mock.calls[0][0].operationKey;
    repository.listActiveReminderJobs.mockResolvedValueOnce([]);
    repository.listReminderJobHistory.mockResolvedValueOnce([makeItem(jobId, tenantA, 'completed')]);
    await act(async () => { await current!.skipJob({ item, reason: 'Причина' }); });
    const secondKey = repository.skipReminderJob.mock.calls[1][0].operationKey;
    expect(secondKey).not.toBe(firstKey);
    await act(async () => root.unmount());
  });

  it('recovers a committed ambiguous action and refreshes active/history once', async () => {
    repository.completeReminderJob.mockRejectedValueOnce(
      new AppointmentReminderRepositoryError('operation_failed', 'Не удалось сохранить действие. Обновите очередь и проверьте результат.'),
    );
    repository.getReminderOperation.mockResolvedValueOnce({ ...makeResult(), replayed: true, recovered: true });
    repository.listActiveReminderJobs.mockResolvedValueOnce([makeItem()]).mockResolvedValueOnce([]);
    repository.listReminderJobHistory.mockResolvedValueOnce([]).mockResolvedValueOnce([makeItem(jobId, tenantA, 'completed')]);
    const { root } = await mount();
    const item = current!.jobs[0];

    await act(async () => { await current!.completeJob({ item, channel: 'phone', outcome: 'no_answer' }); });
    expect(repository.getReminderOperation).toHaveBeenCalledTimes(1);
    expect(repository.listActiveReminderJobs).toHaveBeenCalledTimes(2);
    expect(repository.listReminderJobHistory).toHaveBeenCalledTimes(2);
    expect(current?.jobs).toEqual([]);
    expect(current?.history[0].job.state).toBe('completed');
    await act(async () => root.unmount());
  });

  it('surfaces safe action errors while keeping queue data available', async () => {
    repository.deferReminderJob.mockRejectedValueOnce(
      new AppointmentReminderRepositoryError('invalid_time', 'Новое время должно быть позже текущего момента и раньше записи.'),
    );
    const { root } = await mount();
    const item = current!.jobs[0];
    await act(async () => {
      await expect(current!.deferJob({ item, newDueAt: '2026-07-15T09:00:00+00:00', reason: 'Позже' })).rejects.toMatchObject({ code: 'invalid_time' });
    });
    expect(current?.error).toBe('Новое время должно быть позже текущего момента и раньше записи.');
    expect(current?.jobs).toHaveLength(1);
    await act(async () => root.unmount());
  });
});
