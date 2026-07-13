import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { isOffsetAwareInstant } from '../../domain/timezone';
import { SupabasePatientCommunicationRepository } from './PatientCommunicationRepository';
import type {
  Appointment,
  AppointmentConfirmationAttempt,
  AppointmentContactChannel,
  AppointmentContactOutcome,
  AppointmentReminderJob,
  AppointmentReminderJobState,
  AppointmentReminderOperationResult,
  AppointmentReminderPlanResult,
  AppointmentReminderQueueItem,
  AppointmentReminderType,
  CompleteAppointmentReminderJobInput,
  DeferAppointmentReminderJobInput,
  Doctor,
  Patient,
  PatientCommunicationEligibilitySummary,
  SkipAppointmentReminderJobInput,
  TenantReminderReconcileResult,
} from '../../types';

export type AppointmentReminderRepositoryBackend = 'local' | 'supabase';
export type AppointmentReminderErrorCode =
  | 'read_failed'
  | 'permission'
  | 'invalid_time'
  | 'stale'
  | 'already_completed'
  | 'terminal'
  | 'reason_required'
  | 'concurrent'
  | 'idempotency_conflict'
  | 'operation_failed';
export type AppointmentReminderErrorContext = 'read' | 'plan' | 'complete' | 'defer' | 'skip' | 'recover';

export class AppointmentReminderRepositoryError extends Error {
  readonly code: AppointmentReminderErrorCode;

  constructor(code: AppointmentReminderErrorCode, message: string) {
    super(message);
    this.name = 'AppointmentReminderRepositoryError';
    this.code = code;
  }
}

export interface AppointmentReminderRepository {
  listReminderJobs(includeTerminal?: boolean, referenceTime?: string): Promise<AppointmentReminderJob[]>;
  listReminderJobsByAppointment(
    appointmentId: string,
    includeTerminal?: boolean,
    referenceTime?: string,
  ): Promise<AppointmentReminderJob[]>;
  listActiveReminderJobs(referenceTime?: string): Promise<AppointmentReminderQueueItem[]>;
  listReminderJobHistory(limit?: number, referenceTime?: string): Promise<AppointmentReminderQueueItem[]>;
  planAppointmentReminderJobs(appointmentId: string, referenceTime?: string): Promise<AppointmentReminderPlanResult>;
  reconcileTenantReminderJobs(
    from: string,
    to: string,
    limit?: number,
    referenceTime?: string,
  ): Promise<TenantReminderReconcileResult>;
  completeReminderJob(input: CompleteAppointmentReminderJobInput): Promise<AppointmentReminderOperationResult>;
  deferReminderJob(input: DeferAppointmentReminderJobInput): Promise<AppointmentReminderOperationResult>;
  skipReminderJob(input: SkipAppointmentReminderJobInput): Promise<AppointmentReminderOperationResult>;
  getReminderOperation(operationKey: string): Promise<AppointmentReminderOperationResult | null>;
}

export interface CreateAppointmentReminderRepositoryOptions {
  backend: AppointmentReminderRepositoryBackend;
  tenantId?: string | null;
}

type Row = Record<string, unknown>;

const ACTIVE_STATES: AppointmentReminderJobState[] = ['scheduled', 'ready'];
const TERMINAL_STATES: AppointmentReminderJobState[] = ['completed', 'skipped', 'cancelled', 'superseded'];
const SAFE_MESSAGES: Record<AppointmentReminderErrorCode, string> = {
  read_failed: 'Не удалось загрузить очередь напоминаний.',
  permission: 'Недостаточно прав для работы с очередью напоминаний.',
  invalid_time: 'Новое время должно быть позже текущего момента и раньше записи.',
  stale: 'Задача устарела из-за изменения записи. Обновите очередь.',
  already_completed: 'Задача уже завершена.',
  terminal: 'Эта задача больше не доступна для выполнения.',
  reason_required: 'Укажите причину.',
  concurrent: 'Задача была изменена другим пользователем. Обновите очередь.',
  idempotency_conflict: 'Эта операция уже выполнена с другими параметрами.',
  operation_failed: 'Не удалось сохранить действие. Обновите очередь и проверьте результат.',
};

