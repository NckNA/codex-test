import { beforeEach, describe, expect, it, vi } from 'vitest';
import repositorySource from './AppointmentRepository.ts?raw';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Appointment } from '../../types';
import {
  AppointmentRepositoryError,
  LocalStorageAppointmentRepository,
  SupabaseAppointmentRepository,
  createAppointmentRepository,
  isProtectedAppointmentChange,
  toSafeAppointmentError,
} from './AppointmentRepository';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const tenantId = '11111111-1111-4111-8111-111111111111';
const appointmentId = '22222222-2222-4222-8222-222222222222';
const patientId = '33333333-3333-4333-8333-333333333333';
const doctorId = '44444444-4444-4444-8444-444444444444';
const operationKey = 'appointment-test-operation-001';

const appointment: Appointment = {
  id: appointmentId,
  patientId,
  doctorId,
  cabinet: 'A1',
  service: 'Осмотр',
  status: 'new',
  paymentType: 'unpaid',
  source: 'phone',
  price: 1500,
  comment: 'Комментарий',
  start: '2026-08-01T10:00:00',
  end: '2026-08-01T11:00:00',
  createdAt: '2026-07-01T09:00:00',
  updatedAt: '2026-07-01T09:00:00+00:00',
};

const databaseRow = (overrides: Record<string, unknown> = {}) => ({
  id: appointmentId,
  tenant_id: tenantId,
  patient_id: patientId,
  doctor_id: doctorId,
  cabinet: 'A1',
  service: 'Осмотр',
  status: 'new',
  payment_type: 'unpaid',
  source: 'phone',
  price: '1500.00',
  comment: 'Комментарий',
  start_time: '2026-08-01T10:00:00+00:00',
  end_time: '2026-08-01T11:00:00+00:00',
  created_at: '2026-07-01T09:00:00+00:00',
  updated_at: '2026-07-01T09:00:00+00:00',
  ...overrides,
});

const rpcResult = (
  operationType: 'create' | 'reschedule' | 'details' | 'cancel' | 'no_show' = 'create',
  overrides: Record<string, unknown> = {},
) => ({
  appointment: databaseRow(overrides),
  replayed: false,
  recovered: false,
  operationType,
});

const createClient = () => {
  const rpc = vi.fn();
  const from = vi.fn();
  return {
    client: { rpc, from } as unknown as SupabaseClient,
    rpc,
    from,
  };
};

