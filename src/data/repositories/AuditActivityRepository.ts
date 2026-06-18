import { supabase as defaultSupabase } from '../../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AuditEventCategory =
  | 'auth'
  | 'tenant'
  | 'role_membership'
  | 'patient'
  | 'appointment'
  | 'visit'
  | 'encounter'
  | 'finding'
  | 'treatment_plan'
  | 'completed_service'
  | 'file'
  | 'document'
  | 'payment'
  | 'stock'
  | 'dictionary'
  | 'billing_subscription'
  | 'system'
  | 'support_access';

export type AuditEventSeverity = 'debug' | 'info' | 'warning' | 'critical';
export type AuditEventRedactionLevel = 'none' | 'standard' | 'restricted' | 'confidential';

export interface AuditEvent {
  id: string;
  tenantId: string | null;
  actorUserId: string | null;
  actorRole: string | null;
  actorTenantRole: string | null;
  actorDisplayName: string | null;
  action: string;
  category: AuditEventCategory;
  severity: AuditEventSeverity;
  targetType: string;
  targetId: string;
  patientId?: string | null;
  appointmentId?: string | null;
  visitId?: string | null;
  encounterId?: string | null;
  treatmentPlanId?: string | null;
  treatmentStageId?: string | null;
  findingId?: string | null;
  fileId?: string | null;
  paymentId?: string | null;
  stockMovementId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  diffData?: Record<string, unknown> | null;
  redactionLevel: AuditEventRedactionLevel;
  reason?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type ActivityEventCategory =
  | 'patient'
  | 'complaint'
  | 'dental_chart'
  | 'finding'
  | 'treatment_plan'
  | 'appointment'
  | 'visit'
  | 'encounter'
  | 'completed_service'
  | 'file'
  | 'document'
  | 'payment'
  | 'stock'
  | 'audit'
  | 'system';

export type ActivityEventVisibility = 'clinical' | 'admin' | 'financial' | 'system';

export interface ActivityEvent {
  id: string;
  tenantId: string;
  patientId?: string | null;
  auditEventId?: string | null;
  actorUserId?: string | null;
  category: ActivityEventCategory;
  type: string;
  title: string;
  description?: string | null;
  sourceType: string;
  sourceId: string;
  sourceStatus?: string | null;
  visibility: ActivityEventVisibility;
  severity: AuditEventSeverity;
  occurredAt: string;
  metadata: Record<string, unknown>;
  isArchived: boolean;
  createdAt: string;
}

export interface ListAuditEventsOptions {
  tenantId: string;
  categories?: AuditEventCategory[];
  severities?: AuditEventSeverity[];
  targetType?: string;
  targetId?: string;
  patientId?: string;
  actorUserId?: string;
  createdFrom?: string;
  createdTo?: string;
  limit?: number;
  offset?: number;
}

export interface ListActivityEventsOptions {
  tenantId: string;
  patientId?: string;
  categories?: ActivityEventCategory[];
  visibility?: ActivityEventVisibility[];
  sourceType?: string;
  sourceId?: string;
  occurredFrom?: string;
  occurredTo?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListPatientActivityEventsOptions {
  tenantId: string;
  patientId: string;
  includeArchived?: boolean;
  categories?: ActivityEventCategory[];
  visibility?: ActivityEventVisibility[];
  limit?: number;
  offset?: number;
}

export interface AuditActivityRepository {
  listAuditEvents(options: ListAuditEventsOptions): Promise<AuditEvent[]>;
  listActivityEvents(options: ListActivityEventsOptions): Promise<ActivityEvent[]>;
  listPatientActivityEvents(options: ListPatientActivityEventsOptions): Promise<ActivityEvent[]>;
}

export type AuditActivityRepositoryBackend = 'supabase' | 'local';

export interface CreateAuditActivityRepositoryOptions {
  backend: AuditActivityRepositoryBackend;
  client?: SupabaseClient;
}

export const ACTIVE_CLINIC_REQUIRED_FOR_AUDIT_ACTIVITY_ERROR = 'Active clinic is required for audit/activity access.';
export const PATIENT_REQUIRED_FOR_ACTIVITY_ERROR = 'Patient is required for patient activity access.';
export const DEFAULT_AUDIT_ACTIVITY_LIMIT = 50;
export const MAX_AUDIT_ACTIVITY_LIMIT = 200;

type JsonObject = Record<string, unknown>;

type AuditEventRow = {
  id: unknown;
  tenant_id: unknown;
  actor_user_id?: unknown;
  actor_role?: unknown;
  actor_tenant_role?: unknown;
  actor_display_name?: unknown;
  action: unknown;
  category: unknown;
  severity?: unknown;
  target_type: unknown;
  target_id: unknown;
  patient_id?: unknown;
  appointment_id?: unknown;
  visit_id?: unknown;
  encounter_id?: unknown;
  treatment_plan_id?: unknown;
  treatment_stage_id?: unknown;
  finding_id?: unknown;
  file_id?: unknown;
  payment_id?: unknown;
  stock_movement_id?: unknown;
  before_data?: unknown;
  after_data?: unknown;
  diff_data?: unknown;
  redaction_level?: unknown;
  reason?: unknown;
  request_id?: unknown;
  session_id?: unknown;
  ip_address?: unknown;
  user_agent?: unknown;
  metadata?: unknown;
  created_at: unknown;
};

type ActivityEventRow = {
  id: unknown;
  tenant_id: unknown;
  patient_id?: unknown;
  audit_event_id?: unknown;
  actor_user_id?: unknown;
  category: unknown;
  type: unknown;
  title: unknown;
  description?: unknown;
  source_type: unknown;
  source_id: unknown;
  source_status?: unknown;
  visibility: unknown;
  severity?: unknown;
  occurred_at: unknown;
  metadata?: unknown;
  is_archived?: unknown;
  created_at: unknown;
};

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function jsonObjectOrNull(value: unknown): JsonObject | null {
  if (value === null || value === undefined) return null;
  return isRecord(value) ? value : {};
}

function metadataObject(value: unknown): JsonObject {
  return isRecord(value) ? value : {};
}

function requireTenantId(tenantId: string | null | undefined): string {
  if (!tenantId || tenantId.trim().length === 0) throw new Error(ACTIVE_CLINIC_REQUIRED_FOR_AUDIT_ACTIVITY_ERROR);
  return tenantId;
}

function requirePatientId(patientId: string | null | undefined): string {
  if (!patientId || patientId.trim().length === 0) throw new Error(PATIENT_REQUIRED_FOR_ACTIVITY_ERROR);
  return patientId;
}

export function normalizeAuditActivityLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_AUDIT_ACTIVITY_LIMIT;
  return Math.max(1, Math.min(MAX_AUDIT_ACTIVITY_LIMIT, Math.floor(limit)));
}

export function normalizeAuditActivityOffset(offset?: number): number {
  if (offset === undefined || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.floor(offset));
}

export function mapAuditEventRow(row: AuditEventRow | Record<string, unknown>): AuditEvent {
  return {
    id: String(row.id),
    tenantId: nullableString(row.tenant_id),
    actorUserId: nullableString(row.actor_user_id),
    actorRole: nullableString(row.actor_role),
    actorTenantRole: nullableString(row.actor_tenant_role),
    actorDisplayName: nullableString(row.actor_display_name),
    action: String(row.action),
    category: String(row.category) as AuditEventCategory,
    severity: String(row.severity ?? 'info') as AuditEventSeverity,
    targetType: String(row.target_type),
    targetId: String(row.target_id),
    patientId: nullableString(row.patient_id),
    appointmentId: nullableString(row.appointment_id),
    visitId: nullableString(row.visit_id),
    encounterId: nullableString(row.encounter_id),
    treatmentPlanId: nullableString(row.treatment_plan_id),
    treatmentStageId: nullableString(row.treatment_stage_id),
    findingId: nullableString(row.finding_id),
    fileId: nullableString(row.file_id),
    paymentId: nullableString(row.payment_id),
    stockMovementId: nullableString(row.stock_movement_id),
    beforeData: jsonObjectOrNull(row.before_data),
    afterData: jsonObjectOrNull(row.after_data),
    diffData: jsonObjectOrNull(row.diff_data),
    redactionLevel: String(row.redaction_level ?? 'standard') as AuditEventRedactionLevel,
    reason: nullableString(row.reason),
    requestId: nullableString(row.request_id),
    sessionId: nullableString(row.session_id),
    ipAddress: nullableString(row.ip_address),
    userAgent: nullableString(row.user_agent),
    metadata: metadataObject(row.metadata),
    createdAt: String(row.created_at),
  };
}

export function mapActivityEventRow(row: ActivityEventRow | Record<string, unknown>): ActivityEvent {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    patientId: nullableString(row.patient_id),
    auditEventId: nullableString(row.audit_event_id),
    actorUserId: nullableString(row.actor_user_id),
    category: String(row.category) as ActivityEventCategory,
    type: String(row.type),
    title: String(row.title),
    description: nullableString(row.description),
    sourceType: String(row.source_type),
    sourceId: String(row.source_id),
    sourceStatus: nullableString(row.source_status),
    visibility: String(row.visibility) as ActivityEventVisibility,
    severity: String(row.severity ?? 'info') as AuditEventSeverity,
    occurredAt: String(row.occurred_at),
    metadata: metadataObject(row.metadata),
    isArchived: Boolean(row.is_archived),
    createdAt: String(row.created_at),
  };
}

