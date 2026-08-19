import { supabase as _supabase } from '../../lib/supabaseClient';

export type LaboratoryWorkOrderStatus = 'in_progress' | 'completed';
export type LaboratoryAnatomicalScope = 'upper_jaw' | 'lower_jaw' | 'oral_cavity' | 'selected_teeth';

export interface LaboratoryRecord {
  id: string;
  tenantId: string;
  name: string;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LaboratoryWorkTypeRecord {
  id: string;
  tenantId: string;
  name: string;
  code: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface LaboratoryWorkOrderRecord {
  id: string;
  tenantId: string;
  patientId: string;
  responsibleDoctorId: string | null;
  laboratoryId: string | null;
  orderNumber: string | null;
  title: string;
  status: LaboratoryWorkOrderStatus;
  sentToLabAt: string | null;
  plannedReadyAt: string | null;
  receivedFromLabAt: string | null;
  tryInAt: string | null;
  deliveredToPatientAt: string | null;
  shade: string | null;
  anatomicalScope: LaboratoryAnatomicalScope | null;
  selectedTeeth: number[];
  comment: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLaboratoryInput {
  name: string;
  notes?: string | null;
}

export interface UpdateLaboratoryInput {
  name?: string;
  active?: boolean;
  notes?: string | null;
}

export interface CreateLaboratoryWorkTypeInput {
  name: string;
  code?: string | null;
  sortOrder?: number;
}

export interface UpdateLaboratoryWorkTypeInput {
  name?: string;
  code?: string | null;
  active?: boolean;
  sortOrder?: number;
}

export interface CreateLaboratoryWorkOrderInput {
  patientId: string;
  responsibleDoctorId?: string | null;
  laboratoryId?: string | null;
  orderNumber?: string | null;
  title: string;
  status?: LaboratoryWorkOrderStatus;
  sentToLabAt?: string | null;
  plannedReadyAt?: string | null;
  receivedFromLabAt?: string | null;
  tryInAt?: string | null;
  deliveredToPatientAt?: string | null;
  shade?: string | null;
  anatomicalScope?: LaboratoryAnatomicalScope | null;
  selectedTeeth?: number[];
  comment?: string | null;
}

export interface UpdateLaboratoryWorkOrderInput {
  responsibleDoctorId?: string | null;
  laboratoryId?: string | null;
  orderNumber?: string | null;
  title?: string;
  status?: LaboratoryWorkOrderStatus;
  sentToLabAt?: string | null;
  plannedReadyAt?: string | null;
  receivedFromLabAt?: string | null;
  tryInAt?: string | null;
  deliveredToPatientAt?: string | null;
  shade?: string | null;
  anatomicalScope?: LaboratoryAnatomicalScope | null;
  selectedTeeth?: number[];
  comment?: string | null;
}

export interface LaboratoryWorkOrderFilters {
  patientId?: string;
  status?: LaboratoryWorkOrderStatus;
  laboratoryId?: string;
  responsibleDoctorId?: string;
}

export interface LaboratoryWorkOrderTypeLinkRecord {
  orderId: string;
  workTypeId: string;
}

export interface ILaboratoryWorkRepository {
  listLaboratories(includeInactive?: boolean): Promise<LaboratoryRecord[]>;
  createLaboratory(input: CreateLaboratoryInput): Promise<LaboratoryRecord>;
  updateLaboratory(id: string, input: UpdateLaboratoryInput): Promise<LaboratoryRecord>;

  listWorkTypes(includeInactive?: boolean): Promise<LaboratoryWorkTypeRecord[]>;
  createWorkType(input: CreateLaboratoryWorkTypeInput): Promise<LaboratoryWorkTypeRecord>;
  updateWorkType(id: string, input: UpdateLaboratoryWorkTypeInput): Promise<LaboratoryWorkTypeRecord>;

  listOrders(filters?: LaboratoryWorkOrderFilters): Promise<LaboratoryWorkOrderRecord[]>;
  getOrder(id: string): Promise<LaboratoryWorkOrderRecord | null>;
  createOrder(input: CreateLaboratoryWorkOrderInput): Promise<LaboratoryWorkOrderRecord>;
  updateOrder(id: string, input: UpdateLaboratoryWorkOrderInput): Promise<LaboratoryWorkOrderRecord>;

  listOrderWorkTypeIds(orderId: string): Promise<string[]>;
  listOrderWorkTypeLinks(orderIds: string[]): Promise<LaboratoryWorkOrderTypeLinkRecord[]>;
  addOrderWorkType(orderId: string, workTypeId: string): Promise<void>;
  removeOrderWorkType(orderId: string, workTypeId: string): Promise<void>;
}

export const ACTIVE_CLINIC_REQUIRED_FOR_LAB_ERROR = 'Active clinic is required for laboratory work access.';

interface RepositoryConfig {
  backend: 'local' | 'supabase';
  tenantId?: string;
  userId?: string;
}

type SupabaseClient = NonNullable<typeof _supabase>;

const VALID_FDI_TEETH = new Set([
  11, 12, 13, 14, 15, 16, 17, 18,
  21, 22, 23, 24, 25, 26, 27, 28,
  31, 32, 33, 34, 35, 36, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48,
  51, 52, 53, 54, 55,
  61, 62, 63, 64, 65,
  71, 72, 73, 74, 75,
  81, 82, 83, 84, 85,
]);

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function requireNonEmptyText(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${fieldName} is required`);
  return trimmed;
}

function validateSelectedTeeth(teeth: number[] | undefined): number[] | undefined {
  if (teeth === undefined) return undefined;
  if (teeth.some(tooth => !VALID_FDI_TEETH.has(tooth))) {
    throw new Error('selectedTeeth contains an invalid FDI tooth number');
  }
  return [...teeth];
}

function mapLaboratoryRow(row: Record<string, unknown>): LaboratoryRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    active: row.active !== false,
    notes: row.notes == null ? null : String(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapWorkTypeRow(row: Record<string, unknown>): LaboratoryWorkTypeRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    code: row.code == null ? null : String(row.code),
    active: row.active !== false,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapOrderRow(row: Record<string, unknown>): LaboratoryWorkOrderRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    patientId: String(row.patient_id),
    responsibleDoctorId: row.responsible_doctor_id == null ? null : String(row.responsible_doctor_id),
    laboratoryId: row.laboratory_id == null ? null : String(row.laboratory_id),
    orderNumber: row.order_number == null ? null : String(row.order_number),
    title: String(row.title),
    status: row.status as LaboratoryWorkOrderStatus,
    sentToLabAt: row.sent_to_lab_at == null ? null : String(row.sent_to_lab_at),
    plannedReadyAt: row.planned_ready_at == null ? null : String(row.planned_ready_at),
    receivedFromLabAt: row.received_from_lab_at == null ? null : String(row.received_from_lab_at),
    tryInAt: row.try_in_at == null ? null : String(row.try_in_at),
    deliveredToPatientAt: row.delivered_to_patient_at == null ? null : String(row.delivered_to_patient_at),
    shade: row.shade == null ? null : String(row.shade),
    anatomicalScope: row.anatomical_scope == null ? null : row.anatomical_scope as LaboratoryAnatomicalScope,
    selectedTeeth: Array.isArray(row.selected_teeth) ? row.selected_teeth.map(Number) : [],
    comment: row.comment == null ? null : String(row.comment),
    createdBy: row.created_by == null ? null : String(row.created_by),
    updatedBy: row.updated_by == null ? null : String(row.updated_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function buildOrderPayload(input: CreateLaboratoryWorkOrderInput | UpdateLaboratoryWorkOrderInput, userId?: string) {
  const payload: Record<string, unknown> = {};

  if ('patientId' in input) payload.patient_id = input.patientId;
  if (input.responsibleDoctorId !== undefined) payload.responsible_doctor_id = input.responsibleDoctorId;
  if (input.laboratoryId !== undefined) payload.laboratory_id = input.laboratoryId;
  if (input.orderNumber !== undefined) payload.order_number = normalizeOptionalText(input.orderNumber);
  if (input.title !== undefined) payload.title = requireNonEmptyText(input.title, 'title');
  if (input.status !== undefined) payload.status = input.status;
  if (input.sentToLabAt !== undefined) payload.sent_to_lab_at = input.sentToLabAt;
  if (input.plannedReadyAt !== undefined) payload.planned_ready_at = input.plannedReadyAt;
  if (input.receivedFromLabAt !== undefined) payload.received_from_lab_at = input.receivedFromLabAt;
  if (input.tryInAt !== undefined) payload.try_in_at = input.tryInAt;
  if (input.deliveredToPatientAt !== undefined) payload.delivered_to_patient_at = input.deliveredToPatientAt;
  if (input.shade !== undefined) payload.shade = normalizeOptionalText(input.shade);
  if (input.anatomicalScope !== undefined) payload.anatomical_scope = input.anatomicalScope;
  if (input.selectedTeeth !== undefined) payload.selected_teeth = validateSelectedTeeth(input.selectedTeeth);
  if (input.comment !== undefined) payload.comment = normalizeOptionalText(input.comment);
  if (userId) payload.updated_by = userId;

  return payload;
}

export class SupabaseLaboratoryWorkRepository implements ILaboratoryWorkRepository {
  private readonly tenantId: string;
  private readonly userId?: string;
  private readonly client: SupabaseClient;

  constructor(tenantId?: string, userId?: string, client: SupabaseClient | null = _supabase) {
    if (!tenantId) throw new Error(ACTIVE_CLINIC_REQUIRED_FOR_LAB_ERROR);
    if (!client) throw new Error('Supabase client is not configured');
    this.tenantId = tenantId;
    this.userId = userId;
    this.client = client;
  }

  async listLaboratories(includeInactive = false): Promise<LaboratoryRecord[]> {
    let query = this.client.from('laboratories').select('*').eq('tenant_id', this.tenantId);
    if (!includeInactive) query = query.eq('active', true);
    const { data, error } = await query.order('name', { ascending: true }).order('id', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapLaboratoryRow);
  }

  async createLaboratory(input: CreateLaboratoryInput): Promise<LaboratoryRecord> {
    const payload = {
      tenant_id: this.tenantId,
      name: requireNonEmptyText(input.name, 'name'),
      notes: normalizeOptionalText(input.notes),
    };
    const { data, error } = await this.client.from('laboratories').insert(payload).select('*').single();
    if (error) throw error;
    return mapLaboratoryRow(data as Record<string, unknown>);
  }

  async updateLaboratory(id: string, input: UpdateLaboratoryInput): Promise<LaboratoryRecord> {
    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = requireNonEmptyText(input.name, 'name');
    if (input.active !== undefined) payload.active = input.active;
    if (input.notes !== undefined) payload.notes = normalizeOptionalText(input.notes);

    const { data, error } = await this.client
      .from('laboratories')
      .update(payload)
      .eq('tenant_id', this.tenantId)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapLaboratoryRow(data as Record<string, unknown>);
  }

  async listWorkTypes(includeInactive = false): Promise<LaboratoryWorkTypeRecord[]> {
    let query = this.client.from('laboratory_work_types').select('*').eq('tenant_id', this.tenantId);
    if (!includeInactive) query = query.eq('active', true);
    const { data, error } = await query.order('sort_order', { ascending: true }).order('name', { ascending: true }).order('id', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapWorkTypeRow);
  }

  async createWorkType(input: CreateLaboratoryWorkTypeInput): Promise<LaboratoryWorkTypeRecord> {
    const payload = {
      tenant_id: this.tenantId,
      name: requireNonEmptyText(input.name, 'name'),
      code: normalizeOptionalText(input.code),
      sort_order: input.sortOrder ?? 0,
    };
    const { data, error } = await this.client.from('laboratory_work_types').insert(payload).select('*').single();
    if (error) throw error;
    return mapWorkTypeRow(data as Record<string, unknown>);
  }

  async updateWorkType(id: string, input: UpdateLaboratoryWorkTypeInput): Promise<LaboratoryWorkTypeRecord> {
    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = requireNonEmptyText(input.name, 'name');
    if (input.code !== undefined) payload.code = normalizeOptionalText(input.code);
    if (input.active !== undefined) payload.active = input.active;
    if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;

    const { data, error } = await this.client
      .from('laboratory_work_types')
      .update(payload)
      .eq('tenant_id', this.tenantId)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapWorkTypeRow(data as Record<string, unknown>);
  }

  async listOrders(filters: LaboratoryWorkOrderFilters = {}): Promise<LaboratoryWorkOrderRecord[]> {
    let query = this.client.from('laboratory_work_orders').select('*').eq('tenant_id', this.tenantId);
    if (filters.patientId) query = query.eq('patient_id', filters.patientId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.laboratoryId) query = query.eq('laboratory_id', filters.laboratoryId);
    if (filters.responsibleDoctorId) query = query.eq('responsible_doctor_id', filters.responsibleDoctorId);
    const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapOrderRow);
  }

  async getOrder(id: string): Promise<LaboratoryWorkOrderRecord | null> {
    const { data, error } = await this.client
      .from('laboratory_work_orders')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapOrderRow(data as Record<string, unknown>) : null;
  }

  async createOrder(input: CreateLaboratoryWorkOrderInput): Promise<LaboratoryWorkOrderRecord> {
    const payload = {
      tenant_id: this.tenantId,
      ...buildOrderPayload(input, this.userId),
      created_by: this.userId ?? null,
      updated_by: this.userId ?? null,
    };
    const { data, error } = await this.client.from('laboratory_work_orders').insert(payload).select('*').single();
    if (error) throw error;
    return mapOrderRow(data as Record<string, unknown>);
  }

  async updateOrder(id: string, input: UpdateLaboratoryWorkOrderInput): Promise<LaboratoryWorkOrderRecord> {
    const payload = buildOrderPayload(input, this.userId);
    const { data, error } = await this.client
      .from('laboratory_work_orders')
      .update(payload)
      .eq('tenant_id', this.tenantId)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapOrderRow(data as Record<string, unknown>);
  }

  async listOrderWorkTypeIds(orderId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('laboratory_work_order_types')
      .select('laboratory_work_type_id')
      .eq('tenant_id', this.tenantId)
      .eq('laboratory_work_order_id', orderId)
      .order('laboratory_work_type_id', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Array<{ laboratory_work_type_id: string }>).map(row => row.laboratory_work_type_id);
  }

  async listOrderWorkTypeLinks(orderIds: string[]): Promise<LaboratoryWorkOrderTypeLinkRecord[]> {
    const uniqueOrderIds = [...new Set(orderIds.filter(Boolean))].sort();
    if (uniqueOrderIds.length === 0) return [];

    const { data, error } = await this.client
      .from('laboratory_work_order_types')
      .select('laboratory_work_order_id,laboratory_work_type_id')
      .eq('tenant_id', this.tenantId)
      .in('laboratory_work_order_id', uniqueOrderIds)
      .order('laboratory_work_order_id', { ascending: true })
      .order('laboratory_work_type_id', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Array<{ laboratory_work_order_id: string; laboratory_work_type_id: string }>).map(row => ({
      orderId: row.laboratory_work_order_id,
      workTypeId: row.laboratory_work_type_id,
    }));
  }

  async addOrderWorkType(orderId: string, workTypeId: string): Promise<void> {
    const { error } = await this.client.from('laboratory_work_order_types').upsert({
      tenant_id: this.tenantId,
      laboratory_work_order_id: orderId,
      laboratory_work_type_id: workTypeId,
    }, {
      onConflict: 'tenant_id,laboratory_work_order_id,laboratory_work_type_id',
      ignoreDuplicates: true,
    });
    if (error) throw error;
  }

  async removeOrderWorkType(orderId: string, workTypeId: string): Promise<void> {
    const { error } = await this.client
      .from('laboratory_work_order_types')
      .delete()
      .eq('tenant_id', this.tenantId)
      .eq('laboratory_work_order_id', orderId)
      .eq('laboratory_work_type_id', workTypeId);
    if (error) throw error;
  }
}

const LOCAL_LABS_KEY = 'dentalflow_laboratories';
const LOCAL_WORK_TYPES_KEY = 'dentalflow_laboratory_work_types';
const LOCAL_ORDERS_KEY = 'dentalflow_laboratory_work_orders';
const LOCAL_ORDER_TYPES_KEY = 'dentalflow_laboratory_work_order_types';

interface LocalOrderTypeLink {
  tenantId: string;
  orderId: string;
  workTypeId: string;
}

function localKey(base: string, tenantId: string) {
  return `${base}:${tenantId}`;
}

function readLocal<T>(base: string, tenantId: string): T[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(localKey(base, tenantId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(base: string, tenantId: string, values: T[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(localKey(base, tenantId), JSON.stringify(values));
}

function localUuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class LocalStorageLaboratoryWorkRepository implements ILaboratoryWorkRepository {
  private readonly tenantId: string;

  constructor(tenantId = 'local-dev-tenant') {
    this.tenantId = tenantId;
  }

  async listLaboratories(includeInactive = false): Promise<LaboratoryRecord[]> {
    return readLocal<LaboratoryRecord>(LOCAL_LABS_KEY, this.tenantId)
      .filter(item => includeInactive || item.active)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  async createLaboratory(input: CreateLaboratoryInput): Promise<LaboratoryRecord> {
    const now = new Date().toISOString();
    const record: LaboratoryRecord = {
      id: localUuid(), tenantId: this.tenantId, name: requireNonEmptyText(input.name, 'name'), active: true,
      notes: normalizeOptionalText(input.notes), createdAt: now, updatedAt: now,
    };
    writeLocal(LOCAL_LABS_KEY, this.tenantId, [...readLocal<LaboratoryRecord>(LOCAL_LABS_KEY, this.tenantId), record]);
    return record;
  }

  async updateLaboratory(id: string, input: UpdateLaboratoryInput): Promise<LaboratoryRecord> {
    const all = readLocal<LaboratoryRecord>(LOCAL_LABS_KEY, this.tenantId);
    const existing = all.find(item => item.id === id);
    if (!existing) throw new Error('Laboratory not found');
    const next: LaboratoryRecord = {
      ...existing,
      ...(input.name !== undefined ? { name: requireNonEmptyText(input.name, 'name') } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.notes !== undefined ? { notes: normalizeOptionalText(input.notes) } : {}),
      updatedAt: new Date().toISOString(),
    };
    writeLocal(LOCAL_LABS_KEY, this.tenantId, all.map(item => item.id === id ? next : item));
    return next;
  }

  async listWorkTypes(includeInactive = false): Promise<LaboratoryWorkTypeRecord[]> {
    return readLocal<LaboratoryWorkTypeRecord>(LOCAL_WORK_TYPES_KEY, this.tenantId)
      .filter(item => includeInactive || item.active)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  async createWorkType(input: CreateLaboratoryWorkTypeInput): Promise<LaboratoryWorkTypeRecord> {
    const now = new Date().toISOString();
    const record: LaboratoryWorkTypeRecord = {
      id: localUuid(), tenantId: this.tenantId, name: requireNonEmptyText(input.name, 'name'), code: normalizeOptionalText(input.code),
      active: true, sortOrder: input.sortOrder ?? 0, createdAt: now, updatedAt: now,
    };
    writeLocal(LOCAL_WORK_TYPES_KEY, this.tenantId, [...readLocal<LaboratoryWorkTypeRecord>(LOCAL_WORK_TYPES_KEY, this.tenantId), record]);
    return record;
  }

  async updateWorkType(id: string, input: UpdateLaboratoryWorkTypeInput): Promise<LaboratoryWorkTypeRecord> {
    const all = readLocal<LaboratoryWorkTypeRecord>(LOCAL_WORK_TYPES_KEY, this.tenantId);
    const existing = all.find(item => item.id === id);
    if (!existing) throw new Error('Laboratory work type not found');
    const next: LaboratoryWorkTypeRecord = {
      ...existing,
      ...(input.name !== undefined ? { name: requireNonEmptyText(input.name, 'name') } : {}),
      ...(input.code !== undefined ? { code: normalizeOptionalText(input.code) } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      updatedAt: new Date().toISOString(),
    };
    writeLocal(LOCAL_WORK_TYPES_KEY, this.tenantId, all.map(item => item.id === id ? next : item));
    return next;
  }

  async listOrders(filters: LaboratoryWorkOrderFilters = {}): Promise<LaboratoryWorkOrderRecord[]> {
    return readLocal<LaboratoryWorkOrderRecord>(LOCAL_ORDERS_KEY, this.tenantId)
      .filter(item => !filters.patientId || item.patientId === filters.patientId)
      .filter(item => !filters.status || item.status === filters.status)
      .filter(item => !filters.laboratoryId || item.laboratoryId === filters.laboratoryId)
      .filter(item => !filters.responsibleDoctorId || item.responsibleDoctorId === filters.responsibleDoctorId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  }

  async getOrder(id: string): Promise<LaboratoryWorkOrderRecord | null> {
    return readLocal<LaboratoryWorkOrderRecord>(LOCAL_ORDERS_KEY, this.tenantId).find(item => item.id === id) ?? null;
  }

  async createOrder(input: CreateLaboratoryWorkOrderInput): Promise<LaboratoryWorkOrderRecord> {
    const now = new Date().toISOString();
    const record: LaboratoryWorkOrderRecord = {
      id: localUuid(),
      tenantId: this.tenantId,
      patientId: input.patientId,
      responsibleDoctorId: input.responsibleDoctorId ?? null,
      laboratoryId: input.laboratoryId ?? null,
      orderNumber: normalizeOptionalText(input.orderNumber),
      title: requireNonEmptyText(input.title, 'title'),
      status: input.status ?? 'in_progress',
      sentToLabAt: input.sentToLabAt ?? null,
      plannedReadyAt: input.plannedReadyAt ?? null,
      receivedFromLabAt: input.receivedFromLabAt ?? null,
      tryInAt: input.tryInAt ?? null,
      deliveredToPatientAt: input.deliveredToPatientAt ?? null,
      shade: normalizeOptionalText(input.shade),
      anatomicalScope: input.anatomicalScope ?? null,
      selectedTeeth: validateSelectedTeeth(input.selectedTeeth) ?? [],
      comment: normalizeOptionalText(input.comment),
      createdBy: null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    writeLocal(LOCAL_ORDERS_KEY, this.tenantId, [...readLocal<LaboratoryWorkOrderRecord>(LOCAL_ORDERS_KEY, this.tenantId), record]);
    return record;
  }

  async updateOrder(id: string, input: UpdateLaboratoryWorkOrderInput): Promise<LaboratoryWorkOrderRecord> {
    const all = readLocal<LaboratoryWorkOrderRecord>(LOCAL_ORDERS_KEY, this.tenantId);
    const existing = all.find(item => item.id === id);
    if (!existing) throw new Error('Laboratory work order not found');
    const next: LaboratoryWorkOrderRecord = {
      ...existing,
      ...(input.responsibleDoctorId !== undefined ? { responsibleDoctorId: input.responsibleDoctorId } : {}),
      ...(input.laboratoryId !== undefined ? { laboratoryId: input.laboratoryId } : {}),
      ...(input.orderNumber !== undefined ? { orderNumber: normalizeOptionalText(input.orderNumber) } : {}),
      ...(input.title !== undefined ? { title: requireNonEmptyText(input.title, 'title') } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.sentToLabAt !== undefined ? { sentToLabAt: input.sentToLabAt } : {}),
      ...(input.plannedReadyAt !== undefined ? { plannedReadyAt: input.plannedReadyAt } : {}),
      ...(input.receivedFromLabAt !== undefined ? { receivedFromLabAt: input.receivedFromLabAt } : {}),
      ...(input.tryInAt !== undefined ? { tryInAt: input.tryInAt } : {}),
      ...(input.deliveredToPatientAt !== undefined ? { deliveredToPatientAt: input.deliveredToPatientAt } : {}),
      ...(input.shade !== undefined ? { shade: normalizeOptionalText(input.shade) } : {}),
      ...(input.anatomicalScope !== undefined ? { anatomicalScope: input.anatomicalScope } : {}),
      ...(input.selectedTeeth !== undefined ? { selectedTeeth: validateSelectedTeeth(input.selectedTeeth) ?? [] } : {}),
      ...(input.comment !== undefined ? { comment: normalizeOptionalText(input.comment) } : {}),
      updatedAt: new Date().toISOString(),
    };
    writeLocal(LOCAL_ORDERS_KEY, this.tenantId, all.map(item => item.id === id ? next : item));
    return next;
  }

  async listOrderWorkTypeIds(orderId: string): Promise<string[]> {
    return readLocal<LocalOrderTypeLink>(LOCAL_ORDER_TYPES_KEY, this.tenantId)
      .filter(item => item.orderId === orderId)
      .map(item => item.workTypeId)
      .sort();
  }

  async listOrderWorkTypeLinks(orderIds: string[]): Promise<LaboratoryWorkOrderTypeLinkRecord[]> {
    const orderIdSet = new Set(orderIds.filter(Boolean));
    if (orderIdSet.size === 0) return [];

    return readLocal<LocalOrderTypeLink>(LOCAL_ORDER_TYPES_KEY, this.tenantId)
      .filter(item => orderIdSet.has(item.orderId))
      .map(item => ({ orderId: item.orderId, workTypeId: item.workTypeId }))
      .sort((left, right) => left.orderId.localeCompare(right.orderId) || left.workTypeId.localeCompare(right.workTypeId));
  }

  async addOrderWorkType(orderId: string, workTypeId: string): Promise<void> {
    const all = readLocal<LocalOrderTypeLink>(LOCAL_ORDER_TYPES_KEY, this.tenantId);
    if (all.some(item => item.orderId === orderId && item.workTypeId === workTypeId)) return;
    writeLocal(LOCAL_ORDER_TYPES_KEY, this.tenantId, [...all, { tenantId: this.tenantId, orderId, workTypeId }]);
  }

  async removeOrderWorkType(orderId: string, workTypeId: string): Promise<void> {
    const all = readLocal<LocalOrderTypeLink>(LOCAL_ORDER_TYPES_KEY, this.tenantId);
    writeLocal(LOCAL_ORDER_TYPES_KEY, this.tenantId, all.filter(item => !(item.orderId === orderId && item.workTypeId === workTypeId)));
  }
}

export function createLaboratoryWorkRepository(config: RepositoryConfig): ILaboratoryWorkRepository {
  if (config.backend === 'supabase') {
    if (!config.tenantId) return new LocalStorageLaboratoryWorkRepository();
    return new SupabaseLaboratoryWorkRepository(config.tenantId, config.userId);
  }
  return new LocalStorageLaboratoryWorkRepository(config.tenantId);
}
