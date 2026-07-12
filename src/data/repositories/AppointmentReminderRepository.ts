import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AppointmentReminderJob,
  AppointmentReminderJobState,
  AppointmentReminderPlanResult,
  TenantReminderReconcileResult,
} from '../../types';
import { isOffsetAwareInstant } from '../../domain/timezone';
import { supabase } from '../../lib/supabaseClient';

export type AppointmentReminderRepositoryBackend = 'local' | 'supabase';

export interface AppointmentReminderListOptions {
  appointmentId?: string;
  includeTerminal?: boolean;
  referenceTime?: string;
}

export interface IAppointmentReminderRepository {
  listReminderJobs(options?: AppointmentReminderListOptions): Promise<AppointmentReminderJob[]>;
  listReminderJobsByAppointment(appointmentId: string, includeTerminal?: boolean): Promise<AppointmentReminderJob[]>;
  planAppointmentReminderJobs(appointmentId: string, referenceTime?: string): Promise<AppointmentReminderPlanResult>;
  reconcileTenantReminderJobs(from: string, to: string, limit: number, referenceTime?: string): Promise<TenantReminderReconcileResult>;
}

export interface CreateAppointmentReminderRepositoryOptions {
  tenantId?: string | null;
  backend: AppointmentReminderRepositoryBackend;
}

export type AppointmentReminderRepositoryErrorCode =
  | 'tenant_required'
  | 'permission'
  | 'invalid_time'
  | 'read_failed'
  | 'plan_failed'
  | 'reconcile_failed';

export class AppointmentReminderRepositoryError extends Error {
  readonly code: AppointmentReminderRepositoryErrorCode;

  constructor(code: AppointmentReminderRepositoryErrorCode, message: string) {
    super(message);
    this.name = 'AppointmentReminderRepositoryError';
    this.code = code;
  }
}

const TERMINAL_STATES = new Set<AppointmentReminderJobState>(['completed', 'cancelled', 'superseded', 'skipped']);

const errorText = (error: unknown): string => {
  if (!error) return '';
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error !== 'object') return String(error).toLowerCase();
  const candidate = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
  return [candidate.message, candidate.details, candidate.hint, candidate.code]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();
};

export const toSafeAppointmentReminderError = (
  error: unknown,
  fallback: 'read' | 'plan' | 'reconcile',
): AppointmentReminderRepositoryError => {
  if (error instanceof AppointmentReminderRepositoryError) return error;
  const text = errorText(error);
  if (text.includes('недостаточно прав') || text.includes('permission denied') || text.includes('42501')) {
    return new AppointmentReminderRepositoryError('permission', 'Недостаточно прав для работы с очередью напоминаний.');
  }
  if (text.includes('контрольное время') || text.includes('ограниченный период') || text.includes('часовой пояс')) {
    return new AppointmentReminderRepositoryError('invalid_time', 'Не удалось обработать период или время напоминания.');
  }
  if (fallback === 'read') {
    return new AppointmentReminderRepositoryError('read_failed', 'Не удалось загрузить очередь напоминаний.');
  }
  if (fallback === 'reconcile') {
    return new AppointmentReminderRepositoryError('reconcile_failed', 'Не удалось выполнить сверку очереди напоминаний.');
  }
  return new AppointmentReminderRepositoryError('plan_failed', 'Не удалось спланировать напоминания для записи.');
};

const requireInstant = (value: string, label: string): string => {
  if (!isOffsetAwareInstant(value)) {
    throw new AppointmentReminderRepositoryError('invalid_time', `Некорректное время: ${label}.`);
  }
  return value;
};

const asObject = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const asNumber = (value: unknown): number => Number(value ?? 0);