describe('AppointmentRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('factory', () => {
    it('uses local storage only when the explicit local backend is selected', () => {
      expect(createAppointmentRepository({ backend: 'local' })).toBe(LocalStorageAppointmentRepository);
    });

    it('does not silently fall back when Supabase tenant context is missing', () => {
      expect(() => createAppointmentRepository({ backend: 'supabase', tenantId: null }))
        .toThrow('Клиника не выбрана.');
    });

    it('creates Supabase repository for configured tenant backend', () => {
      const repository = createAppointmentRepository({ backend: 'supabase', tenantId });
      expect(repository).toBeInstanceOf(SupabaseAppointmentRepository);
      expect(supabase).toBeTruthy();
    });
  });

  it('reads appointments through tenant and patient scoped deterministic SELECTs', async () => {
    const { client, from } = createClient();
    const result = Promise.resolve({ data: [databaseRow()], error: null });
    const order = vi.fn().mockImplementation(() => Object.assign(result, { order }));
    const secondEq = vi.fn().mockReturnValue({ order });
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq, order });
    const select = vi.fn().mockReturnValue({ eq: firstEq });
    from.mockReturnValue({ select });
    const repository = new SupabaseAppointmentRepository(tenantId, client);

    const all = await repository.listAppointments();
    const byPatient = await repository.listAppointmentsByPatient(patientId);

    expect(from).toHaveBeenCalledWith('appointments');
    expect(firstEq).toHaveBeenCalledWith('tenant_id', tenantId);
    expect(secondEq).toHaveBeenCalledWith('patient_id', patientId);
    expect(order).toHaveBeenCalledWith('start_time', { ascending: true });
    expect(order).toHaveBeenCalledWith('start_time', { ascending: false });
    expect(order).toHaveBeenCalledWith('id', { ascending: true });
    expect(all[0]).toMatchObject({
      id: appointmentId,
      patientId,
      doctorId,
      status: 'new',
      start: '2026-08-01T10:00:00',
      end: '2026-08-01T11:00:00',
      updatedAt: '2026-07-01T09:00:00+00:00',
      price: 1500,
    });
    expect(byPatient).toHaveLength(1);
  });

  it('maps empty reads to empty arrays and returns cancelled history rows unchanged', async () => {
    const { client, from } = createClient();
    const result = Promise.resolve({ data: [databaseRow({ status: 'cancelled' })], error: null });
    const order = vi.fn().mockImplementation(() => Object.assign(result, { order }));
    const secondEq = vi.fn().mockReturnValue({ order });
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq, order });
    from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: firstEq }) });
    const repository = new SupabaseAppointmentRepository(tenantId, client);

    const rows = await repository.listAppointmentsByPatient(patientId);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('cancelled');

    const emptyResult = Promise.resolve({ data: null, error: null });
    order.mockImplementation(() => Object.assign(emptyResult, { order }));
    await expect(repository.listAppointments()).resolves.toEqual([]);
  });

  it('maps Supabase read failures to safe consumer-specific messages', async () => {
    const { client, from } = createClient();
    const result = Promise.resolve({
      data: null,
      error: { message: 'permission denied', details: 'SQLSTATE 42501 public.appointments' },
    });
    const order = vi.fn().mockImplementation(() => Object.assign(result, { order }));
    const secondEq = vi.fn().mockReturnValue({ order });
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq, order });
    from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: firstEq }) });
    const repository = new SupabaseAppointmentRepository(tenantId, client);

    await expect(repository.listAppointments()).rejects.toMatchObject({
      code: 'schedule_read_failed',
      message: 'Не удалось загрузить расписание.',
    });
    await expect(repository.listAppointmentsByPatient(patientId)).rejects.toMatchObject({
      code: 'patient_read_failed',
      message: 'Не удалось загрузить записи пациента.',
    });
  });

  it('creates through create_appointment RPC and preserves operation key unchanged', async () => {
    const { client, rpc, from } = createClient();
    rpc.mockResolvedValue({ data: rpcResult('create'), error: null });
    const repository = new SupabaseAppointmentRepository(tenantId, client);

    const result = await repository.createAppointment(appointment, { operationKey });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('create_appointment', expect.objectContaining({
      p_tenant_id: tenantId,
      p_patient_id: patientId,
      p_doctor_id: doctorId,
      p_start_time: '2026-08-01T10:00:00Z',
      p_end_time: '2026-08-01T11:00:00Z',
      p_operation_key: operationKey,
    }));
    expect(from).not.toHaveBeenCalled();
    expect(result).toMatchObject({ operationType: 'create', replayed: false, recovered: false });
  });

  it('reschedules through reschedule_appointment RPC with optimistic version and unchanged key', async () => {
    const { client, rpc, from } = createClient();
    rpc.mockResolvedValue({
      data: rpcResult('reschedule', {
        doctor_id: '55555555-5555-4555-8555-555555555555',
        start_time: '2026-08-01T12:00:00+00:00',
        end_time: '2026-08-01T13:00:00+00:00',
      }),
      error: null,
    });
    const repository = new SupabaseAppointmentRepository(tenantId, client);
    const next: Appointment = {
      ...appointment,
      doctorId: '55555555-5555-4555-8555-555555555555',
      start: '2026-08-01T12:00:00',
      end: '2026-08-01T13:00:00',
    };

    const result = await repository.rescheduleAppointment(appointment, next, { operationKey });

    expect(rpc).toHaveBeenCalledWith('reschedule_appointment', expect.objectContaining({
      p_tenant_id: tenantId,
      p_appointment_id: appointmentId,
      p_patient_id: patientId,
      p_doctor_id: next.doctorId,
      p_expected_updated_at: appointment.updatedAt,
      p_operation_key: operationKey,
    }));
    expect(from).not.toHaveBeenCalled();
    expect(result.appointment.start).toBe('2026-08-01T12:00:00');
  });

  it('updates non-protected details only through update_appointment_details RPC', async () => {
    const { client, rpc, from } = createClient();
    rpc.mockResolvedValue({ data: rpcResult('details', { comment: 'Новый комментарий' }), error: null });
    const repository = new SupabaseAppointmentRepository(tenantId, client);
    const next = { ...appointment, comment: 'Новый комментарий' };

    await repository.updateAppointmentDetails(appointment, next);

    expect(rpc).toHaveBeenCalledWith('update_appointment_details', expect.objectContaining({
      p_tenant_id: tenantId,
      p_appointment_id: appointmentId,
      p_comment: 'Новый комментарий',
      p_expected_updated_at: appointment.updatedAt,
    }));
    expect(from).not.toHaveBeenCalled();
  });

  it('cancels through cancel_appointment RPC, preserves tenant/key, trims reason, and maps metadata', async () => {
    const { client, rpc, from } = createClient();
    rpc.mockResolvedValue({
      data: rpcResult('cancel', {
        status: 'cancelled',
        cancelled_at: '2026-08-01T09:30:00+00:00',
        cancelled_by: '55555555-5555-4555-8555-555555555555',
        cancellation_source: 'patient',
        cancellation_reason: 'Patient requested',
        lifecycle_metadata_version: 1,
      }),
      error: null,
    });
    const repository = new SupabaseAppointmentRepository(tenantId, client);

    const result = await repository.cancelAppointment(appointment, 'patient', '  Patient requested  ', { operationKey });

    expect(rpc).toHaveBeenCalledWith('cancel_appointment', {
      p_tenant_id: tenantId,
      p_appointment_id: appointmentId,
      p_cancellation_source: 'patient',
      p_cancellation_reason: 'Patient requested',
      p_expected_updated_at: appointment.updatedAt,
      p_operation_key: operationKey,
    });
    expect(from).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      operationType: 'cancel',
      appointment: {
        status: 'cancelled',
        cancellationSource: 'patient',
        cancellationReason: 'Patient requested',
        cancelledBy: '55555555-5555-4555-8555-555555555555',
        lifecycleMetadataVersion: 1,
      },
    });
  });

  it('marks no-show through mark_appointment_no_show RPC and maps metadata', async () => {
    const { client, rpc, from } = createClient();
    rpc.mockResolvedValue({
      data: rpcResult('no_show', {
        status: 'no_show',
        no_show_at: '2026-08-01T09:30:00+00:00',
        no_show_by: '55555555-5555-4555-8555-555555555555',
        no_show_reason: 'Unable to contact',
        lifecycle_metadata_version: 1,
      }),
      error: null,
    });
    const repository = new SupabaseAppointmentRepository(tenantId, client);

    const result = await repository.markAppointmentNoShow(appointment, '  Unable to contact  ', { operationKey });

    expect(rpc).toHaveBeenCalledWith('mark_appointment_no_show', {
      p_tenant_id: tenantId,
      p_appointment_id: appointmentId,
      p_no_show_reason: 'Unable to contact',
      p_expected_updated_at: appointment.updatedAt,
      p_operation_key: operationKey,
    });
    expect(from).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      operationType: 'no_show',
      appointment: {
        status: 'no_show',
        noShowReason: 'Unable to contact',
        noShowBy: '55555555-5555-4555-8555-555555555555',
        lifecycleMetadataVersion: 1,
      },
    });
  });

  it('rejects generic create, details, and reschedule attempts into lifecycle statuses before RPC', async () => {
    const { client, rpc } = createClient();
    const repository = new SupabaseAppointmentRepository(tenantId, client);

    await expect(repository.createAppointment({ ...appointment, status: 'cancelled' }, { operationKey }))
      .rejects.toMatchObject({ code: 'invalid_transition' });
    await expect(repository.updateAppointmentDetails(appointment, { ...appointment, status: 'no_show' }))
      .rejects.toMatchObject({ code: 'invalid_transition' });
    await expect(repository.rescheduleAppointment(appointment, { ...appointment, status: 'cancelled', start: '2026-08-01T12:00:00' }, { operationKey }))
      .rejects.toMatchObject({ code: 'invalid_transition' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('recovers operation through scoped recovery RPC without exposing fingerprint', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: {
        found: true,
        operationType: 'create',
        appointment: databaseRow(),
        replayed: true,
        recovered: true,
      },
      error: null,
    });
    const repository = new SupabaseAppointmentRepository(tenantId, client);

    const recovered = await repository.recoverAppointmentOperation(operationKey);

    expect(rpc).toHaveBeenCalledWith('get_appointment_operation', {
      p_tenant_id: tenantId,
      p_operation_key: operationKey,
    });
    expect(recovered).toMatchObject({
      found: true,
      operationType: 'create',
      replayed: true,
      recovered: true,
      appointment: { id: appointmentId },
    });
    expect(JSON.stringify(recovered)).not.toContain('fingerprint');
  });

  it('recovers an uncertain create with the original operation key and reports reconciliation state', async () => {
    const { client, rpc } = createClient();
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } })
      .mockResolvedValueOnce({
        data: {
          found: true,
          operationType: 'create',
          appointment: databaseRow(),
          replayed: true,
          recovered: true,
        },
        error: null,
      });
    const repository = new SupabaseAppointmentRepository(tenantId, client);
    const recoveryStates: boolean[] = [];

    const result = await repository.createAppointment(appointment, {
      operationKey,
      onRecoveryStateChange: (recovering) => recoveryStates.push(recovering),
    });

    expect(rpc.mock.calls[0]).toEqual(['create_appointment', expect.objectContaining({ p_operation_key: operationKey })]);
    expect(rpc.mock.calls[1]).toEqual(['get_appointment_operation', {
      p_tenant_id: tenantId,
      p_operation_key: operationKey,
    }]);
    expect(recoveryStates).toEqual([true, false]);
    expect(result).toMatchObject({ recovered: true, replayed: true, appointment: { id: appointmentId } });
  });

  it('recovers an uncertain cancellation with the original operation key', async () => {
    const { client, rpc } = createClient();
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } })
      .mockResolvedValueOnce({
        data: {
          found: true,
          operationType: 'cancel',
          appointment: databaseRow({
            status: 'cancelled',
            cancellation_source: 'clinic',
            cancellation_reason: 'Recovered cancellation',
            cancelled_at: '2026-08-01T09:30:00+00:00',
            cancelled_by: '55555555-5555-4555-8555-555555555555',
            lifecycle_metadata_version: 1,
          }),
          replayed: true,
          recovered: true,
        },
        error: null,
      });
    const repository = new SupabaseAppointmentRepository(tenantId, client);
    const recoveryStates: boolean[] = [];

    const result = await repository.cancelAppointment(appointment, 'clinic', 'Recovered cancellation', {
      operationKey,
      onRecoveryStateChange: (recovering) => recoveryStates.push(recovering),
    });

    expect(rpc.mock.calls[0]).toEqual(['cancel_appointment', expect.objectContaining({ p_operation_key: operationKey })]);
    expect(rpc.mock.calls[1]).toEqual(['get_appointment_operation', {
      p_tenant_id: tenantId,
      p_operation_key: operationKey,
    }]);
    expect(recoveryStates).toEqual([true, false]);
    expect(result).toMatchObject({
      recovered: true,
      replayed: true,
      operationType: 'cancel',
      appointment: { status: 'cancelled', cancellationReason: 'Recovered cancellation' },
    });
  });

  it.each([
    ['У врача уже есть запись на это время.', 'doctor_conflict', 'У врача уже есть запись на это время.'],
    ['У пациента уже есть другая запись на это время.', 'patient_conflict', 'У пациента уже есть другая запись на это время.'],
    ['Время окончания должно быть позже времени начала.', 'invalid_interval', 'Время окончания должно быть позже времени начала.'],
    ['Пациент недоступен в этой клинике.', 'patient_unavailable', 'Пациент недоступен в этой клинике.'],
    ['Врач недоступен в этой клинике.', 'doctor_unavailable', 'Врач недоступен в этой клинике.'],
    ['Операция с этим идентификатором уже выполнена с другими параметрами.', 'idempotency_conflict', 'Эта операция уже была выполнена с другими параметрами.'],
    ['Запись уже отменена.', 'already_cancelled', 'Запись уже отменена.'],
    ['Неявка уже отмечена.', 'already_no_show', 'Неявка уже отмечена.'],
    ['Текущий статус записи не позволяет выполнить это действие.', 'invalid_transition', 'Текущий статус записи не позволяет выполнить это действие.'],
    ['Укажите причину.', 'reason_required', 'Укажите причину.'],
    ['Укажите, кто отменил запись.', 'source_required', 'Укажите, кто отменил запись.'],
    ['Запись была изменена другим пользователем. Обновите расписание.', 'concurrent_change', 'Запись была изменена другим пользователем. Обновите расписание.'],
    ['permission denied for function', 'permission', 'Недостаточно прав для изменения записи.'],
  ])('maps server error safely: %s', (rawMessage, code, safeMessage) => {
    const mapped = toSafeAppointmentError({
      message: rawMessage,
      details: 'SQLSTATE 23505 appointment_operations_tenant_key_key',
      hint: 'public.create_appointment',
    });

    expect(mapped).toBeInstanceOf(AppointmentRepositoryError);
    expect(mapped.code).toBe(code);
    expect(mapped.message).toBe(safeMessage);
    expect(mapped.message).not.toContain('SQLSTATE');
    expect(mapped.message).not.toContain('appointment_operations');
    expect(mapped.message).not.toContain('create_appointment');
  });

  it('does not attempt recovery for deterministic doctor conflict', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({ data: null, error: { message: 'У врача уже есть запись на это время.' } });
    const repository = new SupabaseAppointmentRepository(tenantId, client);

    await expect(repository.createAppointment(appointment, { operationKey }))
      .rejects.toMatchObject({ code: 'doctor_conflict' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('marks protected scheduling changes and ignores details-only edits', () => {
    expect(isProtectedAppointmentChange(appointment, { ...appointment, comment: 'Другое' })).toBe(false);
    expect(isProtectedAppointmentChange(appointment, { ...appointment, start: '2026-08-01T10:30:00' })).toBe(true);
    expect(isProtectedAppointmentChange(appointment, { ...appointment, patientId: 'other' })).toBe(true);
    expect(isProtectedAppointmentChange(appointment, { ...appointment, doctorId: 'other' })).toBe(true);
  });

  it('retains direct DELETE only under current hard-delete policy', async () => {
    const { client, from } = createClient();
    const finalEq = vi.fn().mockResolvedValue({ error: null });
    const firstEq = vi.fn().mockReturnValue({ eq: finalEq });
    const deleteCall = vi.fn().mockReturnValue({ eq: firstEq });
    from.mockReturnValue({ delete: deleteCall });
    const repository = new SupabaseAppointmentRepository(tenantId, client);

    await repository.deleteAppointment(appointmentId);

    expect(from).toHaveBeenCalledWith('appointments');
    expect(deleteCall).toHaveBeenCalledTimes(1);
    expect(firstEq).toHaveBeenCalledWith('tenant_id', tenantId);
    expect(finalEq).toHaveBeenCalledWith('id', appointmentId);
  });

  it('source contains no protected direct INSERT/UPDATE, service role, or Supabase localStorage fallback', () => {
    const supabaseClass = repositorySource.slice(
      repositorySource.indexOf('export class SupabaseAppointmentRepository'),
      repositorySource.indexOf('export function createAppointmentRepository'),
    );

    expect(supabaseClass).not.toContain('.insert(');
    expect(supabaseClass).not.toContain('.update(');
    expect(supabaseClass).not.toContain('service_role');
    expect(supabaseClass).not.toContain('localStorage');
    expect(supabaseClass).not.toContain('storage.');
    expect(supabaseClass).toContain("rpc('create_appointment'");
    expect(supabaseClass).toContain("rpc('reschedule_appointment'");
    expect(supabaseClass).toContain("rpc('cancel_appointment'");
    expect(supabaseClass).toContain("rpc('mark_appointment_no_show'");
    expect(supabaseClass).toContain("rpc('get_appointment_operation'");
  });
});
