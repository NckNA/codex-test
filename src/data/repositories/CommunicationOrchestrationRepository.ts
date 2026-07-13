import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import type {
  CommunicationAdapterCode,
  CommunicationAdapterResultCode,
  CommunicationChannel,
  CommunicationCommand,
  CommunicationLanguage,
  CommunicationOperationState,
  CommunicationPurpose,
  CommunicationSimulationScenario,
} from '../../domain/communications/CommunicationCommand';

type Row = Record<string, unknown>;

export interface CommunicationRoute {
  id: string;
  tenantId: string;
  channel: CommunicationChannel;
  adapterCode: CommunicationAdapterCode;
  enabled: boolean;
  simulationOnly: true;
  priority: number;
  configurationVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CommunicationOperation {
  id: string;
  tenantId: string;
  reminderJobId: string;
  appointmentId: string;
  patientId: string;
  contactId: string;
  purposeCode: CommunicationPurpose;
  channel: CommunicationChannel;
  language: CommunicationLanguage;
  state: CommunicationOperationState;
  operationKey: string;
  payloadFingerprint: string;
  appointmentUpdatedAt: string;
  reminderJobUpdatedAt: string;
  contactUpdatedAt: string;
  policyVersion: number;
  eligibilityVersion: number;
  routeId: string;
  routeVersion: number;
  adapterCode: CommunicationAdapterCode;
  externalOperationId?: string;
  adapterResultCode?: CommunicationAdapterResultCode;
  retryable?: boolean;
  uncertain: boolean;
  safeErrorCode?: string;
  preparedAt: string;
  executedAt?: string;
  recoveredAt?: string;
  cancelledAt?: string;
  updatedAt: string;
  eligibilitySnapshot: Record<string, unknown>;
  consentSnapshot: Record<string, unknown>;
  suppressionSnapshot: Record<string, unknown>;
  contactSnapshot: {
    maskedDestination?: string;
    destinationFingerprint?: string;
    [key: string]: unknown;
  };
  appointmentSnapshot: Record<string, unknown>;
  routeSnapshot: Record<string, unknown>;
  command: CommunicationCommand;
  metadata: Record<string, unknown>;
}

export interface CommunicationOperationResult {
  operation: CommunicationOperation;
  replayed: boolean;
  recoveryOnly?: boolean;
}

export interface CommunicationRouteResult {
  route: CommunicationRoute;
  changed: boolean;
  replayed: boolean;
}

export interface UpsertCommunicationRouteInput {
  routeId?: string;
  channel: CommunicationChannel;
  adapterCode: CommunicationAdapterCode;
  enabled: boolean;
  priority: number;
  expectedUpdatedAt?: string;
  operationKey: string;
}

export interface PrepareCommunicationOperationInput {
  reminderJobId: string;
  channel: CommunicationChannel;
  operationKey: string;
  expectedJobUpdatedAt: string;
  expectedAppointmentUpdatedAt: string;
}

export interface SimulateCommunicationOperationInput {
  operationId: string;
  scenario: CommunicationSimulationScenario;
  operationKey: string;
  expectedUpdatedAt: string;
}

export type CommunicationRepositoryErrorCode =
  | 'permission'
  | 'no_route'
  | 'not_eligible'
  | 'stale'
  | 'conflict'
  | 'terminal'
  | 'simulation_only'
  | 'read_failed'
  | 'operation_failed';

const SAFE_MESSAGES: Record<CommunicationRepositoryErrorCode, string> = {
  permission: 'Недостаточно прав для работы с коммуникациями.',
  no_route: 'Для этого канала не настроен тестовый маршрут.',
  not_eligible: 'Контакт или согласие больше не позволяют подготовить коммуникацию.',
  stale: 'Данные записи или контакта изменились. Обновите задачу.',
  conflict: 'Операция уже выполнена с другими параметрами.',
  terminal: 'Эта коммуникационная операция уже завершена.',
  simulation_only: 'Реальная отправка в этой версии запрещена.',
  read_failed: 'Не удалось загрузить тестовые коммуникационные операции.',
  operation_failed: 'Не удалось выполнить тестовую операцию.',
};

export class CommunicationOrchestrationRepositoryError extends Error {
  readonly code: CommunicationRepositoryErrorCode;

