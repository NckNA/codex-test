import type { DentalChart, DentalFinding, ToothRecord, TreatmentPlan, TreatmentStage } from '../../types';
import type { DentalChartRepository } from '../repositories/DentalChartRepository';
import type { FindingsRepository, CreateFindingInput } from '../repositories/FindingsRepository';
import type { TreatmentPlansRepository } from '../repositories/TreatmentPlansRepository';
import { LocalStorageDentalChartRepository } from '../repositories/DentalChartRepository';
import { LocalStorageFindingsRepository } from '../repositories/FindingsRepository';
import { LocalStorageTreatmentPlansRepository } from '../repositories/TreatmentPlansRepository';

export type ToothStatusFindingInput =
  Pick<DentalFinding, 'title' | 'category' | 'severity'> &
  Partial<Pick<
    DentalFinding,
    | 'description'
    | 'riskDescription'
    | 'recommendation'
    | 'isChiefComplaintRelated'
    | 'includeInTreatmentPlan'
    | 'status'
  >>;

export interface ApplyToothStatusChangeInput {
  patientId: string;
  chart: DentalChart;
  updatedTooth: ToothRecord;
  findingPayload: ToothStatusFindingInput | null;
}

export interface CreateTreatmentPlanFromFindingsInput {
  patientId: string;
  selectedFindings: DentalFinding[];
  now?: Date;
}

export interface DeleteTreatmentPlanWithCleanupInput {
  patientId: string;
  plan: TreatmentPlan;
}

export interface ClinicalWorkflowOrchestrator {
  applyToothStatusChange(input: ApplyToothStatusChangeInput): Promise<DentalChart>;
  createTreatmentPlanFromFindings(input: CreateTreatmentPlanFromFindingsInput): Promise<TreatmentPlan | null>;
  deleteTreatmentPlanWithCleanup(input: DeleteTreatmentPlanWithCleanupInput): Promise<void>;
}

export interface ClinicalWorkflowOrchestratorDependencies {
  dentalChartRepository: DentalChartRepository;
  findingsRepository: FindingsRepository;
  treatmentPlansRepository: TreatmentPlansRepository;
  backend?: 'local' | 'supabase';
}


function buildStageDescription(finding: DentalFinding): string {
  return [
    finding.description,
    finding.recommendation ? `Рекомендация: ${finding.recommendation}` : '',
  ].filter(Boolean).join('\n\n');
}

