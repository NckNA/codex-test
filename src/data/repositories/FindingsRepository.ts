import { storage } from '../../utils/storage';
import type { ClinicalZone, DentalFinding } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FindingCategory, FindingSeverity } from '../../types';
import { normalizeFindingStatus } from '../../domain/findingStatus';

export type CreateFindingInput = Omit<DentalFinding, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>;

export interface FindingsRepository {
  listFindingsByPatient(patientId: string): Promise<DentalFinding[]>;
  createFinding(patientId: string, finding: CreateFindingInput): Promise<void>;
  updateFinding(patientId: string, finding: DentalFinding): Promise<void>;
  deleteFinding(patientId: string, findingId: string): Promise<void>;
}

export const LocalStorageFindingsRepository: FindingsRepository = {
  async listFindingsByPatient(patientId: string): Promise<DentalFinding[]> {
    const findings = storage.getFindings(patientId);
    return findings.map(f => ({
      ...f,
      status: normalizeFindingStatus(f.status)
    }));
  },

  async createFinding(patientId: string, finding: CreateFindingInput): Promise<void> {
    storage.addFinding(patientId, finding);
  },

  async updateFinding(patientId: string, finding: DentalFinding): Promise<void> {
    storage.updateFinding(patientId, finding);
  },

  async deleteFinding(patientId: string, findingId: string): Promise<void> {
    const findings = storage.getFindings(patientId);
    const finding = findings.find(f => f.id === findingId);
    if (finding) {
      storage.updateFinding(patientId, { ...finding, status: 'archived', updatedAt: new Date().toISOString() });
    }
  },
};

function getErrorMessage(error: unknown): string {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : String(message || '');
  }
  return String(error);
}

function isMissingFindingLinkColumnError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('clinical_zone') ||
    message.includes('diagnosis_ids') ||
    message.includes('planned_work_ids') ||
    message.includes('planned_work_record_ids') ||
    message.includes('schema cache')
  ) && (
    message.includes('column') ||
    message.includes('schema cache')
  );
}

function mapFindingRow(row: Record<string, unknown>): DentalFinding {
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    toothNumber: row.tooth_number === null || row.tooth_number === undefined ? undefined : Number(row.tooth_number),
    title: String(row.title),
    category: row.category as FindingCategory,
    severity: row.severity as FindingSeverity,
    description: String(row.description || ''),
    riskDescription: row.risk_description ? String(row.risk_description) : undefined,
    recommendation: row.recommendation ? String(row.recommendation) : undefined,
    isChiefComplaintRelated: Boolean(row.is_chief_complaint_related),
    includeInTreatmentPlan: Boolean(row.include_in_treatment_plan),
    status: normalizeFindingStatus(row.status as string),
    clinicalZone: row.clinical_zone ? row.clinical_zone as ClinicalZone : undefined,
    diagnosisIds: Array.isArray(row.diagnosis_ids) ? row.diagnosis_ids.map(String) : [],
    plannedWorkIds: Array.isArray(row.planned_work_ids) ? row.planned_work_ids.map(String) : [],
    plannedWorkRecordIds: Array.isArray(row.planned_work_record_ids) ? row.planned_work_record_ids.map(String) : [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function buildFindingPayload(
  tenantId: string,
  patientId: string,
  finding: CreateFindingInput | DentalFinding,
  includeLinkFields: boolean,
  id?: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    patient_id: patientId,
    tooth_number: finding.toothNumber ?? null,
    title: finding.title,
    category: finding.category,
    severity: finding.severity,
    description: finding.description,
    risk_description: finding.riskDescription ?? null,
    recommendation: finding.recommendation ?? null,
    is_chief_complaint_related: finding.isChiefComplaintRelated ?? false,
    include_in_treatment_plan: finding.includeInTreatmentPlan ?? false,
    status: normalizeFindingStatus(finding.status),
  };

  if (id) payload.id = id;

  if (includeLinkFields) {
    payload.clinical_zone = finding.clinicalZone ?? null;
    payload.diagnosis_ids = finding.diagnosisIds ?? [];
    payload.planned_work_ids = finding.plannedWorkIds ?? [];
    payload.planned_work_record_ids = finding.plannedWorkRecordIds ?? [];
  }

  return payload;
}

export class SupabaseFindingsRepository implements FindingsRepository {
  private readonly tenantId: string;
  private readonly client: SupabaseClient;

  constructor(tenantId: string, client: SupabaseClient) {
    this.tenantId = tenantId;
    this.client = client;
  }

  async listFindingsByPatient(patientId: string): Promise<DentalFinding[]> {
    const { data, error } = await this.client
      .from('findings')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map((row) => mapFindingRow(row as Record<string, unknown>));
  }

  async createFinding(patientId: string, finding: CreateFindingInput): Promise<void> {
    const id = crypto.randomUUID();
    const insertFinding = async (includeLinkFields: boolean) => this.client
      .from('findings')
      .insert(buildFindingPayload(this.tenantId, patientId, finding, includeLinkFields, id));

    let { error } = await insertFinding(true);

    if (error && isMissingFindingLinkColumnError(error)) {
      ({ error } = await insertFinding(false));
    }

    if (error) {
      throw error;
    }
  }

  async updateFinding(patientId: string, finding: DentalFinding): Promise<void> {
    const updateFinding = async (includeLinkFields: boolean) => this.client
      .from('findings')
      .update({
        ...buildFindingPayload(this.tenantId, patientId, finding, includeLinkFields),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', this.tenantId)
      .eq('patient_id', patientId)
      .eq('id', finding.id);

    let { error } = await updateFinding(true);

    if (error && isMissingFindingLinkColumnError(error)) {
      ({ error } = await updateFinding(false));
    }

    if (error) {
      throw error;
    }
  }

  async deleteFinding(patientId: string, findingId: string): Promise<void> {
    const { error } = await this.client
      .from('findings')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('tenant_id', this.tenantId)
      .eq('patient_id', patientId)
      .eq('id', findingId);

    if (error) {
      throw error;
    }
  }
}

export type FindingsRepositoryBackend = 'local' | 'supabase';

export interface CreateFindingsRepositoryOptions {
  tenantId?: string | null;
  backend: FindingsRepositoryBackend;
}

export function createFindingsRepository(options: CreateFindingsRepositoryOptions): FindingsRepository {
  if (options.backend === 'supabase' && options.tenantId && supabase) {
    return new SupabaseFindingsRepository(options.tenantId, supabase);
  }

  return LocalStorageFindingsRepository;
}