export const mapAppointmentReminderJob = (
  row: Record<string, unknown>,
  referenceTime = new Date().toISOString(),
): AppointmentReminderJob => {
  const dueAt = requireInstant(String(row.due_at ?? row.dueAt ?? ''), 'due_at');
  const appointmentUpdatedAt = requireInstant(
    String(row.appointment_updated_at ?? row.appointmentUpdatedAt ?? ''),
    'appointment_updated_at',
  );
  const createdAt = requireInstant(String(row.created_at ?? row.createdAt ?? ''), 'created_at');
  const updatedAt = requireInstant(String(row.updated_at ?? row.updatedAt ?? ''), 'updated_at');
  const state = String(row.state ?? 'scheduled') as AppointmentReminderJobState;
  const explicitOperational = row.operationalState ?? row.operational_state;
  const operationalState = explicitOperational
    ? String(explicitOperational) as AppointmentReminderJobState
    : state === 'scheduled' && new Date(dueAt).getTime() <= new Date(referenceTime).getTime()
      ? 'ready'
      : state;

  return {
    id: String(row.id),
    tenantId: String(row.tenant_id ?? row.tenantId),
    appointmentId: String(row.appointment_id ?? row.appointmentId),
    patientId: String(row.patient_id ?? row.patientId),
    reminderType: String(row.reminder_type ?? row.reminderType) as AppointmentReminderJob['reminderType'],
    executionMode: String(row.execution_mode ?? row.executionMode ?? 'manual') as AppointmentReminderJob['executionMode'],
    dueAt,
    state,
    operationalState,
    appointmentUpdatedAt,
    policyVersion: asNumber(row.policy_version ?? row.policyVersion),
    planKey: String(row.plan_key ?? row.planKey),
    payloadFingerprint: String(row.payload_fingerprint ?? row.payloadFingerprint),
    priority: asNumber(row.priority),
    createdBy: (row.created_by ?? row.createdBy) ? String(row.created_by ?? row.createdBy) : undefined,
    createdAt,
    updatedAt,
    supersededAt: row.superseded_at || row.supersededAt
      ? requireInstant(String(row.superseded_at ?? row.supersededAt), 'superseded_at')
      : undefined,
    cancelledAt: row.cancelled_at || row.cancelledAt
      ? requireInstant(String(row.cancelled_at ?? row.cancelledAt), 'cancelled_at')
      : undefined,
    skippedAt: row.skipped_at || row.skippedAt
      ? requireInstant(String(row.skipped_at ?? row.skippedAt), 'skipped_at')
      : undefined,
    completedAt: row.completed_at || row.completedAt
      ? requireInstant(String(row.completed_at ?? row.completedAt), 'completed_at')
      : undefined,
    terminalReason: (row.terminal_reason ?? row.terminalReason)
      ? String(row.terminal_reason ?? row.terminalReason)
      : undefined,
    metadata: asObject(row.metadata),
  };
};

export const compareReminderJobs = (left: AppointmentReminderJob, right: AppointmentReminderJob): number => {
  const leftReady = left.operationalState === 'ready' ? 0 : 1;
  const rightReady = right.operationalState === 'ready' ? 0 : 1;
  if (leftReady !== rightReady) return leftReady - rightReady;
  const byDue = new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
  if (byDue !== 0) return byDue;
  if (left.priority !== right.priority) return left.priority - right.priority;
  const byCreated = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  return byCreated !== 0 ? byCreated : left.id.localeCompare(right.id);
};

const emptyPlan = (): AppointmentReminderPlanResult => ({
  created: [],
  reused: [],
  superseded: [],
  cancelled: [],
  skipped: [],
  desired: [],
  appointmentVersion: new Date(0).toISOString(),
  policyVersion: 0,
  policyEnabled: false,
  callbackDeferred: false,
});

export const LocalAppointmentReminderRepository: IAppointmentReminderRepository = {
  listReminderJobs: async () => [],
  listReminderJobsByAppointment: async () => [],
  planAppointmentReminderJobs: async () => emptyPlan(),
  reconcileTenantReminderJobs: async () => ({
    processed: 0,
    created: 0,
    reused: 0,
    superseded: 0,
    cancelled: 0,
    skipped: 0,
  }),
};

export class SupabaseAppointmentReminderRepository implements IAppointmentReminderRepository {
  private readonly tenantId: string;
  private readonly client: SupabaseClient;

  constructor(tenantId: string, client: SupabaseClient) {
    this.tenantId = tenantId;
    this.client = client;
  }

