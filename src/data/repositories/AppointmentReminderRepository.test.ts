import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import repositorySource from './AppointmentReminderRepository.ts?raw';
import {
  AppointmentReminderRepositoryError,
  LocalAppointmentReminderRepository,
  SupabaseAppointmentReminderRepository,
  compareReminderJobs,
  createAppointmentReminderRepository,
  mapAppointmentReminderJob,
  toSafeAppointmentReminderError,
} from './AppointmentReminderRepository';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

const tenantId = '11111111-1111-4111-8111-111111111111';
const appointmentId = '22222222-2222-4222-8222-222222222222';
const patientId = '33333333-3333-4333-8333-333333333333';
const now = '2026-07-12T10:00:00.000Z';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: '44444444-4444-4444-8444-444444444444',
  tenant_id: tenantId,
  appointment_id: appointmentId,
  patient_id: patientId,
  reminder_type: 'day_before_reminder',
  execution_mode: 'manual',
  due_at: '2026-07-12T09:00:00+00:00',
  state: 'scheduled',
  appointment_updated_at: '2026-07-11T08:00:00.123456+00:00',
  policy_version: 2,
  plan_key: 'a'.repeat(64),
  payload_fingerprint: 'b'.repeat(64),
  priority: 80,
  created_by: null,
  created_at: '2026-07-11T08:00:00+00:00',
  updated_at: '2026-07-11T08:00:00+00:00',
  metadata: { tenantTimezone: 'Asia/Almaty' },
  ...overrides,
});

const createListClient = (rows: Record<string, unknown>[]) => {
  const result = Promise.resolve({ data: rows, error: null });
  const order = vi.fn().mockImplementation(() => Object.assign(result, { order }));
  const inState = vi.fn().mockReturnValue({ order });
  const secondEq = vi.fn().mockReturnValue({ in: inState, order });
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq, in: inState, order });
  const select = vi.fn().mockReturnValue({ eq: firstEq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from, rpc: vi.fn() } as unknown as SupabaseClient, from, firstEq, secondEq, inState, order };
};

