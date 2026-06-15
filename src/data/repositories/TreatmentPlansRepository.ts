import { storage } from '../../utils/storage';
import type { TreatmentPlan, TreatmentStage } from '../../types';
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
  private readonly tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private validateUuid(id: string): string | null {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id) ? id : null;
  }

  async listTreatmentPlansByPatient(patientId: string): Promise<TreatmentPlan[]> {
    if (!this.validateUuid(patientId)) {
      throw new Error(`Invalid patient UUID: ${patientId}`);
    }

    const { data, error } = await supabase!
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

  private async savePlanWithStages(patientId: string, plan: TreatmentPlan, isUpdate: boolean): Promise<void> {
    if (!this.validateUuid(patientId)) throw new Error(`Invalid patient UUID: ${patientId}`);
    
    const planId = plan.id;
    if (isUpdate && !this.validateUuid(planId)) throw new Error(`Invalid plan UUID: ${planId}`);
    const finalPlanId = this.validateUuid(planId) ? planId : crypto.randomUUID();

    const mappedStages = (plan.stages || []).map((stage) => {
      const safeFindingIds = (stage.findingIds || []).filter(id => this.validateUuid(id));
      return {
        id: this.validateUuid(stage.id) ? stage.id : crypto.randomUUID(),
        title: stage.title,
        description: stage.description || null,
        price: typeof stage.price === 'number' ? stage.price : 0,
        status: stage.status || 'planned',
        teeth: stage.teeth || [],
        findingIds: safeFindingIds,
        source: stage.source || null,
      };
    });

    const { error } = await supabase!.rpc('save_treatment_plan_with_stages', {
      p_tenant_id: this.tenantId,
      p_patient_id: patientId,
      p_plan_id: finalPlanId,
      p_title: plan.title,
      p_status: plan.status,
      p_total_price: plan.totalPrice,
      p_stages: mappedStages,
    });

    if (error) {
      const operationName = isUpdate ? 'update' : 'create';
      throw new Error(`Failed to ${operationName} treatment plan in Supabase: ${error.message}`);
    }
  }

  async createTreatmentPlan(patientId: string, plan: TreatmentPlan): Promise<void> {
    await this.savePlanWithStages(patientId, plan, false);
  }

  async updateTreatmentPlan(patientId: string, plan: TreatmentPlan): Promise<void> {
    await this.savePlanWithStages(patientId, plan, true);
  }

  async deleteTreatmentPlan(patientId: string, planId: string): Promise<void> {
    if (!this.validateUuid(patientId)) throw new Error(`Invalid patient UUID: ${patientId}`);
    if (!this.validateUuid(planId)) throw new Error(`Invalid plan UUID: ${planId}`);

    const { error } = await supabase!
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