const emptyPlan = (): AppointmentReminderPlanResult => ({
  created: [],
  reused: [],
  superseded: [],
  cancelled: [],
  skipped: [],
  desired: [],
  appointmentVersion: '',
  policyVersion: 0,
  policyEnabled: false,
  callbackDeferred: false,
});

const optionalText = (value: unknown): string | undefined => (
  typeof value === 'string' && value.length > 0 ? value : undefined
);

const optionalNumber = (value: unknown): number | undefined => (
  typeof value === 'number' ? value : undefined
);

export const mapAppointmentReminderJob = (
  row: Row,
  referenceTime = new Date().toISOString(),
): AppointmentReminderJob => {
  const state = row.state as AppointmentReminderJobState;
  const dueAt = String(row.due_at ?? row.dueAt ?? '');
  const ready = state === 'scheduled' && Date.parse(dueAt) <= Date.parse(referenceTime);
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id ?? row.tenantId),
    appointmentId: String(row.appointment_id ?? row.appointmentId),
    patientId: String(row.patient_id ?? row.patientId),
    reminderType: (row.reminder_type ?? row.reminderType) as AppointmentReminderType,
    executionMode: 'manual',
    dueAt,
    originalDueAt: String(row.original_due_at ?? row.originalDueAt ?? dueAt),
    state,
    operationalState: ready ? 'ready' : state,
    appointmentUpdatedAt: String(row.appointment_updated_at ?? row.appointmentUpdatedAt),
    policyVersion: Number(row.policy_version ?? row.policyVersion ?? 0),
    planKey: String(row.plan_key ?? row.planKey),
    payloadFingerprint: String(row.payload_fingerprint ?? row.payloadFingerprint),
    priority: Number(row.priority ?? 100),
    createdBy: optionalText(row.created_by ?? row.createdBy),
    createdAt: String(row.created_at ?? row.createdAt),
    updatedAt: String(row.updated_at ?? row.updatedAt),
    supersededAt: optionalText(row.superseded_at ?? row.supersededAt),
    cancelledAt: optionalText(row.cancelled_at ?? row.cancelledAt),
    skippedAt: optionalText(row.skipped_at ?? row.skippedAt),
    completedAt: optionalText(row.completed_at ?? row.completedAt),
    completedBy: optionalText(row.completed_by ?? row.completedBy),
    completionOutcome: optionalText(row.completion_outcome ?? row.completionOutcome) as AppointmentContactOutcome | undefined,
    completionNote: optionalText(row.completion_note ?? row.completionNote),
    confirmationAttemptId: optionalText(row.confirmation_attempt_id ?? row.confirmationAttemptId),
    deferredAt: optionalText(row.deferred_at ?? row.deferredAt),
    deferredBy: optionalText(row.deferred_by ?? row.deferredBy),
    deferReason: optionalText(row.defer_reason ?? row.deferReason),
    skippedBy: optionalText(row.skipped_by ?? row.skippedBy),
    operationKey: optionalText(row.operation_key ?? row.operationKey),
    operationFingerprint: optionalText(row.operation_fingerprint ?? row.operationFingerprint),
    lastManualActionAt: optionalText(row.last_manual_action_at ?? row.lastManualActionAt),
    terminalReason: optionalText(row.terminal_reason ?? row.terminalReason),
    metadata: ((row.metadata as Record<string, unknown> | null) ?? {}),
  };
};

export const compareReminderJobs = (left: AppointmentReminderJob, right: AppointmentReminderJob): number => {
  const leftActiveRank = left.operationalState === 'ready' ? 0 : 1;
  const rightActiveRank = right.operationalState === 'ready' ? 0 : 1;
  if (leftActiveRank !== rightActiveRank) return leftActiveRank - rightActiveRank;
  const dueDifference = Date.parse(left.dueAt) - Date.parse(right.dueAt);
  if (dueDifference !== 0) return dueDifference;
  if (left.priority !== right.priority) return left.priority - right.priority;
  const createdDifference = Date.parse(left.createdAt) - Date.parse(right.createdAt);
  if (createdDifference !== 0) return createdDifference;
  return left.id.localeCompare(right.id);
};

const terminalMoment = (job: AppointmentReminderJob): number => Date.parse(
  job.completedAt
  ?? job.skippedAt
  ?? job.cancelledAt
  ?? job.supersededAt
  ?? job.updatedAt,
);

