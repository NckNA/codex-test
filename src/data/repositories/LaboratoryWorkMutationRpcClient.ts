import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../../lib/supabaseClient';
import {
  mapLaboratoryWorkOrderRow,
  type LaboratoryAnatomicalScope,
  type LaboratoryWorkOrderRecord,
} from './LaboratoryWorkRepository';

export type LaboratoryMutationOperation = 'create' | 'update' | 'complete' | 'reopen';
export type LaboratoryMutationErrorCategory =
  | 'validation'
  | 'permission'
  | 'stale'
  | 'conflict'
  | 'not_found'
  | 'invalid_state'
  | 'operation_uncertain';

export class LaboratoryWorkMutationClientError extends Error {
  readonly operation: LaboratoryMutationOperation;
  readonly category: LaboratoryMutationErrorCategory;
  readonly code?: string;

  constructor(input: {
    operation: LaboratoryMutationOperation;
    category: LaboratoryMutationErrorCategory;
    message: string;
    code?: string;
  }) {
    super(input.message);
    this.name = 'LaboratoryWorkMutationClientError';
    this.operation = input.operation;
    this.category = input.category;
    this.code = input.code;
  }
}

export interface LaboratoryWorkOrderDesiredState {
  responsibleDoctorId: string | null;
  laboratoryId: string | null;
  orderNumber: string | null;
  title: string;
  sentToLabAt: string | null;
  plannedReadyAt: string | null;
  receivedFromLabAt: string | null;
  tryInAt: string | null;
  deliveredToPatientAt: string | null;
  shade: string | null;
  anatomicalScope: LaboratoryAnatomicalScope | null;
  selectedTeeth: number[];
  comment: string | null;
  workTypeIds: string[];
}

export interface CreateLaboratoryWorkOrderAtomicInput extends LaboratoryWorkOrderDesiredState {
  tenantId: string;
  orderId: string;
  patientId: string;
  requestId: string;
}

export interface UpdateLaboratoryWorkOrderAtomicInput extends LaboratoryWorkOrderDesiredState {
  tenantId: string;
  orderId: string;
  expectedVersion: number;
  requestId: string;
}

export interface CompleteLaboratoryWorkOrderAtomicInput {
  tenantId: string;
  orderId: string;
  expectedVersion: number;
  requestId: string;
}

export interface ReopenLaboratoryWorkOrderAtomicInput extends CompleteLaboratoryWorkOrderAtomicInput {
  reason: string;
}

export interface LaboratoryWorkMutationRpcClient {
  createOrder(input: CreateLaboratoryWorkOrderAtomicInput): Promise<LaboratoryWorkOrderRecord>;
  updateOrder(input: UpdateLaboratoryWorkOrderAtomicInput): Promise<LaboratoryWorkOrderRecord>;
  completeOrder(input: CompleteLaboratoryWorkOrderAtomicInput): Promise<LaboratoryWorkOrderRecord>;
  reopenOrder(input: ReopenLaboratoryWorkOrderAtomicInput): Promise<LaboratoryWorkOrderRecord>;
}

export interface CreateLaboratoryWorkMutationRpcClientOptions {
  backend: 'supabase' | 'local';
  client?: SupabaseClient | null;
}

function required(value: string | null | undefined, operation: LaboratoryMutationOperation, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new LaboratoryWorkMutationClientError({
      operation,
      category: 'validation',
      message: `${label} обязателен.`,
    });
  }
  return normalized;
}

function positiveVersion(value: number, operation: LaboratoryMutationOperation): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new LaboratoryWorkMutationClientError({
      operation,
      category: 'validation',
      message: 'Версия лабораторной работы некорректна. Обновите данные.',
    });
  }
  return value;
}

function normalizeOptionalText(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizedIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
}

function normalizedTeeth(teeth: number[]): number[] {
  return [...new Set(teeth)].sort((a, b) => a - b);
}

function extractSingleRow(data: unknown, operation: LaboratoryMutationOperation): Record<string, unknown> {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    throw new LaboratoryWorkMutationClientError({
      operation,
      category: 'operation_uncertain',
      message: 'Сервер не подтвердил результат операции с лабораторной работой.',
    });
  }
  return row as Record<string, unknown>;
}