describe('AppointmentReminderRepository', () => {
  it('uses explicit local mode and never silently falls back from Supabase mode', () => {
    expect(createAppointmentReminderRepository({ backend: 'local' })).toBe(LocalAppointmentReminderRepository);
    expect(() => createAppointmentReminderRepository({ backend: 'supabase', tenantId: null }))
      .toThrow('Клиника не выбрана.');
  });

  it('maps database timestamps without stripping offset or PostgreSQL precision', () => {
    const mapped = mapAppointmentReminderJob(row(), now);
    expect(mapped.dueAt).toBe('2026-07-12T09:00:00+00:00');
    expect(mapped.appointmentUpdatedAt).toBe('2026-07-11T08:00:00.123456+00:00');
    expect(mapped.operationalState).toBe('ready');
    expect(mapped.policyVersion).toBe(2);
    expect(mapped.metadata).toEqual({ tenantTimezone: 'Asia/Almaty' });
  });

  it('orders derived ready work before scheduled work and then deterministically', () => {
    const ready = mapAppointmentReminderJob(row({ id: 'b', due_at: '2026-07-12T09:00:00Z', priority: 100 }), now);
    const scheduled = mapAppointmentReminderJob(row({ id: 'a', due_at: '2026-07-12T11:00:00Z', priority: 1 }), now);
    expect([scheduled, ready].sort(compareReminderJobs).map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('applies tenant and appointment filters and deterministic ordering', async () => {
    const { client, from, firstEq, secondEq, inState, order } = createListClient([row()]);
    const repository = new SupabaseAppointmentReminderRepository(tenantId, client);
    const jobs = await repository.listReminderJobsByAppointment(appointmentId, false);

    expect(from).toHaveBeenCalledWith('appointment_reminder_jobs');
    expect(firstEq).toHaveBeenCalledWith('tenant_id', tenantId);
    expect(secondEq).toHaveBeenCalledWith('appointment_id', appointmentId);
    expect(inState).toHaveBeenCalledWith('state', ['scheduled', 'ready']);
    expect(order).toHaveBeenCalledWith('due_at', { ascending: true });
    expect(order).toHaveBeenCalledWith('priority', { ascending: true });
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(order).toHaveBeenCalledWith('id', { ascending: true });
    expect(jobs).toHaveLength(1);
  });

  it('calls only planner and bounded reconciliation RPCs with tenant scope', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: {
          created: [row()], reused: [], superseded: [], cancelled: [], skipped: [], desired: [],
          appointmentVersion: '2026-07-11T08:00:00.123456+00:00', policyVersion: 2,
          policyEnabled: true, callbackDeferred: false,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { processed: 1, created: 1, reused: 0, superseded: 0, cancelled: 0, skipped: 0 },
        error: null,
      });
    const client = { rpc, from: vi.fn() } as unknown as SupabaseClient;
    const repository = new SupabaseAppointmentReminderRepository(tenantId, client);

    const plan = await repository.planAppointmentReminderJobs(appointmentId, now);
    const reconcile = await repository.reconcileTenantReminderJobs(
      '2026-07-12T00:00:00Z', '2026-07-20T00:00:00Z', 100, now,
    );

    expect(rpc).toHaveBeenNthCalledWith(1, 'plan_appointment_reminder_jobs', {
      p_tenant_id: tenantId,
      p_appointment_id: appointmentId,
      p_reference_time: now,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'reconcile_tenant_appointment_reminders', {
      p_tenant_id: tenantId,
      p_from: '2026-07-12T00:00:00Z',
      p_to: '2026-07-20T00:00:00Z',
      p_limit: 100,
      p_reference_time: now,
    });
    expect(plan.created[0].operationalState).toBe('ready');
    expect(reconcile).toMatchObject({ processed: 1, created: 1 });
  });

  it('returns an empty disabled plan in explicit local development mode', async () => {
    await expect(LocalAppointmentReminderRepository.planAppointmentReminderJobs(appointmentId, now))
      .resolves.toMatchObject({ policyEnabled: false, created: [], reused: [] });
    await expect(LocalAppointmentReminderRepository.listReminderJobs()).resolves.toEqual([]);
  });

  it('maps permission, time and generic failures to safe messages', () => {
    expect(toSafeAppointmentReminderError({ message: 'permission denied 42501' }, 'plan'))
      .toMatchObject({ code: 'permission' });
    expect(toSafeAppointmentReminderError({ message: 'Укажите корректный часовой пояс клиники' }, 'plan'))
      .toMatchObject({ code: 'invalid_time' });
    expect(toSafeAppointmentReminderError({ message: 'relation secret_table failed' }, 'read'))
      .toEqual(new AppointmentReminderRepositoryError('read_failed', 'Не удалось загрузить очередь напоминаний.'));
  });

  it('rejects offset-free planner times before any RPC call', async () => {
    const rpc = vi.fn();
    const repository = new SupabaseAppointmentReminderRepository(
      tenantId,
      { rpc, from: vi.fn() } as unknown as SupabaseClient,
    );
    await expect(repository.planAppointmentReminderJobs(appointmentId, '2026-07-12T10:00:00'))
      .rejects.toMatchObject({ code: 'invalid_time' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps manual operation metadata and preserves exact plan identity', () => {
    const mapped = mapAppointmentReminderJob(row({
      original_due_at: '2026-07-11T09:00:00+00:00',
      completed_by: '55555555-5555-4555-8555-555555555555',
      completion_outcome: 'no_answer',
      completion_note: 'Не ответил',
      confirmation_attempt_id: '66666666-6666-4666-8666-666666666666',
      deferred_at: '2026-07-11T10:00:00+00:00',
      deferred_by: '55555555-5555-4555-8555-555555555555',
      defer_reason: 'Позже',
      operation_key: 'reminder-complete-test-001',
      operation_fingerprint: 'c'.repeat(64),
      last_manual_action_at: '2026-07-12T09:00:00+00:00',
    }), now);
    expect(mapped).toMatchObject({
      originalDueAt: '2026-07-11T09:00:00+00:00',
      completedBy: '55555555-5555-4555-8555-555555555555',
      completionOutcome: 'no_answer',
      confirmationAttemptId: '66666666-6666-4666-8666-666666666666',
      deferReason: 'Позже',
      operationKey: 'reminder-complete-test-001',
    });
  });

  it('uses only controlled RPCs for complete, defer and skip and preserves operation keys', async () => {
    const appointmentRow = {
      id: appointmentId,
      tenant_id: tenantId,
      patient_id: patientId,
      doctor_id: '77777777-7777-4777-8777-777777777777',
      cabinet: 'A1', service: 'Consultation', status: 'new',
      start_time: '2026-07-20T10:00:00+00:00', end_time: '2026-07-20T11:00:00+00:00',
      created_at: '2026-07-01T00:00:00+00:00', updated_at: '2026-07-11T08:00:00.123456+00:00',
      confirmation_state: 'contact_in_progress', confirmation_attempt_count: 1,
    };
    const result = (operationType: string, jobOverrides: Record<string, unknown> = {}) => ({
      job: row(jobOverrides),
      appointment: appointmentRow,
      confirmationAttempt: operationType === 'reminder_complete' ? {
        id: '88888888-8888-4888-8888-888888888888', tenant_id: tenantId,
        appointment_id: appointmentId, patient_id: patientId,
        actor_user_id: '99999999-9999-4999-8999-999999999999',
        channel: 'phone', outcome: 'no_answer', attempted_at: now, created_at: now,
      } : null,
      replayed: false, recovered: false, operationType,
    });
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: result('reminder_complete', { state: 'completed', completed_at: now, completed_by: patientId, completion_outcome: 'no_answer', terminal_reason: 'manual_completed' }), error: null })
      .mockResolvedValueOnce({ data: result('reminder_defer', { due_at: '2026-07-15T09:00:00+00:00', deferred_at: now, deferred_by: patientId, defer_reason: 'Позже' }), error: null })
      .mockResolvedValueOnce({ data: result('reminder_skip', { state: 'skipped', skipped_at: now, skipped_by: patientId, terminal_reason: 'Не требуется' }), error: null });
    const repository = new SupabaseAppointmentReminderRepository(
      tenantId,
      { rpc, from: vi.fn() } as unknown as SupabaseClient,
    );

    await repository.completeReminderJob({
      jobId: row().id as string,
      channel: 'phone', outcome: 'no_answer', note: '  Не ответил  ',
      expectedJobUpdatedAt: '2026-07-11T08:00:00.123456+00:00',
      expectedAppointmentUpdatedAt: '2026-07-11T08:00:00.123456+00:00',
      operationKey: 'complete-key-001',
    });
    await repository.deferReminderJob({
      jobId: row().id as string,
      newDueAt: '2026-07-15T09:00:00+00:00', reason: '  Позже  ',
      expectedJobUpdatedAt: '2026-07-11T08:00:00.123456+00:00',
      expectedAppointmentUpdatedAt: '2026-07-11T08:00:00.123456+00:00',
      operationKey: 'defer-key-001',
    });
    await repository.skipReminderJob({
      jobId: row().id as string,
      reason: '  Не требуется  ',
      expectedJobUpdatedAt: '2026-07-11T08:00:00.123456+00:00',
      expectedAppointmentUpdatedAt: '2026-07-11T08:00:00.123456+00:00',
      operationKey: 'skip-key-001',
    });

    expect(rpc).toHaveBeenNthCalledWith(1, 'complete_appointment_reminder_job', expect.objectContaining({
      p_tenant_id: tenantId, p_operation_key: 'complete-key-001', p_note: 'Не ответил',
    }));
    expect(rpc).toHaveBeenNthCalledWith(2, 'defer_appointment_reminder_job', expect.objectContaining({
      p_tenant_id: tenantId, p_operation_key: 'defer-key-001', p_reason: 'Позже',
    }));
    expect(rpc).toHaveBeenNthCalledWith(3, 'skip_appointment_reminder_job', expect.objectContaining({
      p_tenant_id: tenantId, p_operation_key: 'skip-key-001', p_reason: 'Не требуется',
    }));
  });

  it('maps a structured optimistic conflict result without relying on an HTTP error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        errorCode: 'stale',
        errorMessage: 'Задача устарела из-за изменения записи. Обновите очередь.',
      },
      error: null,
    });
    const repository = new SupabaseAppointmentReminderRepository(
      tenantId,
      { rpc, from: vi.fn() } as unknown as SupabaseClient,
    );

    await expect(repository.completeReminderJob({
      jobId: row().id as string,
      channel: 'phone',
      outcome: 'no_answer',
      expectedJobUpdatedAt: '2026-07-11T08:00:00.123456+00:00',
      expectedAppointmentUpdatedAt: '2026-07-11T08:00:00.123456+00:00',
      operationKey: 'structured-stale-001',
    })).rejects.toMatchObject({
      code: 'stale',
      message: 'Задача устарела из-за изменения записи. Обновите очередь.',
    });
  });

  it('recovers a committed reminder operation by the same tenant-scoped key', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        found: true,
        operationType: 'reminder_skip',
        reminderJob: row({ state: 'skipped', skipped_at: now, skipped_by: patientId, terminal_reason: 'Причина' }),
        appointment: {
          id: appointmentId, patient_id: patientId, doctor_id: '77777777-7777-4777-8777-777777777777',
          cabinet: 'A1', service: 'Consultation', status: 'new',
          start_time: '2026-07-20T10:00:00+00:00', end_time: '2026-07-20T11:00:00+00:00',
          created_at: now, updated_at: now,
        },
        confirmationAttempt: null,
        replayed: true,
        recovered: true,
      },
      error: null,
    });
    const repository = new SupabaseAppointmentReminderRepository(
      tenantId,
      { rpc, from: vi.fn() } as unknown as SupabaseClient,
    );
    const recovered = await repository.getReminderOperation('skip-key-001');
    expect(rpc).toHaveBeenCalledWith('get_appointment_operation', {
      p_tenant_id: tenantId,
      p_operation_key: 'skip-key-001',
    });
    expect(recovered).toMatchObject({ replayed: true, recovered: true, operationType: 'reminder_skip' });
  });

  it('maps all manual-operation domain failures without exposing database details', () => {
    expect(toSafeAppointmentReminderError({ message: 'Задача устарела из-за изменения записи.' }, 'complete')).toMatchObject({ code: 'stale' });
    expect(toSafeAppointmentReminderError({ code: '55000', message: 'garbled', hint: 'reminder_stale' }, 'complete')).toMatchObject({ code: 'stale' });
    expect(toSafeAppointmentReminderError({ message: 'Задача уже завершена.' }, 'complete')).toMatchObject({ code: 'already_completed' });
    expect(toSafeAppointmentReminderError({ message: 'Эта задача больше не доступна.' }, 'skip')).toMatchObject({ code: 'terminal' });
    expect(toSafeAppointmentReminderError({ message: 'Укажите причину.' }, 'defer')).toMatchObject({ code: 'reason_required' });
    expect(toSafeAppointmentReminderError({ message: 'Задача была изменена другим пользователем.' }, 'skip')).toMatchObject({ code: 'concurrent' });
    expect(toSafeAppointmentReminderError({ code: '55000', message: 'garbled', hint: 'reminder_concurrent' }, 'skip')).toMatchObject({ code: 'concurrent' });
    expect(toSafeAppointmentReminderError({ message: '23505 secret constraint' }, 'complete'))
      .toEqual(new AppointmentReminderRepositoryError('idempotency_conflict', 'Эта операция уже выполнена с другими параметрами.'));
  });

  it('contains no direct insert or update path for reminder jobs', () => {
    expect(repositorySource).not.toMatch(/\.insert\s*\(/);
    expect(repositorySource).not.toMatch(/\.update\s*\(/);
    expect(repositorySource).not.toMatch(/service[_-]?role/i);
    expect(repositorySource).not.toMatch(/provider_message_id|delivered|send_sms|send_whatsapp|send_email/i);
  });
});
