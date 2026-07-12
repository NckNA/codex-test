import type {
  Appointment,
  AppointmentConfirmationAttempt,
  AppointmentContactChannel,
  AppointmentContactOutcome,
  AppointmentStatus,
  CancellationSource,
  PaymentType,
  Source,
} from '../../types';
import { compareAppointmentsByStartThenId } from '../../domain/appointmentSummary';
import { isOffsetAwareInstant } from '../../domain/timezone';
import { storage } from '../../utils/storage';
import { supabase } from '../../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AppointmentOperationType = 'create' | 'reschedule' | 'details' | 'cancel' | 'no_show' | 'confirmation_attempt' | 'confirm';
export type AppointmentRepositoryErrorCode =
  | 'doctor_conflict'
  | 'patient_conflict'
  | 'invalid_interval'
  | 'patient_unavailable'
  | 'doctor_unavailable'
  | 'idempotency_conflict'
  | 'concurrent_change'
  | 'already_cancelled'
  | 'already_no_show'
  | 'invalid_transition'
  | 'reason_required'
  | 'source_required'
  | 'channel_required'
  | 'outcome_required'
  | 'already_confirmed'
  | 'permission'
  | 'tenant_required'
  | 'schedule_read_failed'
  | 'patient_read_failed'
  | 'generic';

export class AppointmentRepositoryError extends Error {
  readonly code: AppointmentRepositoryErrorCode;
  readonly ambiguous: boolean;

  constructor(code: AppointmentRepositoryErrorCode, message: string, ambiguous = false) {
    super(message);
    this.name = 'AppointmentRepositoryError';
    this.code = code;
    this.ambiguous = ambiguous;
  }
}

export interface AppointmentWriteOptions {
  operationKey: string;
  onRecoveryStateChange?: (isRecovering: boolean) => void;
}

export interface AppointmentWriteResult {
  appointment: Appointment;
  confirmationAttempt?: AppointmentConfirmationAttempt;
  replayed: boolean;
  recovered: boolean;
  operationType: AppointmentOperationType;
}

export interface AppointmentRecoveryResult {
  found: boolean;
  operationType?: 'create' | 'reschedule' | 'cancel' | 'no_show' | 'confirmation_attempt' | 'confirm';
  appointment?: Appointment;
  confirmationAttempt?: AppointmentConfirmationAttempt;
  replayed?: boolean;
  recovered?: boolean;
}

export interface IAppointmentRepository {
  listAppointmentsByPatient(patientId: string): Promise<Appointment[]>;
  listAppointments(): Promise<Appointment[]>;
  createAppointment(appointment: Appointment, options: AppointmentWriteOptions): Promise<AppointmentWriteResult>;
  rescheduleAppointment(current: Appointment, next: Appointment, options: AppointmentWriteOptions): Promise<AppointmentWriteResult>;
  updateAppointmentDetails(current: Appointment, next: Appointment): Promise<AppointmentWriteResult>;
  cancelAppointment(current: Appointment, source: CancellationSource, reason: string, options: AppointmentWriteOptions): Promise<AppointmentWriteResult>;
  markAppointmentNoShow(current: Appointment, reason: string, options: AppointmentWriteOptions): Promise<AppointmentWriteResult>;
  recordConfirmationAttempt(current: Appointment, channel: AppointmentContactChannel, outcome: AppointmentContactOutcome, note: string, options: AppointmentWriteOptions): Promise<AppointmentWriteResult>;
  confirmAppointment(current: Appointment, channel: AppointmentContactChannel, note: string, options: AppointmentWriteOptions): Promise<AppointmentWriteResult>;
  listConfirmationAttempts(appointmentId: string): Promise<AppointmentConfirmationAttempt[]>;
  recoverAppointmentOperation(operationKey: string): Promise<AppointmentRecoveryResult>;
  deleteAppointment(appointmentId: string): Promise<void>;
}

export type AppointmentRepositoryBackend = 'local' | 'supabase';

export interface CreateAppointmentRepositoryOptions {
  tenantId?: string | null;
  backend: AppointmentRepositoryBackend;
}

const genericSaveError = () => new AppointmentRepositoryError(
  'generic',
  'Не удалось сохранить запись. Обновите расписание и проверьте результат.',
  true,
);

