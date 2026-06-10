import { storage } from '../../utils/storage';
import type { TreatmentPlan } from '../../types';
import { supabase } from '../../lib/supabaseClient';

export interface TreatmentPlansRepository {
  listTreatmentPlansByPatient(patientId: string): Promise<TreatmentPlan[]>;
  createTreatmentPlan(patientId: string, plan: TreatmentPlan): Promise<void>;
  updateTreatmentPlan(patientId: string, plan: TreatmentPlan): Promise<void>;
  deleteTreatmentPlan(patientId: string, planId: string): Promise<void>;
}

export const LocalStorageTreatmentPlansRepository: TreatmentPlansRepository = {
  async listTreatmentPlansByPatient(patientId: string): Promise<TreatmentPlan[]> {
    return storage.getTreatmentPlans(patientId);
  },

  async createTreatmentPlan(patientId: string, plan: TreatmentPlan): Promise<void> {
    storage.addTreatmentPlan(patientId, plan);
  },

  async updateTreatmentPlan(patientId: string, plan: TreatmentPlan): Promise<void> {
    storage.updateTreatmentPlan(patientId, plan);
  },

  async deleteTreatmentPlan(patientId: string, planId: string): Promise<void> {
    storage.deleteTreatmentPlan(patientId, planId);
  },
};

export class SupabaseTreatmentPlansRepository implements TreatmentPlansRepository {
  constructor(private tenantId: string) {}

