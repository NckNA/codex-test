import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../../lib/supabaseClient';
import {
  mapPatientVisitRow,
  mapClinicalEncounterRow,
  mapCompletedServiceRow,
  type PatientVisit,
  type ClinicalEncounter,
  type CompletedService,
  type PatientVisitType,
  type ClinicalEncounterType,
} from './EncounterVisitRepository';

export interface CheckInPatientVisitInput {
  tenantId: string;
  patientId: string;
  appointmentId?: string | null;
  visitType?: PatientVisitType;
  arrivedAt?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface StartPatientVisitInput {
  tenantId: string;
  visitId: string;
  metadata?: Record<string, unknown>;
}

export interface CompletePatientVisitInput {
  tenantId: string;
  visitId: string;
  metadata?: Record<string, unknown>;
}

export interface CancelPatientVisitInput {
  tenantId: string;
  visitId: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface CreateClinicalEncounterInput {
  tenantId: string;
  patientId: string;
  visitId?: string | null;
  appointmentId?: string | null;
  doctorUserId?: string | null;
  encounterType?: ClinicalEncounterType;
  chiefComplaintSnapshot?: string | null;
  clinicalSummary?: string | null;
  metadata?: Record<string, unknown>;
}

export interface StartClinicalEncounterInput {
  tenantId: string;
  encounterId: string;
  metadata?: Record<string, unknown>;
}

export interface CompleteClinicalEncounterInput {
  tenantId: string;
  encounterId: string;
  clinicalSummary?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RecordCompletedServiceInput {
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
  quantity?: number;
  unitPrice?: number | null;
  totalAmount?: number | null;
  currency?: string;
  performedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface VoidCompletedServiceInput {
  tenantId: string;
  completedServiceId: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface EncounterVisitRpcClient {
  checkInPatientVisit(input: CheckInPatientVisitInput): Promise<PatientVisit>;
  startPatientVisit(input: StartPatientVisitInput): Promise<PatientVisit>;
  completePatientVisit(input: CompletePatientVisitInput): Promise<PatientVisit>;
  cancelPatientVisit(input: CancelPatientVisitInput): Promise<PatientVisit>;

  createClinicalEncounter(input: CreateClinicalEncounterInput): Promise<ClinicalEncounter>;
  startClinicalEncounter(input: StartClinicalEncounterInput): Promise<ClinicalEncounter>;
  completeClinicalEncounter(input: CompleteClinicalEncounterInput): Promise<ClinicalEncounter>;

  recordCompletedService(input: RecordCompletedServiceInput): Promise<CompletedService>;
  voidCompletedService(input: VoidCompletedServiceInput): Promise<CompletedService>;
}

export type EncounterVisitRpcClientBackend = 'supabase' | 'local';

export interface CreateEncounterVisitRpcClientOptions {
  backend: EncounterVisitRpcClientBackend;
  client?: SupabaseClient;
}

function requireTenantId(tenantId: string | null | undefined): string {
  if (!tenantId || tenantId.trim().length === 0) {
    throw new Error('Active clinic is required for encounter/visit writes.');
  }
  return tenantId;
}

function requireNonEmptyString(value: string | null | undefined, errorMessage: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(errorMessage);
  }
  return value;
}

function validateMetadata(metadata?: Record<string, unknown> | null) {
  if (metadata !== undefined) {
    if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new Error('RPC metadata must be a JSON object.');
    }
  }
}

function extractSingleRow(data: unknown): Record<string, unknown> {
  if (!data) {
    throw new Error('Received empty or null response from database RPC.');
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error('Received empty or null response from database RPC.');
  }
  return row as Record<string, unknown>;
}

export class SupabaseEncounterVisitRpcClient implements EncounterVisitRpcClient {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async checkInPatientVisit(input: CheckInPatientVisitInput): Promise<PatientVisit> {
    const tenantId = requireTenantId(input.tenantId);
    const patientId = requireNonEmptyString(input.patientId, 'Patient is required to check in a visit.');
    validateMetadata(input.metadata);