const genericLifecycleError = () => new AppointmentRepositoryError(
  'generic',
  'Не удалось изменить статус записи. Обновите расписание и проверьте результат.',
  true,
);

const genericConfirmationError = () => new AppointmentRepositoryError(
  'generic',
  'Не удалось сохранить подтверждение. Обновите расписание и проверьте результат.',
  true,
);

const errorText = (error: unknown): string => {
  if (!error) return '';
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error !== 'object') return String(error).toLowerCase();

  const candidate = error as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
    code?: unknown;
  };

  return [candidate.message, candidate.details, candidate.hint, candidate.code]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();
};

export const toSafeAppointmentError = (error: unknown): AppointmentRepositoryError => {
  if (error instanceof AppointmentRepositoryError) return error;
  const text = errorText(error);

  if (text.includes('у врача уже есть запись на это время')) {
    return new AppointmentRepositoryError('doctor_conflict', 'У врача уже есть запись на это время.');
  }
  if (text.includes('у пациента уже есть другая запись на это время')) {
    return new AppointmentRepositoryError('patient_conflict', 'У пациента уже есть другая запись на это время.');
  }
  if (text.includes('время окончания должно быть позже времени начала') || text.includes('appointments_valid_interval_check')) {
    return new AppointmentRepositoryError('invalid_interval', 'Время окончания должно быть позже времени начала.');
  }
  if (text.includes('пациент недоступен в этой клинике')) {
    return new AppointmentRepositoryError('patient_unavailable', 'Пациент недоступен в этой клинике.');
  }
  if (text.includes('врач недоступен в этой клинике')) {
    return new AppointmentRepositoryError('doctor_unavailable', 'Врач недоступен в этой клинике.');
  }
  if (text.includes('запись была изменена другим пользователем')) {
    return new AppointmentRepositoryError('concurrent_change', 'Запись была изменена другим пользователем. Обновите расписание.');
  }
  if (text.includes('запись уже отменена')) {
    return new AppointmentRepositoryError('already_cancelled', 'Запись уже отменена.');
  }
  if (text.includes('неявка уже отмечена')) {
    return new AppointmentRepositoryError('already_no_show', 'Неявка уже отмечена.');
  }
  if (text.includes('текущий статус записи не позволяет выполнить это действие')) {
    return new AppointmentRepositoryError('invalid_transition', 'Текущий статус записи не позволяет выполнить это действие.');
  }
  if (text.includes('укажите причину')) {
    return new AppointmentRepositoryError('reason_required', 'Укажите причину.');
  }
  if (text.includes('укажите, кто отменил запись')) {
    return new AppointmentRepositoryError('source_required', 'Укажите, кто отменил запись.');
  }
  if (text.includes('выберите способ связи')) {
    return new AppointmentRepositoryError('channel_required', 'Выберите способ связи.');
  }
  if (text.includes('выберите результат связи')) {
    return new AppointmentRepositoryError('outcome_required', 'Выберите результат связи.');
  }
  if (text.includes('запись уже подтверждена')) {
    return new AppointmentRepositoryError('already_confirmed', 'Запись уже подтверждена.');
  }
  if (text.includes('недостаточно прав для подтверждения записи')) {
    return new AppointmentRepositoryError('permission', 'Недостаточно прав для подтверждения записи.');
  }
  if (text.includes('недостаточно прав для изменения записи') || text.includes('permission denied') || text.includes('42501')) {
    return new AppointmentRepositoryError('permission', 'Недостаточно прав для изменения записи.');
  }
  if (text.includes('операция с этим идентификатором уже выполнена с другими параметрами')
      || text.includes('эта операция уже была выполнена с другими параметрами')
      || text.includes('appointment_operations_tenant_key_key')) {
    return new AppointmentRepositoryError('idempotency_conflict', 'Эта операция уже была выполнена с другими параметрами.');
  }

  return genericSaveError();
};

export const toSafeAppointmentReadError = (
  scope: 'schedule' | 'patient',
): AppointmentRepositoryError => new AppointmentRepositoryError(
  scope === 'schedule' ? 'schedule_read_failed' : 'patient_read_failed',
  scope === 'schedule' ? 'Не удалось загрузить расписание.' : 'Не удалось загрузить записи пациента.',
);