  constructor(code: CommunicationRepositoryErrorCode, message = SAFE_MESSAGES[code]) {
    super(message);
    this.name = 'CommunicationOrchestrationRepositoryError';
    this.code = code;
  }
}

const value = (row: Row, camel: string, snake: string): unknown => row[camel] ?? row[snake];
const optionalString = (item: unknown): string | undefined => {
  const normalized = String(item ?? '');
  return normalized || undefined;
};

export const toSafeCommunicationRepositoryError = (
  error: unknown,
  context: 'read' | 'write' = 'write',
): CommunicationOrchestrationRepositoryError => {
  if (error instanceof CommunicationOrchestrationRepositoryError) return error;
  const row = typeof error === 'object' && error !== null ? error as Row : {};
  const normalized = [row.message, row.details, row.hint, row.code, error]
    .map((item) => String(item ?? ''))
    .join(' ')
    .toLowerCase();

  if (normalized.includes('недостаточно прав') || normalized.includes('42501') || normalized.includes('permission denied')) {
    return new CommunicationOrchestrationRepositoryError('permission');
  }
  if (normalized.includes('не настроен тестовый маршрут')) {
    return new CommunicationOrchestrationRepositoryError('no_route');
  }
  if (normalized.includes('контакт или согласие')) {
    return new CommunicationOrchestrationRepositoryError('not_eligible');
  }
  if (normalized.includes('изменились') || normalized.includes('40001')) {
    return new CommunicationOrchestrationRepositoryError('stale');
  }
  if (normalized.includes('другими параметрами') || normalized.includes('23505')) {
    return new CommunicationOrchestrationRepositoryError('conflict');
  }
  if (normalized.includes('уже завершена') || normalized.includes('55000')) {
    return new CommunicationOrchestrationRepositoryError('terminal');
  }
  if (normalized.includes('реальная отправка') || normalized.includes('real adapter')) {
    return new CommunicationOrchestrationRepositoryError('simulation_only');
  }
  return new CommunicationOrchestrationRepositoryError(context === 'read' ? 'read_failed' : 'operation_failed');
};

export const mapCommunicationRoute = (row: Row): CommunicationRoute => ({
  id: String(value(row, 'id', 'id')),
  tenantId: String(value(row, 'tenantId', 'tenant_id')),
  channel: value(row, 'channel', 'channel') as CommunicationChannel,
  adapterCode: value(row, 'adapterCode', 'adapter_code') as CommunicationAdapterCode,
  enabled: Boolean(value(row, 'enabled', 'enabled')),
  simulationOnly: true,
  priority: Number(value(row, 'priority', 'priority') ?? 100),
  configurationVersion: Number(value(row, 'configurationVersion', 'configuration_version') ?? 1),
  createdAt: String(value(row, 'createdAt', 'created_at') ?? ''),
  updatedAt: String(value(row, 'updatedAt', 'updated_at') ?? ''),
  archivedAt: optionalString(value(row, 'archivedAt', 'archived_at')),
});

export const mapCommunicationOperation = (row: Row): CommunicationOperation => ({
  id: String(value(row, 'id', 'id')),
  tenantId: String(value(row, 'tenantId', 'tenant_id')),
  reminderJobId: String(value(row, 'reminderJobId', 'reminder_job_id')),
  appointmentId: String(value(row, 'appointmentId', 'appointment_id')),
  patientId: String(value(row, 'patientId', 'patient_id')),
  contactId: String(value(row, 'contactId', 'contact_id')),
  purposeCode: value(row, 'purposeCode', 'purpose_code') as CommunicationPurpose,
  channel: value(row, 'channel', 'channel') as CommunicationChannel,
  language: value(row, 'language', 'language') as CommunicationLanguage,
  state: value(row, 'state', 'state') as CommunicationOperationState,
  operationKey: String(value(row, 'operationKey', 'operation_key')),
  payloadFingerprint: String(value(row, 'payloadFingerprint', 'payload_fingerprint')),
  appointmentUpdatedAt: String(value(row, 'appointmentUpdatedAt', 'appointment_updated_at')),
  reminderJobUpdatedAt: String(value(row, 'reminderJobUpdatedAt', 'reminder_job_updated_at')),
  contactUpdatedAt: String(value(row, 'contactUpdatedAt', 'contact_updated_at')),
  policyVersion: Number(value(row, 'policyVersion', 'policy_version')),
  eligibilityVersion: Number(value(row, 'eligibilityVersion', 'eligibility_version')),
  routeId: String(value(row, 'routeId', 'route_id')),
  routeVersion: Number(value(row, 'routeVersion', 'route_version')),
  adapterCode: value(row, 'adapterCode', 'adapter_code') as CommunicationAdapterCode,
  externalOperationId: optionalString(value(row, 'externalOperationId', 'external_operation_id')),
  adapterResultCode: optionalString(value(row, 'adapterResultCode', 'adapter_result_code')) as CommunicationAdapterResultCode | undefined,
  retryable: value(row, 'retryable', 'retryable') == null ? undefined : Boolean(value(row, 'retryable', 'retryable')),
  uncertain: Boolean(value(row, 'uncertain', 'uncertain')),
  safeErrorCode: optionalString(value(row, 'safeErrorCode', 'safe_error_code')),
  preparedAt: String(value(row, 'preparedAt', 'prepared_at')),
  executedAt: optionalString(value(row, 'executedAt', 'executed_at')),
  recoveredAt: optionalString(value(row, 'recoveredAt', 'recovered_at')),
  cancelledAt: optionalString(value(row, 'cancelledAt', 'cancelled_at')),
  updatedAt: String(value(row, 'updatedAt', 'updated_at')),
  eligibilitySnapshot: (value(row, 'eligibilitySnapshot', 'eligibility_snapshot') ?? {}) as Record<string, unknown>,
  consentSnapshot: (value(row, 'consentSnapshot', 'consent_snapshot') ?? {}) as Record<string, unknown>,
  suppressionSnapshot: (value(row, 'suppressionSnapshot', 'suppression_snapshot') ?? {}) as Record<string, unknown>,
  contactSnapshot: (value(row, 'contactSnapshot', 'contact_snapshot') ?? {}) as CommunicationOperation['contactSnapshot'],
  appointmentSnapshot: (value(row, 'appointmentSnapshot', 'appointment_snapshot') ?? {}) as Record<string, unknown>,
  routeSnapshot: (value(row, 'routeSnapshot', 'route_snapshot') ?? {}) as Record<string, unknown>,
  command: (value(row, 'command', 'command') ?? {}) as CommunicationCommand,
  metadata: (value(row, 'metadata', 'metadata') ?? {}) as Record<string, unknown>,
});

const unwrapRpcObject = (data: unknown): Row => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};
  return data as Row;
};