    const { data, error } = await this.client.rpc('check_in_patient_visit', {
      p_tenant_id: tenantId,
      p_patient_id: patientId,
      p_appointment_id: input.appointmentId || null,
      p_visit_type: input.visitType || 'regular',
      p_arrived_at: input.arrivedAt || null,
      p_notes: input.notes || null,
      p_metadata: input.metadata || {},
    });

    if (error) throw error;
    return mapPatientVisitRow(extractSingleRow(data));
  }

  async startPatientVisit(input: StartPatientVisitInput): Promise<PatientVisit> {
    const tenantId = requireTenantId(input.tenantId);
    const visitId = requireNonEmptyString(input.visitId, 'Visit id is required.');
    validateMetadata(input.metadata);

    const { data, error } = await this.client.rpc('start_patient_visit', {
      p_tenant_id: tenantId,
      p_visit_id: visitId,
      p_metadata: input.metadata || {},
    });

    if (error) throw error;
    return mapPatientVisitRow(extractSingleRow(data));
  }

  async completePatientVisit(input: CompletePatientVisitInput): Promise<PatientVisit> {
    const tenantId = requireTenantId(input.tenantId);
    const visitId = requireNonEmptyString(input.visitId, 'Visit id is required.');
    validateMetadata(input.metadata);

    const { data, error } = await this.client.rpc('complete_patient_visit', {
      p_tenant_id: tenantId,
      p_visit_id: visitId,
      p_metadata: input.metadata || {},
    });

    if (error) throw error;
    return mapPatientVisitRow(extractSingleRow(data));
  }

  async cancelPatientVisit(input: CancelPatientVisitInput): Promise<PatientVisit> {
    const tenantId = requireTenantId(input.tenantId);
    const visitId = requireNonEmptyString(input.visitId, 'Visit id is required.');
    const reason = requireNonEmptyString(input.reason, 'Cancellation reason is required.');
    validateMetadata(input.metadata);

    const { data, error } = await this.client.rpc('cancel_patient_visit', {
      p_tenant_id: tenantId,
      p_visit_id: visitId,
      p_reason: reason,
      p_metadata: input.metadata || {},
    });

    if (error) throw error;
    return mapPatientVisitRow(extractSingleRow(data));
  }

  async createClinicalEncounter(input: CreateClinicalEncounterInput): Promise<ClinicalEncounter> {
    const tenantId = requireTenantId(input.tenantId);
    const patientId = requireNonEmptyString(input.patientId, 'Patient is required to create a clinical encounter.');
    validateMetadata(input.metadata);

    const { data, error } = await this.client.rpc('create_clinical_encounter', {
      p_tenant_id: tenantId,
      p_patient_id: patientId,
      p_visit_id: input.visitId || null,
      p_appointment_id: input.appointmentId || null,
      p_doctor_user_id: input.doctorUserId || null,
      p_encounter_type: input.encounterType || 'consultation',
      p_chief_complaint_snapshot: input.chiefComplaintSnapshot || null,
      p_clinical_summary: input.clinicalSummary || null,
      p_metadata: input.metadata || {},
    });

    if (error) throw error;
    return mapClinicalEncounterRow(extractSingleRow(data));
  }

  async startClinicalEncounter(input: StartClinicalEncounterInput): Promise<ClinicalEncounter> {
    const tenantId = requireTenantId(input.tenantId);
    const encounterId = requireNonEmptyString(input.encounterId, 'Encounter id is required.');
    validateMetadata(input.metadata);

    const { data, error } = await this.client.rpc('start_clinical_encounter', {
      p_tenant_id: tenantId,
      p_encounter_id: encounterId,
      p_metadata: input.metadata || {},
    });

    if (error) throw error;
    return mapClinicalEncounterRow(extractSingleRow(data));
  }

