import type { Appointment, AppointmentStatus, PaymentType, Source } from '../../types';
import { compareAppointmentsByStartThenId } from '../../domain/appointmentSummary';
import { storage } from '../../utils/storage';
import { supabase } from '../../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AppointmentOperationType = 'create' | 'reschedule' | 'details';
export type AppointmentRepositoryErrorCode =
  | 'doctor_conflict'
  | 'patient_conflict'
  | 'invalid_interval'
  | 'patient_unavailable'
  | 'doctor_unavailable'
  | 'idempotency_conflict'
  | 'concurrent_change'
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
  replayed: boolean;
  recovered: boolean;
  operationType: AppointmentOperationType;
}

export interface AppointmentRecoveryResult {
  found: boolean;
  operationType?: 'create' | 'reschedule';
  appointment?: Appointment;
  replayed?: boolean;
  recovered?: boolean;
}

export interface IAppointmentRepository {
  listAppointmentsByPatient(patientId: string): Promise<Appointment[]>;
  listAppointments(): Promise<Appointment[]>;
  createAppointment(appointment: Appointment, options: AppointmentWriteOptions): Promise<AppointmentWriteResult>;
  rescheduleAppointment(current: Appointment, next: Appointment, options: AppointmentWriteOptions): Promise<AppointmentWriteResult>;
  updateAppointmentDetails(current: Appointment, next: Appointment): Promise<AppointmentWriteResult>;
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
  if (text.includes('недостаточно прав для изменения записи') || text.includes('permission denied') || text.includes('42501')) {
    return new AppointmentRepositoryError('permission', 'Недостаточно прав для изменения записи.');
  }
  if (text.includes('операция с этим идентификатором уже выполнена с другими параметрами') || text.includes('appointment_operations_tenant_key_key')) {
    return new AppointmentRepositoryError('idempotency_conflict', 'Операция с этим идентификатором уже выполнена с другими параметрами.');
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
    return this.executeRecoverableWrite(options, async () => {
      const { data, error } = await this.client.rpc('create_appointment', {
        p_tenant_id: this.tenantId,
        p_patient_id: appointment.patientId || null,
        p_doctor_id: appointment.doctorId,
        p_start_time: this.normalizeTimeForDb(appointment.start),
        p_end_time: this.normalizeTimeForDb(appointment.end),
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

    return this.executeRecoverableWrite(options, async () => {
      const { data, error } = await this.client.rpc('reschedule_appointment', {
        p_tenant_id: this.tenantId,
        p_appointment_id: current.id,
        p_patient_id: next.patientId || null,
        p_doctor_id: next.doctorId,
        p_start_time: this.normalizeTimeForDb(next.start),
        p_end_time: this.normalizeTimeForDb(next.end),
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
        operationType: payload.operationType === 'reschedule' ? 'reschedule' : 'create',
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
  ): Promise<AppointmentWriteResult> {
    try {
      return await write();
    } catch (error) {
      const safeError = toSafeAppointmentError(error);
      if (!safeError.ambiguous) throw safeError;

      options.onRecoveryStateChange?.(true);
      try {
        const recovered = await this.recoverAppointmentOperation(options.operationKey);
        if (recovered.found && recovered.appointment && recovered.operationType) {
          return {
            appointment: recovered.appointment,
            replayed: recovered.replayed === true,
            recovered: true,
            operationType: recovered.operationType,
          };
        }
      } catch (recoveryError) {
        const recoverySafeError = toSafeAppointmentError(recoveryError);
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
      ? payload.operationType
      : fallbackType;

    return {
      appointment: this.mapToAppointment(payload.appointment as Record<string, unknown>),
      replayed: payload.replayed === true,
      recovered: payload.recovered === true,
      operationType,
    };
  }

  private normalizeTimeForDb(timeStr: string): string {
    if (!timeStr) return timeStr;
    if (timeStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timeStr)) return timeStr;
    return timeStr.length === 16 ? `${timeStr}:00Z` : `${timeStr}Z`;
  }

  private normalizeTimeFromDb(timeStr: string): string {
    if (!timeStr) return timeStr;
    return timeStr.replace(/(Z|[+-]\d{2}:\d{2})$/, '');
  }

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
    start: this.normalizeTimeFromDb(row.start_time as string),
    end: this.normalizeTimeFromDb(row.end_time as string),
    createdAt: this.normalizeTimeFromDb(row.created_at as string),
    updatedAt: row.updated_at as string,
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