function rawErrorParts(error: unknown) {
  if (error instanceof Error) return { message: error.message, code: undefined as string | undefined };
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      message: typeof record.message === 'string' ? record.message : '',
      code: typeof record.code === 'string' ? record.code : undefined,
    };
  }
  return { message: '', code: undefined as string | undefined };
}

export function classifyLaboratoryMutationError(
  error: unknown,
  operation: LaboratoryMutationOperation,
): LaboratoryWorkMutationClientError {
  if (error instanceof LaboratoryWorkMutationClientError) return error;

  const { message, code } = rawErrorParts(error);
  const upper = message.toUpperCase();
  const marker = upper.match(/LAB_ORDER_[A-Z_]+/)?.[0];

  if (marker === 'LAB_ORDER_ACCESS_DENIED' || marker === 'LAB_ORDER_REOPEN_ACCESS_DENIED') {
    return new LaboratoryWorkMutationClientError({
      operation,
      category: 'permission',
      code: marker,
      message: 'Недостаточно прав для изменения лабораторной работы.',
    });
  }
  if (marker === 'LAB_ORDER_STALE_WRITE') {
    return new LaboratoryWorkMutationClientError({
      operation,
      category: 'stale',
      code: marker,
      message: 'Лабораторная работа уже изменена. Обновите данные перед повтором.',
    });
  }
  if (marker === 'LAB_ORDER_CREATE_CONFLICT') {
    return new LaboratoryWorkMutationClientError({
      operation,
      category: 'conflict',
      code: marker,
      message: 'Идентификатор создания уже связан с другой версией заказа.',
    });
  }
  if (marker === 'LAB_ORDER_NOT_FOUND') {
    return new LaboratoryWorkMutationClientError({
      operation,
      category: 'not_found',
      code: marker,
      message: 'Лабораторная работа не найдена в текущей клинике.',
    });
  }
  if (
    marker === 'LAB_ORDER_EDIT_REQUIRES_IN_PROGRESS'
    || marker === 'LAB_ORDER_COMPLETE_REQUIRES_IN_PROGRESS'
    || marker === 'LAB_ORDER_REOPEN_REQUIRES_COMPLETED'
  ) {
    return new LaboratoryWorkMutationClientError({
      operation,
      category: 'invalid_state',
      code: marker,
      message: 'Текущий статус лабораторной работы не позволяет выполнить это действие.',
    });
  }
  if (
    marker === 'LAB_ORDER_REFERENCE_UNAVAILABLE'
    || marker === 'LAB_ORDER_TITLE_REQUIRED'
    || marker === 'LAB_ORDER_REQUIRED_ID_MISSING'
    || marker === 'LAB_ORDER_REOPEN_REASON_REQUIRED'
  ) {
    return new LaboratoryWorkMutationClientError({
      operation,
      category: 'validation',
      code: marker,
      message: 'Проверьте данные лабораторной работы и выбранные справочники.',
    });
  }

  return new LaboratoryWorkMutationClientError({
    operation,
    category: 'operation_uncertain',
    code,
    message: 'Не удалось подтвердить результат операции. Не создавайте новую операцию до проверки текущего состояния.',
  });
}

function desiredRpcArgs(input: LaboratoryWorkOrderDesiredState) {
  return {
    p_title: input.title.trim(),
    p_work_type_ids: normalizedIds(input.workTypeIds),
    p_responsible_doctor_id: input.responsibleDoctorId || null,
    p_laboratory_id: input.laboratoryId || null,
    p_order_number: normalizeOptionalText(input.orderNumber),
    p_sent_to_lab_at: input.sentToLabAt || null,
    p_planned_ready_at: input.plannedReadyAt || null,
    p_received_from_lab_at: input.receivedFromLabAt || null,
    p_try_in_at: input.tryInAt || null,
    p_delivered_to_patient_at: input.deliveredToPatientAt || null,
    p_shade: normalizeOptionalText(input.shade),
    p_anatomical_scope: input.anatomicalScope || null,
    p_selected_teeth: normalizedTeeth(input.selectedTeeth),
    p_comment: normalizeOptionalText(input.comment),
  };
}

