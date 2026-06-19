import { supabase as defaultSupabase } from '../../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PatientVisitStatus = 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'archived';
export type PatientVisitType = 'regular' | 'emergency' | 'consultation' | 'follow_up' | 'procedure' | 'other';

export interface PatientVisit {
  id: string;
  tenantId: string;
  patientId: string;
  appointmentId?: string | null;
  status: PatientVisitStatus;
  visitType: PatientVisitType;
  arrivedAt: string;
  checkedInAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  archivedAt?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  archivedBy?: string | null;
  notes?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ClinicalEncounterStatus = 'draft' | 'in_progress' | 'completed' | 'locked' | 'archived';
export type ClinicalEncounterType =
  | 'consultation'
  | 'treatment'
  | 'surgery'
  | 'orthodontics'
  | 'prosthetics'
  | 'hygiene'
  | 'emergency'
  | 'follow_up'
  | 'other';

export interface ClinicalEncounter {
  id: string;
  tenantId: string;
  patientId: string;
  visitId?: string | null;
  appointmentId?: string | null;
  doctorUserId?: string | null;
  status: ClinicalEncounterStatus;
  encounterType: ClinicalEncounterType;
  startedAt?: string | null;
  completedAt?: string | null;
  lockedAt?: string | null;
  archivedAt?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  lockedBy?: string | null;
  archivedBy?: string | null;
  chiefComplaintSnapshot?: string | null;
  clinicalSummary?: string | null;
  correctionReason?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type CompletedServiceStatus = 'completed' | 'corrected' | 'voided' | 'archived';

export interface CompletedService {
  id: string;
  tenantId: string;
  patientId: string;
  visitId?: string | null;
  encounterId?: string | null;
  appointmentId?: string | null;
  findingId?: string | null;
  treatmentPlanId?: string | null;
  treatmentStageId?: string | null;
  clinicalDictionaryItemId?: string | null;
  serviceCode?: string | null;
  serviceName: string;
  toothNumber?: string | null;
  toothSurface?: string | null;
  quantity: number;
  unitPrice?: number | null;
  totalAmount?: number | null;
  currency: string;
  performedBy?: string | null;
  performedAt: string;
  status: CompletedServiceStatus;
  correctionOfId?: string | null;
  correctionReason?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ListPatientVisitsOptions {
  tenantId: string;
  patientId?: string;
  appointmentId?: string;
  statuses?: PatientVisitStatus[];
  visitTypes?: PatientVisitType[];
  arrivedFrom?: string;
  arrivedTo?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListClinicalEncountersOptions {
  tenantId: string;
  patientId?: string;
  visitId?: string;
  appointmentId?: string;
  doctorUserId?: string;
  statuses?: ClinicalEncounterStatus[];
  encounterTypes?: ClinicalEncounterType[];
  createdFrom?: string;
  createdTo?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListCompletedServicesOptions {
  tenantId: string;
  patientId?: string;
  visitId?: string;
  encounterId?: string;
  appointmentId?: string;
  findingId?: string;
  treatmentPlanId?: string;
  treatmentStageId?: string;
  clinicalDictionaryItemId?: string;
  performedBy?: string;
  statuses?: CompletedServiceStatus[];
  performedFrom?: string;
  performedTo?: string;
  includeArchived?: boolean;
  includeVoided?: boolean;
  limit?: number;
  offset?: number;
}

export interface GetByIdOptions {
  tenantId: string;
  id: string;
}

export interface PatientScopedOptions {
  tenantId: string;
  patientId: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export type ListPatientClinicalWorkflowOptions = PatientScopedOptions;

export interface PatientClinicalWorkflow {
  visits: PatientVisit[];
  encounters: ClinicalEncounter[];
  completedServices: CompletedService[];
}

export interface EncounterVisitRepository {
  listPatientVisits(options: ListPatientVisitsOptions): Promise<PatientVisit[]>;
  getPatientVisitById(options: GetByIdOptions): Promise<PatientVisit | null>;
  listClinicalEncounters(options: ListClinicalEncountersOptions): Promise<ClinicalEncounter[]>;
  getClinicalEncounterById(options: GetByIdOptions): Promise<ClinicalEncounter | null>;
  listCompletedServices(options: ListCompletedServicesOptions): Promise<CompletedService[]>;
  getCompletedServiceById(options: GetByIdOptions): Promise<CompletedService | null>;
  listPatientClinicalWorkflow(options: ListPatientClinicalWorkflowOptions): Promise<PatientClinicalWorkflow>;
}

export type EncounterVisitRepositoryBackend = 'supabase' | 'local';

export interface CreateEncounterVisitRepositoryOptions {
  backend: EncounterVisitRepositoryBackend;
  client?: SupabaseClient;
}

export const ACTIVE_CLINIC_REQUIRED_FOR_ENCOUNTER_VISIT_ERROR = 'Active clinic is required for encounter/visit access.';
export const PATIENT_REQUIRED_FOR_CLINICAL_WORKFLOW_ERROR = 'Patient is required for patient clinical workflow access.';
export const RECORD_ID_REQUIRED_FOR_ENCOUNTER_VISIT_ERROR = 'Record id is required for encounter/visit access.';
export const DEFAULT_ENCOUNTER_VISIT_LIMIT = 50;
export const MAX_ENCOUNTER_VISIT_LIMIT = 200;

type JsonObject = Record<string, unknown>;

type PatientVisitRow = {
  id: unknown;
  tenant_id: unknown;
  patient_id: unknown;
  appointment_id?: unknown;
  status: unknown;
  visit_type: unknown;
  arrived_at: unknown;
  checked_in_at?: unknown;
  started_at?: unknown;
  completed_at?: unknown;
  cancelled_at?: unknown;
  archived_at?: unknown;
  created_by?: unknown;
  updated_by?: unknown;
  archived_by?: unknown;
  notes?: unknown;
  metadata?: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type ClinicalEncounterRow = {
  id: unknown;
  tenant_id: unknown;
  patient_id: unknown;
  visit_id?: unknown;
  appointment_id?: unknown;
  doctor_user_id?: unknown;
  status: unknown;
  encounter_type: unknown;
  started_at?: unknown;
  completed_at?: unknown;
  locked_at?: unknown;
  archived_at?: unknown;
  created_by?: unknown;
  updated_by?: unknown;
  locked_by?: unknown;
  archived_by?: unknown;
  chief_complaint_snapshot?: unknown;
  clinical_summary?: unknown;
  correction_reason?: unknown;
  metadata?: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type CompletedServiceRow = {
  id: unknown;
  tenant_id: unknown;
  patient_id: unknown;
  visit_id?: unknown;
  encounter_id?: unknown;
  appointment_id?: unknown;
  finding_id?: unknown;
  treatment_plan_id?: unknown;
  treatment_stage_id?: unknown;
  clinical_dictionary_item_id?: unknown;
  service_code?: unknown;
  service_name: unknown;
  tooth_number?: unknown;
  tooth_surface?: unknown;
  quantity: unknown;
  unit_price?: unknown;
  total_amount?: unknown;
  currency: unknown;
  performed_by?: unknown;
  performed_at: unknown;
  status: unknown;
  correction_of_id?: unknown;
  correction_reason?: unknown;
  voided_at?: unknown;
  voided_by?: unknown;
  archived_at?: unknown;
  archived_by?: unknown;
  created_by?: unknown;
  updated_by?: unknown;
  metadata?: unknown;
  created_at: unknown;
  updated_at: unknown;
};

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function metadataObject(value: unknown): JsonObject {
  return isRecord(value) ? value : {};
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function requiredString(value: unknown, fieldName: string): string {
  if (value === null || value === undefined) throw new Error(`Encounter/visit row is missing required field: ${fieldName}`);
  const text = String(value);
  if (text.trim().length === 0) throw new Error(`Encounter/visit row has empty required field: ${fieldName}`);
  return text;
}

function requiredNumber(value: unknown, fieldName: string): number {
  if (value === null || value === undefined) throw new Error(`Encounter/visit row is missing required field: ${fieldName}`);
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) throw new Error(`Encounter/visit row has invalid numeric field: ${fieldName}`);
  return numberValue;
}

function nullableNumber(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined) return null;
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) throw new Error(`Encounter/visit row has invalid numeric field: ${fieldName}`);
  return numberValue;
}

function requireTenantId(tenantId: string | null | undefined): string {
  if (!tenantId || tenantId.trim().length === 0) throw new Error(ACTIVE_CLINIC_REQUIRED_FOR_ENCOUNTER_VISIT_ERROR);
  return tenantId;
}

function requirePatientId(patientId: string | null | undefined): string {
  if (!patientId || patientId.trim().length === 0) throw new Error(PATIENT_REQUIRED_FOR_CLINICAL_WORKFLOW_ERROR);
  return patientId;
}

function requireRecordId(id: string | null | undefined): string {
  if (!id || id.trim().length === 0) throw new Error(RECORD_ID_REQUIRED_FOR_ENCOUNTER_VISIT_ERROR);
  return id;
}

export function normalizeEncounterVisitLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_ENCOUNTER_VISIT_LIMIT;
  return Math.max(1, Math.min(MAX_ENCOUNTER_VISIT_LIMIT, Math.floor(limit)));
}

export function normalizeEncounterVisitOffset(offset?: number): number {
  if (offset === undefined || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.floor(offset));
}

export function mapPatientVisitRow(row: PatientVisitRow | Record<string, unknown>): PatientVisit {
  return {
    id: requiredString(row.id, 'id'),
    tenantId: requiredString(row.tenant_id, 'tenant_id'),
    patientId: requiredString(row.patient_id, 'patient_id'),
    appointmentId: nullableString(row.appointment_id),
    status: requiredString(row.status, 'status') as PatientVisitStatus,
    visitType: requiredString(row.visit_type, 'visit_type') as PatientVisitType,
    arrivedAt: requiredString(row.arrived_at, 'arrived_at'),
    checkedInAt: nullableString(row.checked_in_at),
    startedAt: nullableString(row.started_at),
    completedAt: nullableString(row.completed_at),
    cancelledAt: nullableString(row.cancelled_at),
    archivedAt: nullableString(row.archived_at),
    createdBy: nullableString(row.created_by),
    updatedBy: nullableString(row.updated_by),
    archivedBy: nullableString(row.archived_by),
    notes: nullableString(row.notes),
    metadata: metadataObject(row.metadata),
    createdAt: requiredString(row.created_at, 'created_at'),
    updatedAt: requiredString(row.updated_at, 'updated_at'),
  };
}

export function mapClinicalEncounterRow(row: ClinicalEncounterRow | Record<string, unknown>): ClinicalEncounter {
  return {
    id: requiredString(row.id, 'id'),
    tenantId: requiredString(row.tenant_id, 'tenant_id'),
    patientId: requiredString(row.patient_id, 'patient_id'),
    visitId: nullableString(row.visit_id),
    appointmentId: nullableString(row.appointment_id),
    doctorUserId: nullableString(row.doctor_user_id),
    status: requiredString(row.status, 'status') as ClinicalEncounterStatus,
    encounterType: requiredString(row.encounter_type, 'encounter_type') as ClinicalEncounterType,
    startedAt: nullableString(row.started_at),
    completedAt: nullableString(row.completed_at),
    lockedAt: nullableString(row.locked_at),
    archivedAt: nullableString(row.archived_at),
    createdBy: nullableString(row.created_by),
    updatedBy: nullableString(row.updated_by),
    lockedBy: nullableString(row.locked_by),
    archivedBy: nullableString(row.archived_by),
    chiefComplaintSnapshot: nullableString(row.chief_complaint_snapshot),
    clinicalSummary: nullableString(row.clinical_summary),
    correctionReason: nullableString(row.correction_reason),
    metadata: metadataObject(row.metadata),
    createdAt: requiredString(row.created_at, 'created_at'),
    updatedAt: requiredString(row.updated_at, 'updated_at'),
  };
}

export function mapCompletedServiceRow(row: CompletedServiceRow | Record<string, unknown>): CompletedService {
  return {
    id: requiredString(row.id, 'id'),
    tenantId: requiredString(row.tenant_id, 'tenant_id'),
    patientId: requiredString(row.patient_id, 'patient_id'),
    visitId: nullableString(row.visit_id),
    encounterId: nullableString(row.encounter_id),
    appointmentId: nullableString(row.appointment_id),
    findingId: nullableString(row.finding_id),
    treatmentPlanId: nullableString(row.treatment_plan_id),
    treatmentStageId: nullableString(row.treatment_stage_id),
    clinicalDictionaryItemId: nullableString(row.clinical_dictionary_item_id),
    serviceCode: nullableString(row.service_code),
    serviceName: requiredString(row.service_name, 'service_name'),
    toothNumber: nullableString(row.tooth_number),
    toothSurface: nullableString(row.tooth_surface),
    quantity: requiredNumber(row.quantity, 'quantity'),
    unitPrice: nullableNumber(row.unit_price, 'unit_price'),
    totalAmount: nullableNumber(row.total_amount, 'total_amount'),
    currency: requiredString(row.currency, 'currency'),
    performedBy: nullableString(row.performed_by),
    performedAt: requiredString(row.performed_at, 'performed_at'),
    status: requiredString(row.status, 'status') as CompletedServiceStatus,
    correctionOfId: nullableString(row.correction_of_id),
    correctionReason: nullableString(row.correction_reason),
    voidedAt: nullableString(row.voided_at),
    voidedBy: nullableString(row.voided_by),
    archivedAt: nullableString(row.archived_at),
    archivedBy: nullableString(row.archived_by),
    createdBy: nullableString(row.created_by),
    updatedBy: nullableString(row.updated_by),
    metadata: metadataObject(row.metadata),
    createdAt: requiredString(row.created_at, 'created_at'),
    updatedAt: requiredString(row.updated_at, 'updated_at'),
  };
}

export class SupabaseEncounterVisitRepository implements EncounterVisitRepository {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async listPatientVisits(options: ListPatientVisitsOptions): Promise<PatientVisit[]> {
    const tenantId = requireTenantId(options.tenantId);
    const limit = normalizeEncounterVisitLimit(options.limit);
    const offset = normalizeEncounterVisitOffset(options.offset);

    let query = this.client
      .from('patient_visits')
      .select('*')
      .eq('tenant_id', tenantId);

    if (options.patientId) query = query.eq('patient_id', options.patientId);
    if (options.appointmentId) query = query.eq('appointment_id', options.appointmentId);
    if (options.statuses?.length) query = query.in('status', options.statuses);
    if (options.visitTypes?.length) query = query.in('visit_type', options.visitTypes);
    if (!options.includeArchived) query = query.neq('status', 'archived');
    if (options.arrivedFrom) query = query.gte('arrived_at', options.arrivedFrom);
    if (options.arrivedTo) query = query.lte('arrived_at', options.arrivedTo);

    const { data, error } = await query
      .order('arrived_at', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapPatientVisitRow);
  }

  async getPatientVisitById(options: GetByIdOptions): Promise<PatientVisit | null> {
    const tenantId = requireTenantId(options.tenantId);
    const id = requireRecordId(options.id);
    const { data, error } = await this.client
      .from('patient_visits')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapPatientVisitRow(data as Record<string, unknown>) : null;
  }

  async listClinicalEncounters(options: ListClinicalEncountersOptions): Promise<ClinicalEncounter[]> {
    const tenantId = requireTenantId(options.tenantId);
    const limit = normalizeEncounterVisitLimit(options.limit);
    const offset = normalizeEncounterVisitOffset(options.offset);

    let query = this.client
      .from('clinical_encounters')
      .select('*')
      .eq('tenant_id', tenantId);

    if (options.patientId) query = query.eq('patient_id', options.patientId);
    if (options.visitId) query = query.eq('visit_id', options.visitId);
    if (options.appointmentId) query = query.eq('appointment_id', options.appointmentId);
    if (options.doctorUserId) query = query.eq('doctor_user_id', options.doctorUserId);
    if (options.statuses?.length) query = query.in('status', options.statuses);
    if (options.encounterTypes?.length) query = query.in('encounter_type', options.encounterTypes);
    if (!options.includeArchived) query = query.neq('status', 'archived');
    if (options.createdFrom) query = query.gte('created_at', options.createdFrom);
    if (options.createdTo) query = query.lte('created_at', options.createdTo);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapClinicalEncounterRow);
  }

  async getClinicalEncounterById(options: GetByIdOptions): Promise<ClinicalEncounter | null> {
    const tenantId = requireTenantId(options.tenantId);
    const id = requireRecordId(options.id);
    const { data, error } = await this.client
      .from('clinical_encounters')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapClinicalEncounterRow(data as Record<string, unknown>) : null;
  }

  async listCompletedServices(options: ListCompletedServicesOptions): Promise<CompletedService[]> {
    const tenantId = requireTenantId(options.tenantId);
    const limit = normalizeEncounterVisitLimit(options.limit);
    const offset = normalizeEncounterVisitOffset(options.offset);

    let query = this.client
      .from('completed_services')
      .select('*')
      .eq('tenant_id', tenantId);

    if (options.patientId) query = query.eq('patient_id', options.patientId);
    if (options.visitId) query = query.eq('visit_id', options.visitId);
    if (options.encounterId) query = query.eq('encounter_id', options.encounterId);
    if (options.appointmentId) query = query.eq('appointment_id', options.appointmentId);
    if (options.findingId) query = query.eq('finding_id', options.findingId);
    if (options.treatmentPlanId) query = query.eq('treatment_plan_id', options.treatmentPlanId);
    if (options.treatmentStageId) query = query.eq('treatment_stage_id', options.treatmentStageId);
    if (options.clinicalDictionaryItemId) query = query.eq('clinical_dictionary_item_id', options.clinicalDictionaryItemId);
    if (options.performedBy) query = query.eq('performed_by', options.performedBy);
    if (options.statuses?.length) query = query.in('status', options.statuses);
    if (!options.includeArchived) query = query.neq('status', 'archived');
    if (!options.includeVoided) query = query.neq('status', 'voided');
    if (options.performedFrom) query = query.gte('performed_at', options.performedFrom);
    if (options.performedTo) query = query.lte('performed_at', options.performedTo);

    const { data, error } = await query
      .order('performed_at', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapCompletedServiceRow);
  }

  async getCompletedServiceById(options: GetByIdOptions): Promise<CompletedService | null> {
    const tenantId = requireTenantId(options.tenantId);
    const id = requireRecordId(options.id);
    const { data, error } = await this.client
      .from('completed_services')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapCompletedServiceRow(data as Record<string, unknown>) : null;
  }

  async listPatientClinicalWorkflow(options: ListPatientClinicalWorkflowOptions): Promise<PatientClinicalWorkflow> {
    const tenantId = requireTenantId(options.tenantId);
    const patientId = requirePatientId(options.patientId);
    const common = {
      tenantId,
      patientId,
      includeArchived: options.includeArchived,
      limit: options.limit,
      offset: options.offset,
    };

    const [visits, encounters, completedServices] = await Promise.all([
      this.listPatientVisits(common),
      this.listClinicalEncounters(common),
      this.listCompletedServices(common),
    ]);

    return { visits, encounters, completedServices };
  }
}

export function createEncounterVisitRepository(options: CreateEncounterVisitRepositoryOptions): EncounterVisitRepository {
  if (options.backend === 'local') {
    throw new Error('Encounter/visit repository requires Supabase backend.');
  }

  const client = options.client ?? defaultSupabase;
  if (!client) {
    throw new Error('Supabase client is not configured for encounter/visit access.');
  }

  return new SupabaseEncounterVisitRepository(client as SupabaseClient);
}