  async listReminderJobs(options: AppointmentReminderListOptions = {}): Promise<AppointmentReminderJob[]> {
    const referenceTime = options.referenceTime ?? new Date().toISOString();
    requireInstant(referenceTime, 'reference_time');

    let query = this.client
      .from('appointment_reminder_jobs')
      .select('*')
      .eq('tenant_id', this.tenantId);

    if (options.appointmentId) query = query.eq('appointment_id', options.appointmentId);
    if (!options.includeTerminal) {
      query = query.in('state', ['scheduled', 'ready']);
    }

    const { data, error } = await query
      .order('due_at', { ascending: true })
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw toSafeAppointmentReminderError(error, 'read');
    return (data || [])
      .map((row) => mapAppointmentReminderJob(row as Record<string, unknown>, referenceTime))
      .filter((job) => options.includeTerminal || !TERMINAL_STATES.has(job.state))
      .sort(compareReminderJobs);
  }

  listReminderJobsByAppointment(appointmentId: string, includeTerminal = true): Promise<AppointmentReminderJob[]> {
    return this.listReminderJobs({ appointmentId, includeTerminal });
  }

  async planAppointmentReminderJobs(
    appointmentId: string,
    referenceTime = new Date().toISOString(),
  ): Promise<AppointmentReminderPlanResult> {
    requireInstant(referenceTime, 'reference_time');
    try {
      const { data, error } = await this.client.rpc('plan_appointment_reminder_jobs', {
        p_tenant_id: this.tenantId,
        p_appointment_id: appointmentId,
        p_reference_time: referenceTime,
      });
      if (error) throw error;
      return this.mapPlanResult(data, referenceTime);
    } catch (error) {
      throw toSafeAppointmentReminderError(error, 'plan');
    }
  }

  async reconcileTenantReminderJobs(
    from: string,
    to: string,
    limit: number,
    referenceTime = new Date().toISOString(),
  ): Promise<TenantReminderReconcileResult> {
    requireInstant(from, 'from');
    requireInstant(to, 'to');
    requireInstant(referenceTime, 'reference_time');
    try {
      const { data, error } = await this.client.rpc('reconcile_tenant_appointment_reminders', {
        p_tenant_id: this.tenantId,
        p_from: from,
        p_to: to,
        p_limit: limit,
        p_reference_time: referenceTime,
      });
      if (error) throw error;
      const payload = asObject(data);
      return {
        processed: asNumber(payload.processed),
        created: asNumber(payload.created),
        reused: asNumber(payload.reused),
        superseded: asNumber(payload.superseded),
        cancelled: asNumber(payload.cancelled),
        skipped: asNumber(payload.skipped),
      };
    } catch (error) {
      throw toSafeAppointmentReminderError(error, 'reconcile');
    }
  }

  private mapPlanResult(data: unknown, referenceTime: string): AppointmentReminderPlanResult {
    const payload = asObject(data);
    const mapRows = (value: unknown): AppointmentReminderJob[] => (
      Array.isArray(value)
        ? value.map((row) => mapAppointmentReminderJob(asObject(row), referenceTime))
        : []
    );
    const appointmentVersion = String(payload.appointmentVersion ?? payload.appointment_version ?? '');
    if (appointmentVersion) requireInstant(appointmentVersion, 'appointment_version');

    return {
      created: mapRows(payload.created),
      reused: mapRows(payload.reused),
      superseded: mapRows(payload.superseded),
      cancelled: mapRows(payload.cancelled),
      skipped: mapRows(payload.skipped),
      desired: Array.isArray(payload.desired) ? payload.desired.map(asObject) : [],
      appointmentVersion,
      policyVersion: asNumber(payload.policyVersion ?? payload.policy_version),
      policyEnabled: payload.policyEnabled === true || payload.policy_enabled === true,
      callbackDeferred: payload.callbackDeferred === true || payload.callback_deferred === true,
    };
  }
}

export function createAppointmentReminderRepository(
  options: CreateAppointmentReminderRepositoryOptions,
): IAppointmentReminderRepository {
  if (options.backend === 'local') return LocalAppointmentReminderRepository;
  if (!options.tenantId || !supabase) {
    throw new AppointmentReminderRepositoryError('tenant_required', 'Клиника не выбрана.');
  }
  return new SupabaseAppointmentReminderRepository(options.tenantId, supabase as SupabaseClient);
}