export const isProtectedAppointmentChange = (current: Appointment, next: Appointment): boolean => (
  (current.patientId || '') !== (next.patientId || '')
  || current.doctorId !== next.doctorId
  || current.start !== next.start
  || current.end !== next.end
);

const localWriteResult = (appointment: Appointment, operationType: AppointmentOperationType): AppointmentWriteResult => ({
  appointment: {
    ...appointment,
    updatedAt: new Date().toISOString(),
  },
  replayed: false,
  recovered: false,
  operationType,
});

export const LocalStorageAppointmentRepository: IAppointmentRepository = {
  listAppointmentsByPatient: async (patientId: string): Promise<Appointment[]> => storage.getAppointments()
    .filter((appointment) => appointment.patientId === patientId)
    .sort((left, right) => {
      const startDifference = new Date(right.start).getTime() - new Date(left.start).getTime();
      return startDifference !== 0 ? startDifference : left.id.localeCompare(right.id);
    }),

  listAppointments: async (): Promise<Appointment[]> => [...storage.getAppointments()]
    .sort(compareAppointmentsByStartThenId),

  createAppointment: async (appointment: Appointment): Promise<AppointmentWriteResult> => {
    storage.addAppointment(appointment);
    return localWriteResult(appointment, 'create');
  },

  rescheduleAppointment: async (_current: Appointment, next: Appointment): Promise<AppointmentWriteResult> => {
    storage.updateAppointment(next);
    return localWriteResult(next, 'reschedule');
  },

  updateAppointmentDetails: async (_current: Appointment, next: Appointment): Promise<AppointmentWriteResult> => {
    storage.updateAppointment(next);
    return localWriteResult(next, 'details');
  },

  cancelAppointment: async (current: Appointment, source: CancellationSource, reason: string): Promise<AppointmentWriteResult> => {
    const timestamp = new Date().toISOString();
    const next: Appointment = {
      ...current,
      status: 'cancelled',
      cancelledAt: timestamp,
      cancelledBy: 'local-user',
      cancellationSource: source,
      cancellationReason: reason.trim(),
      noShowAt: undefined,
      noShowBy: undefined,
      noShowReason: undefined,
      lifecycleMetadataVersion: 1,
    };
    storage.updateAppointment(next);
    return localWriteResult(next, 'cancel');
  },

  markAppointmentNoShow: async (current: Appointment, reason: string): Promise<AppointmentWriteResult> => {
    const timestamp = new Date().toISOString();
    const next: Appointment = {
      ...current,
      status: 'no_show',
      noShowAt: timestamp,
      noShowBy: 'local-user',
      noShowReason: reason.trim(),
      cancelledAt: undefined,
      cancelledBy: undefined,
      cancellationSource: undefined,
      cancellationReason: undefined,
      lifecycleMetadataVersion: 1,
    };
    storage.updateAppointment(next);
    return localWriteResult(next, 'no_show');
  },

  recordConfirmationAttempt: async (current, channel, outcome, note) => {
    const timestamp = new Date().toISOString();
    const state = outcome === 'confirmed' ? 'confirmed'
      : outcome === 'callback_requested' ? 'callback_requested'
      : ['unreachable', 'wrong_number', 'declined'].includes(outcome) ? 'unreachable'
      : 'contact_in_progress';
    const next: Appointment = {
      ...current,
      confirmationState: state,
      confirmedAt: state === 'confirmed' ? timestamp : undefined,
      confirmedBy: state === 'confirmed' ? 'local-user' : undefined,
      confirmationChannel: state === 'confirmed' ? channel : undefined,
      confirmationNote: state === 'confirmed' ? note.trim() || undefined : undefined,
      lastConfirmationAttemptAt: timestamp,
      confirmationAttemptCount: (current.confirmationAttemptCount || 0) + 1,
      confirmationMetadataVersion: 1,
      lastConfirmationOutcome: outcome,
      lastConfirmationNote: note.trim() || undefined,
    };
    storage.updateAppointment(next);
    return localWriteResult(next, outcome === 'confirmed' ? 'confirm' : 'confirmation_attempt');
  },

  confirmAppointment: async (current, channel, note) => LocalStorageAppointmentRepository.recordConfirmationAttempt(
    current, channel, 'confirmed', note, { operationKey: crypto.randomUUID() },
  ),

  listConfirmationAttempts: async () => [],

  recoverAppointmentOperation: async (): Promise<AppointmentRecoveryResult> => ({ found: false }),

  deleteAppointment: async (appointmentId: string): Promise<void> => {
    storage.deleteAppointment(appointmentId);
  },
};