const mapAppointment = (row: Row): Appointment => ({
  id: String(row.id),
  patientId: optionalText(row.patient_id ?? row.patientId),
  doctorId: String(row.doctor_id ?? row.doctorId),
  cabinet: String(row.cabinet ?? ''),
  service: String(row.service ?? ''),
  start: String(row.start_time ?? row.start),
  end: String(row.end_time ?? row.end),
  status: row.status as Appointment['status'],
  paymentType: optionalText(row.payment_type ?? row.paymentType) as Appointment['paymentType'],
  source: optionalText(row.source) as Appointment['source'],
  comment: optionalText(row.comment),
  price: optionalNumber(row.price),
  cancelledAt: optionalText(row.cancelled_at ?? row.cancelledAt),
  cancelledBy: optionalText(row.cancelled_by ?? row.cancelledBy),
  cancellationSource: optionalText(row.cancellation_source ?? row.cancellationSource) as Appointment['cancellationSource'],
  cancellationReason: optionalText(row.cancellation_reason ?? row.cancellationReason),
  noShowAt: optionalText(row.no_show_at ?? row.noShowAt),
  noShowBy: optionalText(row.no_show_by ?? row.noShowBy),
  noShowReason: optionalText(row.no_show_reason ?? row.noShowReason),
  lifecycleMetadataVersion: optionalNumber(row.lifecycle_metadata_version ?? row.lifecycleMetadataVersion),
  confirmationState: optionalText(row.confirmation_state ?? row.confirmationState) as Appointment['confirmationState'],
  confirmedAt: optionalText(row.confirmed_at ?? row.confirmedAt),
  confirmedBy: optionalText(row.confirmed_by ?? row.confirmedBy),
  confirmationChannel: optionalText(row.confirmation_channel ?? row.confirmationChannel) as AppointmentContactChannel | undefined,
  confirmationNote: optionalText(row.confirmation_note ?? row.confirmationNote),
  lastConfirmationAttemptAt: optionalText(row.last_confirmation_attempt_at ?? row.lastConfirmationAttemptAt),
  confirmationAttemptCount: optionalNumber(row.confirmation_attempt_count ?? row.confirmationAttemptCount),
  confirmationMetadataVersion: optionalNumber(row.confirmation_metadata_version ?? row.confirmationMetadataVersion),
  lastConfirmationOutcome: optionalText(row.last_confirmation_outcome ?? row.lastConfirmationOutcome) as AppointmentContactOutcome | undefined,
  lastConfirmationNote: optionalText(row.last_confirmation_note ?? row.lastConfirmationNote),
  createdAt: String(row.created_at ?? row.createdAt),
  updatedAt: optionalText(row.updated_at ?? row.updatedAt),
});

const mapAttempt = (row: Row): AppointmentConfirmationAttempt => ({
  id: String(row.id),
  tenantId: String(row.tenant_id ?? row.tenantId),
  appointmentId: optionalText(row.appointment_id ?? row.appointmentId),
  patientId: String(row.patient_id ?? row.patientId),
  actorUserId: String(row.actor_user_id ?? row.actorUserId),
  channel: (row.channel as AppointmentContactChannel),
  outcome: (row.outcome as AppointmentContactOutcome),
  note: optionalText(row.note),
  attemptedAt: String(row.attempted_at ?? row.attemptedAt),
  operationKey: optionalText(row.operation_key ?? row.operationKey),
  createdAt: String(row.created_at ?? row.createdAt),
});

const mapPatient = (row: Row): Pick<Patient, 'id' | 'fullName' | 'phone'> => ({
  id: String(row.id),
  fullName: String(row.full_name ?? row.fullName ?? ''),
  phone: String(row.phone ?? ''),
});

const mapDoctor = (row: Row): Pick<Doctor, 'id' | 'fullName' | 'specialization' | 'cabinet'> => ({
  id: String(row.id),
  fullName: String(row.full_name ?? row.fullName ?? ''),
  specialization: String(row.specialization ?? ''),
  cabinet: String(row.cabinet ?? ''),
});

const assertOffsetAware = (value: string | undefined, context: AppointmentReminderErrorContext): void => {
  if (value && !isOffsetAwareInstant(value)) {
    throw new AppointmentReminderRepositoryError(
      'invalid_time',
      context === 'read' ? SAFE_MESSAGES.read_failed : SAFE_MESSAGES.invalid_time,
    );
  }
};