export interface CommunicationOrchestrationRepository {
  listCommunicationRoutes(): Promise<CommunicationRoute[]>;
  upsertCommunicationRoute(input: UpsertCommunicationRouteInput): Promise<CommunicationRouteResult>;
  disableCommunicationRoute(routeId: string, expectedUpdatedAt: string, operationKey: string): Promise<CommunicationRouteResult>;
  listCommunicationOperations(limit?: number): Promise<CommunicationOperation[]>;
  getCommunicationOperation(operationId: string): Promise<CommunicationOperation | null>;
  prepareCommunicationOperation(input: PrepareCommunicationOperationInput): Promise<CommunicationOperationResult>;
  simulateCommunicationOperation(input: SimulateCommunicationOperationInput): Promise<CommunicationOperationResult>;
  recoverCommunicationOperation(operationId: string, operationKey: string): Promise<CommunicationOperationResult>;
}

export class SupabaseCommunicationOrchestrationRepository implements CommunicationOrchestrationRepository {
  private readonly tenantId: string;
  private readonly client: SupabaseClient;

  constructor(tenantId: string, client: SupabaseClient) {
    this.tenantId = tenantId;
    this.client = client;
  }

  async listCommunicationRoutes(): Promise<CommunicationRoute[]> {
    try {
      const { data, error } = await this.client.rpc('list_communication_routes', {
        p_tenant_id: this.tenantId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data : []).map((row) => mapCommunicationRoute(row as Row));
    } catch (error) {
      throw toSafeCommunicationRepositoryError(error, 'read');
    }
  }

  async upsertCommunicationRoute(input: UpsertCommunicationRouteInput): Promise<CommunicationRouteResult> {
    try {
      const { data, error } = await this.client.rpc('create_or_update_communication_route', {
        p_tenant_id: this.tenantId,
        p_route_id: input.routeId ?? null,
        p_channel: input.channel,
        p_adapter_code: input.adapterCode,
        p_enabled: input.enabled,
        p_priority: input.priority,
        p_expected_updated_at: input.expectedUpdatedAt ?? null,
        p_operation_key: input.operationKey,
      });
      if (error) throw error;
      const result = unwrapRpcObject(data);
      return {
        route: mapCommunicationRoute((result.route ?? {}) as Row),
        changed: Boolean(result.changed),
        replayed: Boolean(result.replayed),
      };
    } catch (error) {
      throw toSafeCommunicationRepositoryError(error);
    }
  }

  async disableCommunicationRoute(
    routeId: string,
    expectedUpdatedAt: string,
    operationKey: string,
  ): Promise<CommunicationRouteResult> {
    try {
      const { data, error } = await this.client.rpc('disable_communication_route', {
        p_tenant_id: this.tenantId,
        p_route_id: routeId,
        p_expected_updated_at: expectedUpdatedAt,
        p_operation_key: operationKey,
      });
      if (error) throw error;
      const result = unwrapRpcObject(data);
      return {
        route: mapCommunicationRoute((result.route ?? {}) as Row),
        changed: Boolean(result.changed),
        replayed: Boolean(result.replayed),
      };
    } catch (error) {
      throw toSafeCommunicationRepositoryError(error);
    }
  }

  async listCommunicationOperations(limit = 100): Promise<CommunicationOperation[]> {
    try {
      const { data, error } = await this.client
        .from('communication_operations')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .order('prepared_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(Math.max(1, Math.min(limit, 500)));
      if (error) throw error;
      return (data ?? []).map((row) => mapCommunicationOperation(row as Row));
    } catch (error) {
      throw toSafeCommunicationRepositoryError(error, 'read');
    }
  }

  async getCommunicationOperation(operationId: string): Promise<CommunicationOperation | null> {
    try {
      const { data, error } = await this.client
        .from('communication_operations')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('id', operationId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapCommunicationOperation(data as Row) : null;
    } catch (error) {
      throw toSafeCommunicationRepositoryError(error, 'read');
    }
  }

  async prepareCommunicationOperation(
    input: PrepareCommunicationOperationInput,
  ): Promise<CommunicationOperationResult> {
    try {
      const { data, error } = await this.client.rpc('prepare_communication_operation', {
        p_tenant_id: this.tenantId,
        p_reminder_job_id: input.reminderJobId,
        p_channel: input.channel,
        p_operation_key: input.operationKey,
        p_expected_job_updated_at: input.expectedJobUpdatedAt,
        p_expected_appointment_updated_at: input.expectedAppointmentUpdatedAt,
      });
      if (error) throw error;
      const result = unwrapRpcObject(data);
      return {
        operation: mapCommunicationOperation((result.operation ?? {}) as Row),
        replayed: Boolean(result.replayed),
      };
    } catch (error) {
      throw toSafeCommunicationRepositoryError(error);
    }
  }

  async simulateCommunicationOperation(
    input: SimulateCommunicationOperationInput,
  ): Promise<CommunicationOperationResult> {
    try {
      const { data, error } = await this.client.rpc('simulate_communication_operation', {
        p_tenant_id: this.tenantId,
        p_operation_id: input.operationId,
        p_scenario: input.scenario,
        p_operation_key: input.operationKey,
        p_expected_updated_at: input.expectedUpdatedAt,
      });
      if (error) throw error;
      const result = unwrapRpcObject(data);
      return {
        operation: mapCommunicationOperation((result.operation ?? {}) as Row),
        replayed: Boolean(result.replayed),
      };
    } catch (error) {
      throw toSafeCommunicationRepositoryError(error);
    }
  }

  async recoverCommunicationOperation(
    operationId: string,
    operationKey: string,
  ): Promise<CommunicationOperationResult> {
    try {
      const { data, error } = await this.client.rpc('recover_communication_operation', {
        p_tenant_id: this.tenantId,
        p_operation_id: operationId,
        p_operation_key: operationKey,
      });
      if (error) throw error;
      const result = unwrapRpcObject(data);
      return {
        operation: mapCommunicationOperation((result.operation ?? {}) as Row),
        replayed: Boolean(result.replayed),
        recoveryOnly: Boolean(result.recoveryOnly),
      };
    } catch (error) {
      throw toSafeCommunicationRepositoryError(error);
    }
  }
}

export function createCommunicationOrchestrationRepository(options: {
  tenantId: string;
  client?: SupabaseClient | null;
}): CommunicationOrchestrationRepository {
  const client = options.client ?? supabase;
  if (!client) {
    throw new CommunicationOrchestrationRepositoryError('read_failed');
  }
  return new SupabaseCommunicationOrchestrationRepository(options.tenantId, client);
}
