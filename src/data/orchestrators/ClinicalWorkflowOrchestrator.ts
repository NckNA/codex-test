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

export interface ClinicalWorkflowOrchestrator {
  applyToothStatusChange(input: ApplyToothStatusChangeInput): Promise<DentalChart>;
  createTreatmentPlanFromFindings(input: CreateTreatmentPlanFromFindingsInput): Promise<TreatmentPlan | null>;
}

export interface ClinicalWorkflowOrchestratorDependencies {
  dentalChartRepository: DentalChartRepository;
  findingsRepository: FindingsRepository;
  treatmentPlansRepository: TreatmentPlansRepository;
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
  const { dentalChartRepository, findingsRepository, treatmentPlansRepository } = dependencies;

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

      const date = input.now ?? new Date();
      const nowIso = date.toISOString();
      const planTimestamp = date.getTime();

      const stages = selectedFindings.map((finding, index): TreatmentStage => ({
        id: `stage_${planTimestamp}_${index}_${finding.id}`,
        title: finding.title,
        teeth: finding.toothNumber ? [finding.toothNumber] : [],
        description: buildStageDescription(finding),
        price: 0,
        status: 'planned',
        findingIds: [finding.id],
        source: 'from_finding',
      }));

      const plan: TreatmentPlan = {
        id: `plan_${planTimestamp}`,
        patientId,
        title: `План лечения от ${date.toLocaleDateString('ru-RU')}`,
        status: 'draft',
        stages,
        totalPrice: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await treatmentPlansRepository.createTreatmentPlan(patientId, plan);

      for (const finding of selectedFindings) {
        await findingsRepository.updateFinding(patientId, {
          ...finding,
          status: 'included_in_plan',
          includeInTreatmentPlan: true,
          updatedAt: nowIso,
        });
      }

      return plan;
    }
  };
}

export const LocalStorageClinicalWorkflowOrchestrator = createClinicalWorkflowOrchestrator({
  dentalChartRepository: LocalStorageDentalChartRepository,
  findingsRepository: LocalStorageFindingsRepository,
  treatmentPlansRepository: LocalStorageTreatmentPlansRepository,
});