export const toSafeAppointmentReminderError = (
  error: unknown,
  context: AppointmentReminderErrorContext,
): AppointmentReminderRepositoryError => {
  if (error instanceof AppointmentReminderRepositoryError) return error;
  const errorRecord = typeof error === 'object' && error !== null
    ? error as Record<string, unknown>
    : {};
  const message = error instanceof Error
    ? error.message
    : 'message' in errorRecord
      ? String(errorRecord.message ?? '')
      : String(error ?? '');
  const code = String(errorRecord.code ?? '');
  const hint = String(errorRecord.hint ?? '');
  const details = String(errorRecord.details ?? '');
  const normalized = `${message} ${code} ${hint} ${details}`.toLowerCase();

  if (normalized.includes('недостаточно прав') || normalized.includes('permission denied') || normalized.includes('42501')) {
    return new AppointmentReminderRepositoryError('permission', SAFE_MESSAGES.permission);
  }
  if (
    normalized.includes('reminder_stale')
    || normalized.includes('устарела из-за изменения')
    || normalized.includes('задача устарела')
  ) {
    return new AppointmentReminderRepositoryError('stale', SAFE_MESSAGES.stale);
  }
  if (normalized.includes('задача уже завершена')) {
    return new AppointmentReminderRepositoryError('already_completed', SAFE_MESSAGES.already_completed);
  }
  if (normalized.includes('больше не доступна') || normalized.includes('текущий статус записи')) {
    return new AppointmentReminderRepositoryError('terminal', SAFE_MESSAGES.terminal);
  }
  if (normalized.includes('укажите причину')) {
    return new AppointmentReminderRepositoryError('reason_required', SAFE_MESSAGES.reason_required);
  }
  if (
    normalized.includes('reminder_concurrent')
    || normalized.includes('изменена другим пользователем')
  ) {
    return new AppointmentReminderRepositoryError('concurrent', SAFE_MESSAGES.concurrent);
  }
  if (normalized.includes('другими параметрами') || normalized.includes('23505')) {
    return new AppointmentReminderRepositoryError('idempotency_conflict', SAFE_MESSAGES.idempotency_conflict);
  }
  if (
    normalized.includes('новое время')
    || normalized.includes('часовой пояс')
    || normalized.includes('ещё не наступила')
  ) {
    return new AppointmentReminderRepositoryError('invalid_time', SAFE_MESSAGES.invalid_time);
  }
  return new AppointmentReminderRepositoryError(
    context === 'read' ? 'read_failed' : 'operation_failed',
    context === 'read' ? SAFE_MESSAGES.read_failed : SAFE_MESSAGES.operation_failed,
  );
};

const mapPlanResult = (data: unknown, referenceTime: string): AppointmentReminderPlanResult => {
  const value = (data ?? {}) as Record<string, unknown>;
  const mapRows = (key: string): AppointmentReminderJob[] => (
    Array.isArray(value[key]) ? (value[key] as Row[]).map((row) => mapAppointmentReminderJob(row, referenceTime)) : []
  );
  return {
    created: mapRows('created'),
    reused: mapRows('reused'),
    superseded: mapRows('superseded'),
    cancelled: mapRows('cancelled'),
    skipped: mapRows('skipped'),
    desired: Array.isArray(value.desired) ? value.desired as Array<Record<string, unknown>> : [],
    appointmentVersion: String(value.appointmentVersion ?? ''),
    policyVersion: Number(value.policyVersion ?? 0),
    policyEnabled: Boolean(value.policyEnabled),
    callbackDeferred: Boolean(value.callbackDeferred),
  };
};

const mapOperationResult = (data: unknown, referenceTime: string): AppointmentReminderOperationResult => {
  const value = (data ?? {}) as Record<string, unknown>;
  const jobRow = (value.job ?? value.reminderJob) as Row | undefined;
  const appointmentRow = value.appointment as Row | undefined;
  if (!jobRow || !appointmentRow) {
    throw new AppointmentReminderRepositoryError('operation_failed', SAFE_MESSAGES.operation_failed);
  }
  const attemptRow = value.confirmationAttempt as Row | null | undefined;
  return {
    job: mapAppointmentReminderJob(jobRow, referenceTime),
    appointment: mapAppointment(appointmentRow),
    confirmationAttempt: attemptRow ? mapAttempt(attemptRow) : undefined,
    replayed: Boolean(value.replayed),
    recovered: Boolean(value.recovered),
    operationType: value.operationType as AppointmentReminderOperationResult['operationType'],
  };
};