export class SupabaseAuditActivityRepository implements AuditActivityRepository {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async listAuditEvents(options: ListAuditEventsOptions): Promise<AuditEvent[]> {
    const tenantId = requireTenantId(options.tenantId);
    const limit = normalizeAuditActivityLimit(options.limit);
    const offset = normalizeAuditActivityOffset(options.offset);

    let query = this.client
      .from('audit_events')
      .select('*')
      .eq('tenant_id', tenantId);

    if (options.categories?.length) query = query.in('category', options.categories);
    if (options.severities?.length) query = query.in('severity', options.severities);
    if (options.targetType) query = query.eq('target_type', options.targetType);
    if (options.targetId) query = query.eq('target_id', options.targetId);
    if (options.patientId) query = query.eq('patient_id', options.patientId);
    if (options.actorUserId) query = query.eq('actor_user_id', options.actorUserId);
    if (options.createdFrom) query = query.gte('created_at', options.createdFrom);
    if (options.createdTo) query = query.lte('created_at', options.createdTo);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapAuditEventRow);
  }

  async listActivityEvents(options: ListActivityEventsOptions): Promise<ActivityEvent[]> {
    const tenantId = requireTenantId(options.tenantId);
    const limit = normalizeAuditActivityLimit(options.limit);
    const offset = normalizeAuditActivityOffset(options.offset);

    let query = this.client
      .from('activity_events')
      .select('*')
      .eq('tenant_id', tenantId);

    if (options.patientId) query = query.eq('patient_id', options.patientId);
    if (!options.includeArchived) query = query.eq('is_archived', false);
    if (options.categories?.length) query = query.in('category', options.categories);
    if (options.visibility?.length) query = query.in('visibility', options.visibility);
    if (options.sourceType) query = query.eq('source_type', options.sourceType);
    if (options.sourceId) query = query.eq('source_id', options.sourceId);
    if (options.occurredFrom) query = query.gte('occurred_at', options.occurredFrom);
    if (options.occurredTo) query = query.lte('occurred_at', options.occurredTo);

    const { data, error } = await query
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapActivityEventRow);
  }

  async listPatientActivityEvents(options: ListPatientActivityEventsOptions): Promise<ActivityEvent[]> {
    return this.listActivityEvents({
      tenantId: requireTenantId(options.tenantId),
      patientId: requirePatientId(options.patientId),
      categories: options.categories,
      visibility: options.visibility,
      includeArchived: options.includeArchived,
      limit: options.limit,
      offset: options.offset,
    });
  }
}

export function createAuditActivityRepository(options: CreateAuditActivityRepositoryOptions): AuditActivityRepository {
  if (options.backend === 'local') {
    throw new Error('Audit/activity repository does not support localStorage fallback.');
  }

  const client = options.client ?? defaultSupabase;
  if (!client) {
    throw new Error('Supabase client is not configured for audit/activity access.');
  }

  return new SupabaseAuditActivityRepository(client as SupabaseClient);
}