export class SupabaseLaboratoryWorkMutationRpcClient implements LaboratoryWorkMutationRpcClient {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  private async invoke(
    operation: LaboratoryMutationOperation,
    rpcName: string,
    args: Record<string, unknown>,
  ): Promise<LaboratoryWorkOrderRecord> {
    try {
      const { data, error } = await this.client.rpc(rpcName, args);
      if (error) throw error;
      return mapLaboratoryWorkOrderRow(extractSingleRow(data, operation));
    } catch (error) {
      throw classifyLaboratoryMutationError(error, operation);
    }
  }

  async createOrder(input: CreateLaboratoryWorkOrderAtomicInput): Promise<LaboratoryWorkOrderRecord> {
    const operation: LaboratoryMutationOperation = 'create';
    const tenantId = required(input.tenantId, operation, 'Клиника');
    const orderId = required(input.orderId, operation, 'ID лабораторной работы');
    const patientId = required(input.patientId, operation, 'Пациент');
    const title = required(input.title, operation, 'Название лабораторной работы');
    const requestId = required(input.requestId, operation, 'ID запроса');

    return this.invoke(operation, 'create_laboratory_work_order_atomic', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_patient_id: patientId,
      ...desiredRpcArgs({ ...input, title }),
      p_request_id: requestId,
    });
  }

  async updateOrder(input: UpdateLaboratoryWorkOrderAtomicInput): Promise<LaboratoryWorkOrderRecord> {
    const operation: LaboratoryMutationOperation = 'update';
    const tenantId = required(input.tenantId, operation, 'Клиника');
    const orderId = required(input.orderId, operation, 'ID лабораторной работы');
    const title = required(input.title, operation, 'Название лабораторной работы');
    const requestId = required(input.requestId, operation, 'ID запроса');

    return this.invoke(operation, 'update_laboratory_work_order_atomic', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_expected_version: positiveVersion(input.expectedVersion, operation),
      ...desiredRpcArgs({ ...input, title }),
      p_request_id: requestId,
    });
  }

  async completeOrder(input: CompleteLaboratoryWorkOrderAtomicInput): Promise<LaboratoryWorkOrderRecord> {
    const operation: LaboratoryMutationOperation = 'complete';
    return this.invoke(operation, 'complete_laboratory_work_order_atomic', {
      p_tenant_id: required(input.tenantId, operation, 'Клиника'),
      p_order_id: required(input.orderId, operation, 'ID лабораторной работы'),
      p_expected_version: positiveVersion(input.expectedVersion, operation),
      p_request_id: required(input.requestId, operation, 'ID запроса'),
    });
  }

  async reopenOrder(input: ReopenLaboratoryWorkOrderAtomicInput): Promise<LaboratoryWorkOrderRecord> {
    const operation: LaboratoryMutationOperation = 'reopen';
    return this.invoke(operation, 'reopen_laboratory_work_order_atomic', {
      p_tenant_id: required(input.tenantId, operation, 'Клиника'),
      p_order_id: required(input.orderId, operation, 'ID лабораторной работы'),
      p_expected_version: positiveVersion(input.expectedVersion, operation),
      p_reason: required(input.reason, operation, 'Причина повторного открытия'),
      p_request_id: required(input.requestId, operation, 'ID запроса'),
    });
  }
}

export function createLaboratoryWorkMutationRpcClient(
  options: CreateLaboratoryWorkMutationRpcClientOptions,
): LaboratoryWorkMutationRpcClient {
  if (options.backend !== 'supabase') {
    throw new Error('Laboratory mutation RPC client requires Supabase backend.');
  }
  const client = options.client !== undefined ? options.client : defaultSupabase;
  if (!client) {
    throw new Error('Supabase client is not configured for laboratory mutation RPC access.');
  }
  return new SupabaseLaboratoryWorkMutationRpcClient(client);
}
