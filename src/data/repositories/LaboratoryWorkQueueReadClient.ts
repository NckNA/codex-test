import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../../lib/supabaseClient';
import {
  mapLaboratoryWorkOrderRow,
  type LaboratoryWorkOrderRecord,
  type LaboratoryWorkOrderStatus,
} from './LaboratoryWorkRepository';

export type LaboratoryWorkQueueDueFilter = 'all' | 'overdue' | 'today' | 'upcoming' | 'unscheduled';

export interface LaboratoryWorkQueuePageRequest {
  tenantId: string;
  status?: LaboratoryWorkOrderStatus;
  responsibleDoctorId?: string;
  laboratoryId?: string;
  dueFilter?: LaboratoryWorkQueueDueFilter;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LaboratoryWorkQueuePageResult {
  items: LaboratoryWorkOrderRecord[];
  totalFiltered: number;
  limit: number;
  offset: number;
}

export interface LaboratoryWorkQueueSummary {
  inProgress: number;
  overdue: number;
  completed: number;
}

export interface LaboratoryWorkQueueOrderReferences {
  responsibleDoctorName: string | null;
  laboratoryName: string | null;
  workTypeNames: string[];
}

export type LaboratoryWorkQueueReferencesByOrderId = Record<string, LaboratoryWorkQueueOrderReferences>;

export interface LaboratoryWorkQueueFilterOption {
  id: string;
  label: string;
}

export interface LaboratoryWorkQueueFilterOptions {
  doctors: LaboratoryWorkQueueFilterOption[];
  laboratories: LaboratoryWorkQueueFilterOption[];
}

export interface LaboratoryWorkQueueReadClient {
  listPage(request: LaboratoryWorkQueuePageRequest): Promise<LaboratoryWorkQueuePageResult>;
  getSummary(tenantId: string): Promise<LaboratoryWorkQueueSummary>;
  listPageReferences(tenantId: string, orders: LaboratoryWorkOrderRecord[]): Promise<LaboratoryWorkQueueReferencesByOrderId>;
  listFilterOptions(tenantId: string): Promise<LaboratoryWorkQueueFilterOptions>;
}

export interface CreateLaboratoryWorkQueueReadClientOptions {
  backend: 'supabase';
  client?: SupabaseClient | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const EXACT_ID_CHUNK_SIZE = 100;

function requiredId(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function optionalText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function boundedLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`Laboratory queue limit must be an integer between 1 and ${MAX_LIMIT}.`);
  }
  return limit;
}

function nonNegativeOffset(value: number | undefined): number {
  const offset = value ?? 0;
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('Laboratory queue offset must be a non-negative integer.');
  }
  return offset;
}