export class SupabaseAppointmentReminderRepository implements AppointmentReminderRepository {
  private readonly tenantId: string;
  private readonly client: SupabaseClient;

  constructor(tenantId: string, client: SupabaseClient) {
    this.tenantId = tenantId;
    this.client = client;
  }

  async listReminderJobs(includeTerminal = false, referenceTime = new Date().toISOString()): Promise<AppointmentReminderJob[]> {
    assertOffsetAware(referenceTime, 'read');
    try {
      let query = this.client
        .from('appointment_reminder_jobs')
        .select('*')
        .eq('tenant_id', this.tenantId);
      query = includeTerminal
        ? query.in('state', TERMINAL_STATES)
        : query.in('state', ACTIVE_STATES);
      const { data, error } = await query
        .order('due_at', { ascending: true })
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      const jobs = ((data ?? []) as Row[]).map((row) => mapAppointmentReminderJob(row, referenceTime));
      return includeTerminal
        ? jobs.sort((left, right) => terminalMoment(right) - terminalMoment(left) || left.id.localeCompare(right.id))
        : jobs.sort(compareReminderJobs);
    } catch (error) {
      throw toSafeAppointmentReminderError(error, 'read');
    }
  }

  async listReminderJobsByAppointment(
    appointmentId: string,
    includeTerminal = false,
    referenceTime = new Date().toISOString(),
  ): Promise<AppointmentReminderJob[]> {
    assertOffsetAware(referenceTime, 'read');
    try {
      let query = this.client
        .from('appointment_reminder_jobs')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('appointment_id', appointmentId);
      query = includeTerminal
        ? query.in('state', TERMINAL_STATES)
        : query.in('state', ACTIVE_STATES);
      const { data, error } = await query
        .order('due_at', { ascending: true })
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Row[])
        .map((row) => mapAppointmentReminderJob(row, referenceTime))
        .sort(includeTerminal
          ? (left, right) => terminalMoment(right) - terminalMoment(left) || left.id.localeCompare(right.id)
          : compareReminderJobs);
    } catch (error) {
      throw toSafeAppointmentReminderError(error, 'read');
    }
  }

  async listActiveReminderJobs(referenceTime = new Date().toISOString()): Promise<AppointmentReminderQueueItem[]> {
    const jobs = await this.listReminderJobs(false, referenceTime);
    return this.enrichJobs(jobs);
  }

  async listReminderJobHistory(limit = 100, referenceTime = new Date().toISOString()): Promise<AppointmentReminderQueueItem[]> {
    const jobs = (await this.listReminderJobs(true, referenceTime)).slice(0, Math.max(1, Math.min(limit, 500)));
    return this.enrichJobs(jobs);
  }

  async planAppointmentReminderJobs(
    appointmentId: string,
    referenceTime = new Date().toISOString(),
  ): Promise<AppointmentReminderPlanResult> {
    assertOffsetAware(referenceTime, 'plan');
    try {
      const { data, error } = await this.client.rpc('plan_appointment_reminder_jobs', {
        p_tenant_id: this.tenantId,
        p_appointment_id: appointmentId,
        p_reference_time: referenceTime,
      });
      if (error) throw error;
      return mapPlanResult(data, referenceTime);
    } catch (error) {
      throw toSafeAppointmentReminderError(error, 'plan');
    }
  }

  async reconcileTenantReminderJobs(
    from: string,
    to: string,
    limit = 100,
    referenceTime = new Date().toISOString(),
  ): Promise<TenantReminderReconcileResult> {
    assertOffsetAware(from, 'plan');
    assertOffsetAware(to, 'plan');
    assertOffsetAware(referenceTime, 'plan');
    try {
      const { data, error } = await this.client.rpc('reconcile_tenant_appointment_reminders', {
        p_tenant_id: this.tenantId,
        p_from: from,
        p_to: to,
        p_limit: limit,
        p_reference_time: referenceTime,
      });
      if (error) throw error;
      return data as TenantReminderReconcileResult;
    } catch (error) {
      throw toSafeAppointmentReminderError(error, 'plan');
    }
  }

  async completeReminderJob(input: CompleteAppointmentReminderJobInput): Promise<AppointmentReminderOperationResult> {
    return this.runOperation('complete_appointment_reminder_job', {
      p_tenant_id: this.tenantId,
      p_job_id: input.jobId,
      p_channel: input.channel,
      p_outcome: input.outcome,
      p_note: input.note?.trim() || null,
      p_expected_job_updated_at: input.expectedJobUpdatedAt,
      p_expected_appointment_updated_at: input.expectedAppointmentUpdatedAt,
      p_operation_key: input.operationKey,
    }, 'complete', input.expectedJobUpdatedAt);
  }

  async deferReminderJob(input: DeferAppointmentReminderJobInput): Promise<AppointmentReminderOperationResult> {
    assertOffsetAware(input.newDueAt, 'defer');
    return this.runOperation('defer_appointment_reminder_job', {
      p_tenant_id: this.tenantId,
      p_job_id: input.jobId,
      p_new_due_at: input.newDueAt,
      p_reason: input.reason.trim(),
      p_expected_job_updated_at: input.expectedJobUpdatedAt,
      p_expected_appointment_updated_at: input.expectedAppointmentUpdatedAt,
      p_operation_key: input.operationKey,
    }, 'defer', input.expectedJobUpdatedAt);
  }

  async skipReminderJob(input: SkipAppointmentReminderJobInput): Promise<AppointmentReminderOperationResult> {
    return this.runOperation('skip_appointment_reminder_job', {
      p_tenant_id: this.tenantId,
      p_job_id: input.jobId,
      p_reason: input.reason.trim(),
      p_expected_job_updated_at: input.expectedJobUpdatedAt,
      p_expected_appointment_updated_at: input.expectedAppointmentUpdatedAt,
      p_operation_key: input.operationKey,
    }, 'skip', input.expectedJobUpdatedAt);
  }

  async getReminderOperation(operationKey: string): Promise<AppointmentReminderOperationResult | null> {
    try {
      const { data, error } = await this.client.rpc('get_appointment_operation', {
        p_tenant_id: this.tenantId,
        p_operation_key: operationKey,
      });
      if (error) throw error;
      const value = (data ?? {}) as Record<string, unknown>;
      if (!value.found || !value.reminderJob) return null;
      return mapOperationResult(value, new Date().toISOString());
    } catch (error) {
      throw toSafeAppointmentReminderError(error, 'recover');
    }
  }

  private async runOperation(
    rpcName: string,
    args: Record<string, unknown>,
    context: 'complete' | 'defer' | 'skip',
    referenceTime: string,
  ): Promise<AppointmentReminderOperationResult> {
    assertOffsetAware(String(args.p_expected_job_updated_at ?? ''), context);
    assertOffsetAware(String(args.p_expected_appointment_updated_at ?? ''), context);
    try {
      const { data, error } = await this.client.rpc(rpcName, args);
      if (error) throw error;
      const operationResult = (data ?? {}) as Record<string, unknown>;
      const operationErrorCode = String(operationResult.errorCode ?? '');
      if (operationErrorCode) {
        throw toSafeAppointmentReminderError({
          code: '55000',
          hint: `reminder_${operationErrorCode}`,
          message: String(operationResult.errorMessage ?? ''),
        }, context);
      }
      return mapOperationResult(data, referenceTime);
    } catch (error) {
      throw toSafeAppointmentReminderError(error, context);
    }
  }

  private async enrichJobs(jobs: AppointmentReminderJob[]): Promise<AppointmentReminderQueueItem[]> {
    if (jobs.length === 0) return [];
    const appointmentIds = [...new Set(jobs.map((job) => job.appointmentId))];
    const patientIds = [...new Set(jobs.map((job) => job.patientId))];

    try {
      const [{ data: appointmentRows, error: appointmentError }, { data: patientRows, error: patientError }] = await Promise.all([
        this.client
          .from('appointments')
          .select('*')
          .eq('tenant_id', this.tenantId)
          .in('id', appointmentIds),
        this.client
          .from('patients')
          .select('id, full_name, phone')
          .eq('tenant_id', this.tenantId)
          .in('id', patientIds),
      ]);
      if (appointmentError) throw appointmentError;
      if (patientError) throw patientError;

      const appointments = ((appointmentRows ?? []) as Row[]).map(mapAppointment);
      const doctorIds = [...new Set(appointments.map((appointment) => appointment.doctorId))];
      const [{ data: doctorRows, error: doctorError }, { data: attemptRows, error: attemptError }] = await Promise.all([
        this.client
          .from('doctors')
          .select('id, full_name, specialization, cabinet')
          .eq('tenant_id', this.tenantId)
          .in('id', doctorIds),
        this.client
          .from('appointment_confirmation_attempts')
          .select('*')
          .eq('tenant_id', this.tenantId)
          .in('appointment_id', appointmentIds)
          .order('attempted_at', { ascending: false })
          .order('id', { ascending: true }),
      ]);
      if (doctorError) throw doctorError;
      if (attemptError) throw attemptError;

      const appointmentMap = new Map(appointments.map((appointment) => [appointment.id, appointment]));
      const patientMap = new Map(((patientRows ?? []) as Row[]).map(mapPatient).map((patient) => [patient.id, patient]));
      const doctorMap = new Map(((doctorRows ?? []) as Row[]).map(mapDoctor).map((doctor) => [doctor.id, doctor]));
      const attempts = ((attemptRows ?? []) as Row[]).map(mapAttempt);
      const lastAttemptMap = new Map<string, AppointmentConfirmationAttempt>();
      for (const attempt of attempts) {
        if (attempt.appointmentId && !lastAttemptMap.has(attempt.appointmentId)) {
          lastAttemptMap.set(attempt.appointmentId, attempt);
        }
      }

      const communicationRepository = new SupabasePatientCommunicationRepository(this.tenantId, this.client);
      const eligibilityEntries = await Promise.all(patientIds.map(async (patientId) => [
        patientId,
        await communicationRepository.getEligibilitySummary(patientId),
      ] as const));
      const eligibilityMap = new Map<string, PatientCommunicationEligibilitySummary>(eligibilityEntries);

      return jobs.flatMap((job) => {
        const appointment = appointmentMap.get(job.appointmentId);
        const patient = patientMap.get(job.patientId);
        const doctor = appointment ? doctorMap.get(appointment.doctorId) : undefined;
        if (!appointment || !patient || !doctor) return [];
        return [{
          job,
          appointment,
          patient,
          doctor,
          attemptCount: appointment.confirmationAttemptCount ?? 0,
          lastAttempt: lastAttemptMap.get(appointment.id),
          communicationEligibility: eligibilityMap.get(job.patientId),
        }];
      });
    } catch (error) {
      throw toSafeAppointmentReminderError(error, 'read');
    }
  }
}