export function createClinicalWorkflowOrchestrator(
  dependencies: ClinicalWorkflowOrchestratorDependencies
): ClinicalWorkflowOrchestrator {
  const { dentalChartRepository, findingsRepository, treatmentPlansRepository, backend = 'local' } = dependencies;

  const validateUuid = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  return {
    async applyToothStatusChange(input: ApplyToothStatusChangeInput): Promise<DentalChart> {
      const { patientId, chart, updatedTooth, findingPayload } = input;
      const now = new Date().toISOString();

      const updatedChart: DentalChart = {
        ...chart,
        teeth: chart.teeth.map(t => t.toothNumber === updatedTooth.toothNumber ? updatedTooth : t),
        updatedAt: now,
      };

      await dentalChartRepository.saveDentalChart(patientId, updatedChart);

      if (!findingPayload || !findingPayload.title || !findingPayload.category || !findingPayload.severity) {
        return updatedChart;
      }

      const findings = await findingsRepository.listFindingsByPatient(patientId);
      const activeStatuses = ['discovered', 'recommended', 'included_in_plan', 'observing'];
      
      const existingActiveFinding = findings.find(f => 
        f.toothNumber === updatedTooth.toothNumber &&
        f.category === findingPayload.category &&
        activeStatuses.includes(f.status)
      );

      if (existingActiveFinding) {
        await findingsRepository.updateFinding(patientId, {
          ...existingActiveFinding,
          title: findingPayload.title,
          category: findingPayload.category,
          severity: findingPayload.severity,
          description: findingPayload.description || '',
          riskDescription: findingPayload.riskDescription || '',
          recommendation: findingPayload.recommendation || '',
          isChiefComplaintRelated: findingPayload.isChiefComplaintRelated || false,
          includeInTreatmentPlan: findingPayload.includeInTreatmentPlan || false,
          status: findingPayload.status || existingActiveFinding.status,
        });
      } else {
        const createFindingInput: CreateFindingInput = {
          toothNumber: updatedTooth.toothNumber,
          title: findingPayload.title,
          category: findingPayload.category,
          severity: findingPayload.severity,
          description: findingPayload.description || '',
          riskDescription: findingPayload.riskDescription || '',
          recommendation: findingPayload.recommendation || '',
          isChiefComplaintRelated: findingPayload.isChiefComplaintRelated || false,
          includeInTreatmentPlan: findingPayload.includeInTreatmentPlan || false,
          status: findingPayload.status || 'discovered',
        };
        await findingsRepository.createFinding(patientId, createFindingInput);
      }

      return updatedChart;
    },

    async createTreatmentPlanFromFindings(input: CreateTreatmentPlanFromFindingsInput): Promise<TreatmentPlan | null> {
      const { patientId, selectedFindings } = input;
      
      if (selectedFindings.length === 0) {
        return null;
      }

      if (backend === 'supabase') {
        if (!validateUuid(patientId)) {
          throw new Error('Invalid patient UUID for Supabase generation');
        }
        for (const finding of selectedFindings) {
          if (!validateUuid(finding.id)) {
            throw new Error(`Invalid finding UUID for Supabase generation: ${finding.id}`);
          }
          if (!finding.patientId || !validateUuid(finding.patientId) || finding.patientId !== patientId) {
            throw new Error(`Selected finding does not belong to patient: ${finding.id}`);
          }
        }
      }

      const date = input.now ?? new Date();
      const nowIso = date.toISOString();
      const planTimestamp = date.getTime();

      const planId = backend === 'supabase' ? crypto.randomUUID() : `plan_${planTimestamp}`;

      const stages = selectedFindings.map((finding, index): TreatmentStage => ({
        id: backend === 'supabase' ? crypto.randomUUID() : `stage_${planTimestamp}_${index}_${finding.id}`,
        title: finding.title,
        teeth: finding.toothNumber ? [finding.toothNumber] : [],
        description: buildStageDescription(finding),
        price: 0,
        status: 'planned',
        findingIds: [finding.id],
        source: 'from_finding',
      }));

      const plan: TreatmentPlan = {
        id: planId,
        patientId,
        title: `План лечения от ${date.toLocaleDateString('ru-RU')}`,
        status: 'draft',
        stages,
        totalPrice: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // 1. Save the plan first. If this fails, we do NOT touch findings.
      await treatmentPlansRepository.createTreatmentPlan(patientId, plan);

      // 2. Only after successful plan save, update finding statuses.
      for (const finding of selectedFindings) {
        try {
          await findingsRepository.updateFinding(patientId, {
            ...finding,
            status: 'included_in_plan',
            includeInTreatmentPlan: true,
            updatedAt: nowIso,
          });
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          throw new Error(`Plan saved, but failed to update finding ${finding.id} status: ${errMsg}`, { cause: e });
        }
      }

      return plan;
    },

    async deleteTreatmentPlanWithCleanup(input: DeleteTreatmentPlanWithCleanupInput): Promise<void> {
      const { patientId, plan } = input;

      if (!plan.patientId) {
        throw new Error('Treatment plan is missing patientId');
      }

      if (backend === 'supabase') {
        if (!validateUuid(patientId)) {
          throw new Error('Invalid patient UUID for Supabase deletion');
        }
        if (!validateUuid(plan.patientId)) {
          throw new Error('Invalid plan patient UUID for Supabase deletion');
        }
        if (!validateUuid(plan.id)) {
          throw new Error(`Invalid plan UUID for Supabase deletion: ${plan.id}`);
        }
      }

      if (plan.patientId !== patientId) {
        throw new Error(`Treatment plan patient mismatch: expected ${patientId}, got ${plan.patientId}`);
      }

      // 1. Collect and deduplicate finding IDs from all stages
      const findingIdsSet = new Set<string>();
      for (const stage of plan.stages) {
        if (stage.findingIds && Array.isArray(stage.findingIds)) {
          for (const id of stage.findingIds) {
            if (id) {
              if (backend === 'supabase' && !validateUuid(id)) {
                throw new Error(`Invalid finding UUID for Supabase deletion cleanup: ${id}`);
              }
              findingIdsSet.add(id);
            }
          }
        }
      }
      const uniqueFindingIds = Array.from(findingIdsSet);

      let findingsToRestore: DentalFinding[] = [];
      if (uniqueFindingIds.length > 0) {
        // We fetch the current findings to ensure we only update what exists and keep existing data intact
        const allFindings = await findingsRepository.listFindingsByPatient(patientId);
        findingsToRestore = allFindings.filter(f => uniqueFindingIds.includes(f.id));
      }

      // 2. Delete the treatment plan first. Stages are deleted via ON DELETE CASCADE in DB.
      await treatmentPlansRepository.deleteTreatmentPlan(patientId, plan.id);

      // 3. Only after successful plan deletion, restore linked findings.
      const nowIso = new Date().toISOString();
      const failedRestores: string[] = [];

      for (const finding of findingsToRestore) {
        try {
          // If the finding was included in a plan, we revert it to 'discovered'.
          // We could use its previous state if we tracked it, but 'discovered' is safe.
          await findingsRepository.updateFinding(patientId, {
            ...finding,
            status: 'discovered',
            includeInTreatmentPlan: false,
            updatedAt: nowIso,
          });
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          failedRestores.push(`Finding ${finding.id}: ${errMsg}`);
        }
      }

      // If any finding cleanup failed, we throw a clear error.
      // Note: Transaction limitation: The plan is already deleted.
      if (failedRestores.length > 0) {
        throw new Error(`Treatment plan was deleted successfully, but failed to restore linked findings: \n${failedRestores.join('\n')}`);
      }
    }
  };
}

export const LocalStorageClinicalWorkflowOrchestrator = createClinicalWorkflowOrchestrator({
  dentalChartRepository: LocalStorageDentalChartRepository,
  findingsRepository: LocalStorageFindingsRepository,
  treatmentPlansRepository: LocalStorageTreatmentPlansRepository,
});