  async completeClinicalEncounter(input: CompleteClinicalEncounterInput): Promise<ClinicalEncounter> {
    const tenantId = requireTenantId(input.tenantId);
    const encounterId = requireNonEmptyString(input.encounterId, 'Encounter id is required.');
    validateMetadata(input.metadata);

    const { data, error } = await this.client.rpc('complete_clinical_encounter', {
      p_tenant_id: tenantId,
      p_encounter_id: encounterId,
      p_clinical_summary: input.clinicalSummary || null,
      p_metadata: input.metadata || {},
    });

    if (error) throw error;
    return mapClinicalEncounterRow(extractSingleRow(data));
  }

  async recordCompletedService(input: RecordCompletedServiceInput): Promise<CompletedService> {
    const tenantId = requireTenantId(input.tenantId);
    const patientId = requireNonEmptyString(input.patientId, 'Patient is required to record a completed service.');
    const serviceName = requireNonEmptyString(input.serviceName, 'Service name is required.');
    
    if (input.quantity !== undefined && input.quantity !== null && input.quantity <= 0) {
      throw new Error('Service quantity must be greater than 0.');
    }
    if (input.unitPrice !== undefined && input.unitPrice !== null && input.unitPrice < 0) {
      throw new Error('Service amount cannot be negative.');
    }
    if (input.totalAmount !== undefined && input.totalAmount !== null && input.totalAmount < 0) {
      throw new Error('Service amount cannot be negative.');
    }
    validateMetadata(input.metadata);

    const { data, error } = await this.client.rpc('record_completed_service', {
      p_tenant_id: tenantId,
      p_patient_id: patientId,
      p_visit_id: input.visitId || null,
      p_encounter_id: input.encounterId || null,
      p_appointment_id: input.appointmentId || null,
      p_finding_id: input.findingId || null,
      p_treatment_plan_id: input.treatmentPlanId || null,
      p_treatment_stage_id: input.treatmentStageId || null,
      p_clinical_dictionary_item_id: input.clinicalDictionaryItemId || null,
      p_service_code: input.serviceCode || null,
      p_service_name: serviceName,
      p_tooth_number: input.toothNumber || null,
      p_tooth_surface: input.toothSurface || null,
      p_quantity: input.quantity !== undefined && input.quantity !== null ? input.quantity : 1,
      p_unit_price: input.unitPrice !== undefined ? input.unitPrice : null,
      p_total_amount: input.totalAmount !== undefined ? input.totalAmount : null,
      p_currency: input.currency || 'KZT',
      p_performed_at: input.performedAt || null,
      p_metadata: input.metadata || {},
    });

    if (error) throw error;
    return mapCompletedServiceRow(extractSingleRow(data));
  }

  async voidCompletedService(input: VoidCompletedServiceInput): Promise<CompletedService> {
    const tenantId = requireTenantId(input.tenantId);
    const completedServiceId = requireNonEmptyString(input.completedServiceId, 'Completed service id is required.');
    const reason = requireNonEmptyString(input.reason, 'Void reason is required.');
    validateMetadata(input.metadata);

    const { data, error } = await this.client.rpc('void_completed_service', {
      p_tenant_id: tenantId,
      p_completed_service_id: completedServiceId,
      p_reason: reason,
      p_metadata: input.metadata || {},
    });

    if (error) throw error;
    return mapCompletedServiceRow(extractSingleRow(data));
  }
}

export function createEncounterVisitRpcClient(options: CreateEncounterVisitRpcClientOptions): EncounterVisitRpcClient {
  if (options.backend === 'local') {
    throw new Error('Encounter/visit RPC client requires Supabase backend.');
  }

  const client = options.client !== undefined ? options.client : defaultSupabase;
  if (!client) {
    throw new Error('Supabase client is not configured for encounter/visit RPC access.');
  }

  return new SupabaseEncounterVisitRpcClient(client as SupabaseClient);
}