  private validateUuid(id: string): string | null {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id) ? id : null;
  }

  async listTreatmentPlansByPatient(patientId: string): Promise<TreatmentPlan[]> {
    if (!this.validateUuid(patientId)) {
      throw new Error(`Invalid patient UUID: ${patientId}`);
    }

    const { data, error } = await supabase
      .from('treatment_plans')
      .select('*, treatment_stages(*)')
      .eq('tenant_id', this.tenantId)
      .eq('patient_id', patientId);

    if (error) {
      throw new Error(`Failed to fetch treatment plans from Supabase: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      patientId: row.patient_id as string,
      title: row.title as string,
      status: row.status as TreatmentPlan['status'],
      totalPrice: row.total_price as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      stages: ((row.treatment_stages as Record<string, unknown>[]) || []).sort((a, b) => (a.order_index as number) - (b.order_index as number)).map((stageRow) => ({
        id: stageRow.id as string,
        title: stageRow.title as string,
        teeth: stageRow.teeth as number[] || [],
        description: stageRow.description as string || '',
        price: stageRow.price as number,
        status: stageRow.status as TreatmentStage['status'],
        findingIds: stageRow.finding_ids as string[] || [],
        source: stageRow.source as TreatmentStage['source'] || undefined,
      })),
    }));
  }

  async createTreatmentPlan(patientId: string, plan: TreatmentPlan): Promise<void> {
    if (!this.validateUuid(patientId)) throw new Error(`Invalid patient UUID: ${patientId}`);
    
    // We must generate safe UUIDs for Supabase if the frontend generated local string IDs
    const planId = this.validateUuid(plan.id) ? plan.id : crypto.randomUUID();

    const planRow = {
      id: planId,
      tenant_id: this.tenantId,
      patient_id: patientId,
      title: plan.title,
      status: plan.status,
      total_price: plan.totalPrice,
      created_at: plan.createdAt || new Date().toISOString(),
      updated_at: plan.updatedAt || new Date().toISOString(),
    };

    const { error: planError } = await supabase
      .from('treatment_plans')
      .insert(planRow);

    if (planError) {
      throw new Error(`Failed to create treatment plan in Supabase: ${planError.message}`);
    }

    if (plan.stages.length > 0) {
      const stageRows = plan.stages.map((stage, index) => {
        const safeFindingIds = (stage.findingIds || []).filter(id => this.validateUuid(id));
        return {
          id: this.validateUuid(stage.id) ? stage.id : crypto.randomUUID(),
          tenant_id: this.tenantId,
          treatment_plan_id: planId,
          title: stage.title,
          teeth: stage.teeth,
          description: stage.description || null,
          price: stage.price,
          status: stage.status,
          finding_ids: safeFindingIds.length > 0 ? safeFindingIds : null,
          source: stage.source || null,
          order_index: index,
        };
      });

      const { error: stagesError } = await supabase
        .from('treatment_stages')
        .insert(stageRows);

      if (stagesError) {
        throw new Error(`Failed to create treatment stages in Supabase: ${stagesError.message}`);
      }
    }
  }

  async updateTreatmentPlan(patientId: string, plan: TreatmentPlan): Promise<void> {
    if (!this.validateUuid(patientId)) throw new Error(`Invalid patient UUID: ${patientId}`);
    const planId = plan.id;
    if (!this.validateUuid(planId)) throw new Error(`Invalid plan UUID: ${planId}`);

    const planRow = {
      title: plan.title,
      status: plan.status,
      total_price: plan.totalPrice,
      updated_at: new Date().toISOString(),
    };

    const { error: planError } = await supabase
      .from('treatment_plans')
      .update(planRow)
      .eq('tenant_id', this.tenantId)
      .eq('patient_id', patientId)
      .eq('id', planId);

    if (planError) {
      throw new Error(`Failed to update treatment plan in Supabase: ${planError.message}`);
    }

    // Replace stages using delete + insert
    // Note: Due to lack of transactional support in simple REST, there's a partial save risk here.
    const { error: deleteStagesError } = await supabase
      .from('treatment_stages')
      .delete()
      .eq('tenant_id', this.tenantId)
      .eq('treatment_plan_id', planId);

    if (deleteStagesError) {
      throw new Error(`Failed to clear existing treatment stages in Supabase: ${deleteStagesError.message}`);
    }

    if (plan.stages.length > 0) {
      const stageRows = plan.stages.map((stage, index) => {
        const safeFindingIds = (stage.findingIds || []).filter(id => this.validateUuid(id));
        return {
          id: this.validateUuid(stage.id) ? stage.id : crypto.randomUUID(),
          tenant_id: this.tenantId,
          treatment_plan_id: planId,
          title: stage.title,
          teeth: stage.teeth,
          description: stage.description || null,
          price: stage.price,
          status: stage.status,
          finding_ids: safeFindingIds.length > 0 ? safeFindingIds : null,
          source: stage.source || null,
          order_index: index,
        };
      });

      const { error: insertStagesError } = await supabase
        .from('treatment_stages')
        .insert(stageRows);

      if (insertStagesError) {
        throw new Error(`Failed to insert updated treatment stages in Supabase: ${insertStagesError.message}`);
      }
    }
  }

  async deleteTreatmentPlan(patientId: string, planId: string): Promise<void> {
    if (!this.validateUuid(patientId)) throw new Error(`Invalid patient UUID: ${patientId}`);
    if (!this.validateUuid(planId)) throw new Error(`Invalid plan UUID: ${planId}`);

    const { error } = await supabase
      .from('treatment_plans')
      .delete()
      .eq('tenant_id', this.tenantId)
      .eq('patient_id', patientId)
      .eq('id', planId);

    if (error) {
      throw new Error(`Failed to delete treatment plan in Supabase: ${error.message}`);
    }
  }
}

export type BackendType = 'local' | 'supabase';

export interface TreatmentPlansRepositoryConfig {
  backend: BackendType;
  tenantId?: string;
}

export function createTreatmentPlansRepository(config: TreatmentPlansRepositoryConfig): TreatmentPlansRepository {
  if (config.backend === 'supabase') {
    if (!config.tenantId) {
      throw new Error('tenantId is required for SupabaseTreatmentPlansRepository');
    }
    return new SupabaseTreatmentPlansRepository(config.tenantId);
  }
  return LocalStorageTreatmentPlansRepository;
}