function nonNegativeInteger(value: unknown, label: string): number {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new Error(`Invalid laboratory queue ${label}.`);
  }
  return numberValue;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid laboratory queue ${label} payload.`);
  }
  return value as Record<string, unknown>;
}

function normalizedIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim() ?? '').filter(Boolean))].sort();
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function sortOptions(options: LaboratoryWorkQueueFilterOption[]): LaboratoryWorkQueueFilterOption[] {
  return [...options].sort((left, right) => left.label.localeCompare(right.label, 'ru') || left.id.localeCompare(right.id));
}

function sortWorkTypeRows(rows: Array<{ id: string; name: string; sortOrder: number }>) {
  return [...rows].sort((left, right) => (
    left.sortOrder - right.sortOrder
    || left.name.localeCompare(right.name, 'ru')
    || left.id.localeCompare(right.id)
  ));
}

export class SupabaseLaboratoryWorkQueueReadClient implements LaboratoryWorkQueueReadClient {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async listPage(request: LaboratoryWorkQueuePageRequest): Promise<LaboratoryWorkQueuePageResult> {
    const tenantId = requiredId(request.tenantId, 'tenantId');
    const limit = boundedLimit(request.limit);
    const offset = nonNegativeOffset(request.offset);

    const { data, error } = await this.client.rpc('list_laboratory_work_queue_page', {
      p_tenant_id: tenantId,
      p_status: request.status ?? null,
      p_responsible_doctor_id: optionalText(request.responsibleDoctorId),
      p_laboratory_id: optionalText(request.laboratoryId),
      p_due_filter: request.dueFilter ?? null,
      p_search: optionalText(request.search),
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw error;

    const payload = asRecord(data, 'page');
    if (!Array.isArray(payload.items)) throw new Error('Invalid laboratory queue page items payload.');

    const items = payload.items.map((row) => mapLaboratoryWorkOrderRow(asRecord(row, 'order')));
    if (items.some((item) => item.tenantId !== tenantId)) {
      throw new Error('LAB_QUEUE_TENANT_MISMATCH');
    }

    const responseLimit = nonNegativeInteger(payload.limit, 'limit');
    if (responseLimit < 1 || responseLimit > MAX_LIMIT) throw new Error('Invalid laboratory queue limit payload.');

    return {
      items,
      totalFiltered: nonNegativeInteger(payload.totalFiltered, 'totalFiltered'),
      limit: responseLimit,
      offset: nonNegativeInteger(payload.offset, 'offset'),
    };
  }

  async getSummary(tenantIdInput: string): Promise<LaboratoryWorkQueueSummary> {
    const tenantId = requiredId(tenantIdInput, 'tenantId');
    const { data, error } = await this.client.rpc('get_laboratory_work_queue_summary', {
      p_tenant_id: tenantId,
    });
    if (error) throw error;

    const payload = asRecord(data, 'summary');
    return {
      inProgress: nonNegativeInteger(payload.inProgress, 'summary.inProgress'),
      overdue: nonNegativeInteger(payload.overdue, 'summary.overdue'),
      completed: nonNegativeInteger(payload.completed, 'summary.completed'),
    };
  }

  private async listExactRows(
    table: 'doctors' | 'laboratories' | 'laboratory_work_types',
    select: string,
    tenantId: string,
    ids: string[],
  ): Promise<Record<string, unknown>[]> {
    if (ids.length === 0) return [];

    const rows: Record<string, unknown>[] = [];
    for (const idChunk of chunks(ids, EXACT_ID_CHUNK_SIZE)) {
      const { data, error } = await this.client
        .from(table)
        .select(select)
        .eq('tenant_id', tenantId)
        .in('id', idChunk);
      if (error) throw error;
      rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    }
    return rows;
  }

  async listPageReferences(
    tenantIdInput: string,
    orders: LaboratoryWorkOrderRecord[],
  ): Promise<LaboratoryWorkQueueReferencesByOrderId> {
    const tenantId = requiredId(tenantIdInput, 'tenantId');
    const pageOrders = orders.filter((order) => order.tenantId === tenantId);
    if (pageOrders.length !== orders.length) throw new Error('LAB_QUEUE_TENANT_MISMATCH');

    const orderIds = normalizedIds(pageOrders.map((order) => order.id));
    if (orderIds.length === 0) return {};

    const doctorIds = normalizedIds(pageOrders.map((order) => order.responsibleDoctorId));
    const laboratoryIds = normalizedIds(pageOrders.map((order) => order.laboratoryId));

    const { data: linkData, error: linkError } = await this.client
      .from('laboratory_work_order_types')
      .select('laboratory_work_order_id,laboratory_work_type_id')
      .eq('tenant_id', tenantId)
      .in('laboratory_work_order_id', orderIds);
    if (linkError) throw linkError;

    const requestedOrderIds = new Set(orderIds);
    const links = ((linkData ?? []) as Array<Record<string, unknown>>)
      .map((row) => ({
        orderId: String(row.laboratory_work_order_id ?? ''),
        workTypeId: String(row.laboratory_work_type_id ?? ''),
      }))
      .filter((link) => requestedOrderIds.has(link.orderId) && Boolean(link.workTypeId));
    const workTypeIds = normalizedIds(links.map((link) => link.workTypeId));

    const [doctorRows, laboratoryRows, workTypeRowsRaw] = await Promise.all([
      this.listExactRows('doctors', 'id,full_name', tenantId, doctorIds),
      this.listExactRows('laboratories', 'id,name', tenantId, laboratoryIds),
      this.listExactRows('laboratory_work_types', 'id,name,sort_order', tenantId, workTypeIds),
    ]);

    const requestedDoctorIds = new Set(doctorIds);
    const requestedLaboratoryIds = new Set(laboratoryIds);
    const requestedWorkTypeIds = new Set(workTypeIds);

    const doctorNames = new Map(
      doctorRows
        .map((row) => [String(row.id ?? ''), String(row.full_name ?? '')] as const)
        .filter(([id, name]) => requestedDoctorIds.has(id) && Boolean(name)),
    );
    const laboratoryNames = new Map(
      laboratoryRows
        .map((row) => [String(row.id ?? ''), String(row.name ?? '')] as const)
        .filter(([id, name]) => requestedLaboratoryIds.has(id) && Boolean(name)),
    );
    const workTypeRows = sortWorkTypeRows(
      workTypeRowsRaw
        .map((row) => ({
          id: String(row.id ?? ''),
          name: String(row.name ?? ''),
          sortOrder: Number(row.sort_order ?? 0),
        }))
        .filter((row) => requestedWorkTypeIds.has(row.id) && Boolean(row.name)),
    );
    const workTypeIdsByOrderId = new Map<string, Set<string>>();
    for (const link of links) {
      const ids = workTypeIdsByOrderId.get(link.orderId) ?? new Set<string>();
      ids.add(link.workTypeId);
      workTypeIdsByOrderId.set(link.orderId, ids);
    }

    return Object.fromEntries(pageOrders.map((order) => {
      const selectedWorkTypeIds = workTypeIdsByOrderId.get(order.id) ?? new Set<string>();
      return [order.id, {
        responsibleDoctorName: order.responsibleDoctorId
          ? doctorNames.get(order.responsibleDoctorId) ?? null
          : null,
        laboratoryName: order.laboratoryId
          ? laboratoryNames.get(order.laboratoryId) ?? null
          : null,
        workTypeNames: workTypeRows
          .filter((workType) => selectedWorkTypeIds.has(workType.id))
          .map((workType) => workType.name),
      }];
    }));
  }

  async listFilterOptions(tenantIdInput: string): Promise<LaboratoryWorkQueueFilterOptions> {
    const tenantId = requiredId(tenantIdInput, 'tenantId');
    const [doctorsResult, laboratoriesResult] = await Promise.all([
      this.client.from('doctors').select('id,full_name').eq('tenant_id', tenantId).order('full_name', { ascending: true }).order('id', { ascending: true }),
      this.client.from('laboratories').select('id,name').eq('tenant_id', tenantId).order('name', { ascending: true }).order('id', { ascending: true }),
    ]);

    if (doctorsResult.error) throw doctorsResult.error;
    if (laboratoriesResult.error) throw laboratoriesResult.error;

    return {
      doctors: sortOptions(((doctorsResult.data ?? []) as Record<string, unknown>[])
        .map((row) => ({ id: String(row.id ?? ''), label: String(row.full_name ?? '') }))
        .filter((option) => option.id && option.label)),
      laboratories: sortOptions(((laboratoriesResult.data ?? []) as Record<string, unknown>[])
        .map((row) => ({ id: String(row.id ?? ''), label: String(row.name ?? '') }))
        .filter((option) => option.id && option.label)),
    };
  }
}

export function createLaboratoryWorkQueueReadClient(
  options: CreateLaboratoryWorkQueueReadClientOptions,
): LaboratoryWorkQueueReadClient {
  const client = options.client !== undefined ? options.client : defaultSupabase;
  if (!client) throw new Error('Supabase client is not configured for laboratory queue reads.');
  return new SupabaseLaboratoryWorkQueueReadClient(client);
}
