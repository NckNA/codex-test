import { storage } from '../../utils/storage';
import type { DentalFinding } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FindingCategory, FindingSeverity, FindingStatus } from '../../types';

export type CreateFindingInput = Omit<DentalFinding, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>;

export interface FindingsRepository {
  listFindingsByPatient(patientId: string): Promise<DentalFinding[]>;
  createFinding(patientId: string, finding: CreateFindingInput): Promise<void>;
  updateFinding(patientId: string, finding: DentalFinding): Promise<void>;
  deleteFinding(patientId: string, findingId: string): Promise<void>;
}

export const LocalStorageFindingsRepository: FindingsRepository = {
  async listFindingsByPatient(patientId: string): Promise<DentalFinding[]> {
    return storage.getFindings(patientId);
  },

  async createFinding(patientId: string, finding: CreateFindingInput): Promise<void> {
    storage.addFinding(patientId, finding);
  },

  async updateFinding(patientId: string, finding: DentalFinding): Promise<void> {
    storage.updateFinding(patientId, finding);
  },

  async deleteFinding(patientId: string, findingId: string): Promise<void> {
    storage.deleteFinding(patientId, findingId);
  },
};

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

    return (data || []).map(row => ({
      id: row.id,
      patientId: row.patient_id,
      toothNumber: row.tooth_number === null ? undefined : row.tooth_number,
      title: row.title,
      category: row.category as FindingCategory,
      severity: row.severity as FindingSeverity,
      description: row.description,
      riskDescription: row.risk_description || undefined,
      recommendation: row.recommendation || undefined,
      isChiefComplaintRelated: row.is_chief_complaint_related,
      includeInTreatmentPlan: row.include_in_treatment_plan,
      status: row.status as FindingStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createFinding(patientId: string, finding: CreateFindingInput): Promise<void> {
    const id = crypto.randomUUID();
    const { error } = await this.client
      .from('findings')
      .insert({
        id,
        tenant_id: this.tenantId,
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
        status: finding.status,
      });

    if (error) {
      throw error;
    }
  }

  async updateFinding(patientId: string, finding: DentalFinding): Promise<void> {
    const { error } = await this.client
      .from('findings')
      .update({
        tooth_number: finding.toothNumber ?? null,
        title: finding.title,
        category: finding.category,
        severity: finding.severity,
        description: finding.description,
        risk_description: finding.riskDescription ?? null,
        recommendation: finding.recommendation ?? null,
        is_chief_complaint_related: finding.isChiefComplaintRelated ?? false,
        include_in_treatment_plan: finding.includeInTreatmentPlan ?? false,
        status: finding.status,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', this.tenantId)
      .eq('patient_id', patientId)
      .eq('id', finding.id);

    if (error) {
      throw error;
    }
  }

  async deleteFinding(patientId: string, findingId: string): Promise<void> {
    const { error } = await this.client
      .from('findings')
      .delete()
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
