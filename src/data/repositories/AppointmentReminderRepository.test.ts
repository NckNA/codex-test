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

  it('contains no direct insert or update path for reminder jobs', () => {
    expect(repositorySource).not.toMatch(/\.insert\s*\(/);
    expect(repositorySource).not.toMatch(/\.update\s*\(/);
    expect(repositorySource).not.toMatch(/service[_-]?role/i);
    expect(repositorySource).not.toMatch(/sms|whatsapp|email|provider_message_id|delivered/i);
  });
});