export class SupabaseAppointmentRepository implements IAppointmentRepository {
  private readonly tenantId: string;
  private readonly client: SupabaseClient;

  constructor(tenantId: string, client: SupabaseClient) {
    this.tenantId = tenantId;
    this.client = client;
  }

  async listAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    const { data, error } = await this.client
      .from('appointments')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('patient_id', patientId)
      .order('start_time', { ascending: false })
      .order('id', { ascending: true });

    if (error) throw toSafeAppointmentReadError('patient');
    return (data || []).map(this.mapToAppointment);
  }

  async listAppointments(): Promise<Appointment[]> {
    const { data, error } = await this.client
      .from('appointments')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .order('start_time', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw toSafeAppointmentReadError('schedule');
    return (data || []).map(this.mapToAppointment);
  }

  async createAppointment(appointment: Appointment, options: AppointmentWriteOptions): Promise<AppointmentWriteResult> {
    if (appointment.status === 'cancelled' || appointment.status === 'no_show') {
      throw new AppointmentRepositoryError('invalid_transition', 'Текущий статус записи не позволяет выполнить это действие.');
    }
    return this.executeRecoverableWrite(options, async () => {
      const { data, error } = await this.client.rpc('create_appointment', {
        p_tenant_id: this.tenantId,
        p_patient_id: appointment.patientId || null,
        p_doctor_id: appointment.doctorId,
        p_start_time: this.normalizeInstantForDb(appointment.start),
        p_end_time: this.normalizeInstantForDb(appointment.end),
        p_cabinet: appointment.cabinet || '',
        p_service: appointment.service || '',
        p_status: appointment.status,
        p_payment_type: appointment.paymentType || null,
        p_source: appointment.source || null,
        p_price: appointment.price ?? null,
        p_comment: appointment.comment || null,
        p_operation_key: options.operationKey,
      });

      if (error) throw error;
      return this.parseWriteResult(data, 'create');
    });
  }

  async rescheduleAppointment(
    current: Appointment,
    next: Appointment,
    options: AppointmentWriteOptions,
  ): Promise<AppointmentWriteResult> {
    if (!current.updatedAt) {
      throw new AppointmentRepositoryError('concurrent_change', 'Запись была изменена другим пользователем. Обновите расписание.');
    }
    if (next.status === 'cancelled' || next.status === 'no_show') {
      throw new AppointmentRepositoryError('invalid_transition', 'Текущий статус записи не позволяет выполнить это действие.');
    }

    return this.executeRecoverableWrite(options, async () => {
      const { data, error } = await this.client.rpc('reschedule_appointment', {
        p_tenant_id: this.tenantId,
        p_appointment_id: current.id,
        p_patient_id: next.patientId || null,
        p_doctor_id: next.doctorId,
        p_start_time: this.normalizeInstantForDb(next.start),
        p_end_time: this.normalizeInstantForDb(next.end),
        p_cabinet: next.cabinet || '',
        p_service: next.service || '',
        p_status: next.status,
        p_payment_type: next.paymentType || null,
        p_source: next.source || null,
        p_price: next.price ?? null,
        p_comment: next.comment || null,
        p_expected_updated_at: current.updatedAt,
        p_operation_key: options.operationKey,
      });

      if (error) throw error;
      return this.parseWriteResult(data, 'reschedule');
    });
  }

  async updateAppointmentDetails(current: Appointment, next: Appointment): Promise<AppointmentWriteResult> {
    if (next.status === 'cancelled' || next.status === 'no_show') {
      throw new AppointmentRepositoryError('invalid_transition', 'Текущий статус записи не позволяет выполнить это действие.');
    }
    if (!current.updatedAt) {
      throw new AppointmentRepositoryError('concurrent_change', 'Запись была изменена другим пользователем. Обновите расписание.');
    }

    try {
      const { data, error } = await this.client.rpc('update_appointment_details', {
        p_tenant_id: this.tenantId,
        p_appointment_id: current.id,
        p_cabinet: next.cabinet || '',
        p_service: next.service || '',
        p_status: next.status,
        p_payment_type: next.paymentType || null,
        p_source: next.source || null,
        p_price: next.price ?? null,
        p_comment: next.comment || null,
        p_expected_updated_at: current.updatedAt,
      });

      if (error) throw error;
      return this.parseWriteResult(data, 'details');
    } catch (error) {
      throw toSafeAppointmentError(error);
    }
  }

  async cancelAppointment(
    current: Appointment,
    source: CancellationSource,
    reason: string,
    options: AppointmentWriteOptions,
  ): Promise<AppointmentWriteResult> {
    if (!current.updatedAt) {
      throw new AppointmentRepositoryError('concurrent_change', 'Запись была изменена другим пользователем. Обновите расписание.');
    }
    return this.executeRecoverableWrite(options, async () => {
      const { data, error } = await this.client.rpc('cancel_appointment', {
        p_tenant_id: this.tenantId,
        p_appointment_id: current.id,
        p_cancellation_source: source,
        p_cancellation_reason: reason.trim(),
        p_expected_updated_at: current.updatedAt,
        p_operation_key: options.operationKey,
      });
      if (error) throw error;
      return this.parseWriteResult(data, 'cancel');
    }, genericLifecycleError);
  }

  async markAppointmentNoShow(
    current: Appointment,
    reason: string,
    options: AppointmentWriteOptions,
  ): Promise<AppointmentWriteResult> {
    if (!current.updatedAt) {
      throw new AppointmentRepositoryError('concurrent_change', 'Запись была изменена другим пользователем. Обновите расписание.');
    }
    return this.executeRecoverableWrite(options, async () => {
      const { data, error } = await this.client.rpc('mark_appointment_no_show', {
        p_tenant_id: this.tenantId,
        p_appointment_id: current.id,
        p_no_show_reason: reason.trim(),
        p_expected_updated_at: current.updatedAt,
        p_operation_key: options.operationKey,
      });
      if (error) throw error;
      return this.parseWriteResult(data, 'no_show');
    }, genericLifecycleError);
  }

  async recordConfirmationAttempt(
    current: Appointment,
    channel: AppointmentContactChannel,
    outcome: AppointmentContactOutcome,
    note: string,
    options: AppointmentWriteOptions,
  ): Promise<AppointmentWriteResult> {
    if (!current.updatedAt) throw new AppointmentRepositoryError('concurrent_change', 'Запись была изменена другим пользователем. Обновите расписание.');
    return this.executeRecoverableWrite(options, async () => {
      const { data, error } = await this.client.rpc('record_appointment_confirmation_attempt', {
        p_tenant_id: this.tenantId,
        p_appointment_id: current.id,
        p_channel: channel,
        p_outcome: outcome,
        p_note: note.trim() || null,
        p_expected_updated_at: current.updatedAt,
        p_operation_key: options.operationKey,
      });
      if (error) throw error;
      return this.parseWriteResult(data, 'confirmation_attempt');
    }, genericConfirmationError);
  }

  async confirmAppointment(
    current: Appointment,
    channel: AppointmentContactChannel,
    note: string,
    options: AppointmentWriteOptions,
  ): Promise<AppointmentWriteResult> {
    if (!current.updatedAt) throw new AppointmentRepositoryError('concurrent_change', 'Запись была изменена другим пользователем. Обновите расписание.');
    return this.executeRecoverableWrite(options, async () => {
      const { data, error } = await this.client.rpc('confirm_appointment', {
        p_tenant_id: this.tenantId,
        p_appointment_id: current.id,
        p_channel: channel,
        p_note: note.trim() || null,
        p_expected_updated_at: current.updatedAt,
        p_operation_key: options.operationKey,
      });
      if (error) throw error;
      return this.parseWriteResult(data, 'confirm');
    }, genericConfirmationError);
  }

  async listConfirmationAttempts(appointmentId: string): Promise<AppointmentConfirmationAttempt[]> {
    const { data, error } = await this.client
      .from('appointment_confirmation_attempts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('appointment_id', appointmentId)
      .order('attempted_at', { ascending: false })
      .order('id', { ascending: true });
    if (error) throw toSafeAppointmentReadError('schedule');
    return (data || []).map(this.mapToConfirmationAttempt);
  }

  async recoverAppointmentOperation(operationKey: string): Promise<AppointmentRecoveryResult> {
    try {
      const { data, error } = await this.client.rpc('get_appointment_operation', {
        p_tenant_id: this.tenantId,
        p_operation_key: operationKey,
      });

      if (error) throw error;
      if (!data || typeof data !== 'object') return { found: false };

      const payload = data as Record<string, unknown>;
      if (payload.found !== true) return { found: false };
      if (!payload.appointment || typeof payload.appointment !== 'object') return { found: false };

      return {
        found: true,
        operationType: payload.operationType === 'reschedule'
          || payload.operationType === 'cancel'
          || payload.operationType === 'no_show'
          || payload.operationType === 'confirmation_attempt'
          || payload.operationType === 'confirm'
          ? payload.operationType
          : 'create',
        confirmationAttempt: payload.confirmationAttempt && typeof payload.confirmationAttempt === 'object'
          ? this.mapToConfirmationAttempt(payload.confirmationAttempt as Record<string, unknown>)
          : undefined,
        appointment: this.mapToAppointment(payload.appointment as Record<string, unknown>),
        replayed: payload.replayed === true,
        recovered: payload.recovered === true,
      };
    } catch (error) {
      throw toSafeAppointmentError(error);
    }
  }

  async deleteAppointment(appointmentId: string): Promise<void> {
    const { error } = await this.client
      .from('appointments')
      .delete()
      .eq('tenant_id', this.tenantId)
      .eq('id', appointmentId);

    if (error) throw toSafeAppointmentError(error);
  }

  private async executeRecoverableWrite(
    options: AppointmentWriteOptions,
    write: () => Promise<AppointmentWriteResult>,
    fallbackError: () => AppointmentRepositoryError = genericSaveError,
  ): Promise<AppointmentWriteResult> {
    try {
      return await write();
    } catch (error) {
      let safeError = toSafeAppointmentError(error);
      if (safeError.code === 'generic') safeError = fallbackError();
      if (!safeError.ambiguous) throw safeError;

      options.onRecoveryStateChange?.(true);
      try {
        const recovered = await this.recoverAppointmentOperation(options.operationKey);
        if (recovered.found && recovered.appointment && recovered.operationType) {
          return {
            appointment: recovered.appointment,
            confirmationAttempt: recovered.confirmationAttempt,
            replayed: recovered.replayed === true,
            recovered: true,
            operationType: recovered.operationType,
          };
        }
      } catch (recoveryError) {
        let recoverySafeError = toSafeAppointmentError(recoveryError);
        if (recoverySafeError.code === 'generic') recoverySafeError = fallbackError();
        if (!recoverySafeError.ambiguous) throw recoverySafeError;
      } finally {
        options.onRecoveryStateChange?.(false);
      }

      throw safeError;
    }
  }

  private parseWriteResult(data: unknown, fallbackType: AppointmentOperationType): AppointmentWriteResult {
    if (!data || typeof data !== 'object') throw genericSaveError();
    const payload = data as Record<string, unknown>;
    if (!payload.appointment || typeof payload.appointment !== 'object') throw genericSaveError();

    const operationType = payload.operationType === 'create'
      || payload.operationType === 'reschedule'
      || payload.operationType === 'details'
      || payload.operationType === 'cancel'
      || payload.operationType === 'no_show'
      || payload.operationType === 'confirmation_attempt'
      || payload.operationType === 'confirm'
      ? payload.operationType
      : fallbackType;

    return {
      appointment: this.mapToAppointment(payload.appointment as Record<string, unknown>),
      confirmationAttempt: payload.confirmationAttempt && typeof payload.confirmationAttempt === 'object'
        ? this.mapToConfirmationAttempt(payload.confirmationAttempt as Record<string, unknown>)
        : undefined,
      replayed: payload.replayed === true,
      recovered: payload.recovered === true,
      operationType,
    };
  }

  private normalizeInstantForDb(value: string): string {
    if (!isOffsetAwareInstant(value)) {
      throw new AppointmentRepositoryError(
        'generic',
        'Не удалось обработать время записи. Обновите страницу и попробуйте снова.',
      );
    }
    return new Date(value).toISOString();
  }

  private normalizeTimeFromDb(value: string): string {
    if (!isOffsetAwareInstant(value)) {
      throw new AppointmentRepositoryError(
        'generic',
        'Не удалось обработать время записи. Обновите страницу и попробуйте снова.',
      );
    }
    return value;
  }

  private mapToConfirmationAttempt = (row: Record<string, unknown>): AppointmentConfirmationAttempt => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    appointmentId: (row.appointment_id as string) || undefined,
    patientId: row.patient_id as string,
    actorUserId: row.actor_user_id as string,
    channel: row.channel as AppointmentContactChannel,
    outcome: row.outcome as AppointmentContactOutcome,
    note: (row.note as string) || undefined,
    attemptedAt: this.normalizeTimeFromDb(row.attempted_at as string),
    operationKey: (row.operation_key as string) || undefined,
    createdAt: this.normalizeTimeFromDb(row.created_at as string),
  });

  private mapToAppointment = (row: Record<string, unknown>): Appointment => ({
    id: row.id as string,
    patientId: (row.patient_id as string) || undefined,
    doctorId: row.doctor_id as string,
    cabinet: (row.cabinet as string) || '',
    service: (row.service as string) || '',
    status: row.status as AppointmentStatus,
    paymentType: (row.payment_type as PaymentType) || undefined,
    source: (row.source as Source) || undefined,
    price: row.price !== null && row.price !== undefined ? Number(row.price) : undefined,
    comment: (row.comment as string) || undefined,
    cancelledAt: row.cancelled_at ? this.normalizeTimeFromDb(row.cancelled_at as string) : undefined,
    cancelledBy: (row.cancelled_by as string) || undefined,
    cancellationSource: (row.cancellation_source as CancellationSource) || undefined,
    cancellationReason: (row.cancellation_reason as string) || undefined,
    noShowAt: row.no_show_at ? this.normalizeTimeFromDb(row.no_show_at as string) : undefined,
    noShowBy: (row.no_show_by as string) || undefined,
    noShowReason: (row.no_show_reason as string) || undefined,
    lifecycleMetadataVersion: row.lifecycle_metadata_version !== null && row.lifecycle_metadata_version !== undefined
      ? Number(row.lifecycle_metadata_version)
      : undefined,
    confirmationState: (row.confirmation_state as Appointment['confirmationState']) || 'unconfirmed',
    confirmedAt: row.confirmed_at ? this.normalizeTimeFromDb(row.confirmed_at as string) : undefined,
    confirmedBy: (row.confirmed_by as string) || undefined,
    confirmationChannel: (row.confirmation_channel as AppointmentContactChannel) || undefined,
    confirmationNote: (row.confirmation_note as string) || undefined,
    lastConfirmationAttemptAt: row.last_confirmation_attempt_at ? this.normalizeTimeFromDb(row.last_confirmation_attempt_at as string) : undefined,
    confirmationAttemptCount: row.confirmation_attempt_count !== null && row.confirmation_attempt_count !== undefined ? Number(row.confirmation_attempt_count) : 0,
    confirmationMetadataVersion: row.confirmation_metadata_version !== null && row.confirmation_metadata_version !== undefined ? Number(row.confirmation_metadata_version) : 0,
    lastConfirmationOutcome: (row.last_confirmation_outcome as AppointmentContactOutcome) || undefined,
    lastConfirmationNote: (row.last_confirmation_note as string) || undefined,
    start: this.normalizeTimeFromDb(row.start_time as string),
    end: this.normalizeTimeFromDb(row.end_time as string),
    createdAt: this.normalizeTimeFromDb(row.created_at as string),
    updatedAt: this.normalizeTimeFromDb(row.updated_at as string),
  });
}

export function createAppointmentRepository(options: CreateAppointmentRepositoryOptions): IAppointmentRepository {
  if (options.backend === 'local') {
    return LocalStorageAppointmentRepository;
  }

  if (!options.tenantId || !supabase) {
    throw new AppointmentRepositoryError('tenant_required', 'Клиника не выбрана.');
  }

  return new SupabaseAppointmentRepository(options.tenantId, supabase as SupabaseClient);
}