export const LocalAppointmentReminderRepository: AppointmentReminderRepository = {
  async listReminderJobs() { return []; },
  async listReminderJobsByAppointment() { return []; },
  async listActiveReminderJobs() { return []; },
  async listReminderJobHistory() { return []; },
  async planAppointmentReminderJobs() { return emptyPlan(); },
  async reconcileTenantReminderJobs() {
    return { processed: 0, created: 0, reused: 0, superseded: 0, cancelled: 0, skipped: 0 };
  },
  async completeReminderJob() {
    throw new AppointmentReminderRepositoryError('operation_failed', SAFE_MESSAGES.operation_failed);
  },
  async deferReminderJob() {
    throw new AppointmentReminderRepositoryError('operation_failed', SAFE_MESSAGES.operation_failed);
  },
  async skipReminderJob() {
    throw new AppointmentReminderRepositoryError('operation_failed', SAFE_MESSAGES.operation_failed);
  },
  async getReminderOperation() { return null; },
};

export function createAppointmentReminderRepository(
  options: CreateAppointmentReminderRepositoryOptions,
): AppointmentReminderRepository {
  if (options.backend === 'local') return LocalAppointmentReminderRepository;
  if (!options.tenantId) {
    throw new AppointmentReminderRepositoryError('permission', 'Клиника не выбрана.');
  }
  if (!supabase) {
    throw new AppointmentReminderRepositoryError('read_failed', SAFE_MESSAGES.read_failed);
  }
  return new SupabaseAppointmentReminderRepository(options.tenantId, supabase);
}
