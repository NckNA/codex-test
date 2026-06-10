import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClinicalWorkflowOrchestrator, LocalStorageClinicalWorkflowOrchestrator } from './ClinicalWorkflowOrchestrator';
import type { DentalChartRepository } from '../repositories/DentalChartRepository';
import type { FindingsRepository, CreateFindingInput } from '../repositories/FindingsRepository';
import type { TreatmentPlansRepository } from '../repositories/TreatmentPlansRepository';
import type { DentalChart, DentalFinding, TreatmentPlan, ToothRecord } from '../../types';

describe('ClinicalWorkflowOrchestrator', () => {
  let fakeDentalChartRepository: DentalChartRepository;
  let fakeFindingsRepository: FindingsRepository;
  let fakeTreatmentPlansRepository: TreatmentPlansRepository;
  
  let savedCharts: DentalChart[];
  let findings: DentalFinding[];
  let createdFindings: CreateFindingInput[];
  let updatedFindings: DentalFinding[];
  let createdPlans: TreatmentPlan[];
  let operationsLog: string[];

  beforeEach(() => {
    savedCharts = [];
    findings = [];
    createdFindings = [];
    updatedFindings = [];
    createdPlans = [];
    operationsLog = [];

    fakeDentalChartRepository = {
      getDentalChart: vi.fn(async () => ({} as DentalChart)),
      saveDentalChart: vi.fn(async (_patientId, chart) => {
        operationsLog.push('save-chart');
        savedCharts.push(chart);
      }),
    };

    fakeFindingsRepository = {
      listFindingsByPatient: vi.fn(async () => findings),
      createFinding: vi.fn(async (_patientId, input) => {
        operationsLog.push('create-finding');
        createdFindings.push(input);
      }),
      updateFinding: vi.fn(async (_patientId, finding) => {
        operationsLog.push(`update-finding:${finding.id}`);
        updatedFindings.push(finding);
      }),
      deleteFinding: vi.fn(async () => {}),
    };

    fakeTreatmentPlansRepository = {
      listTreatmentPlansByPatient: vi.fn(async () => []),
      createTreatmentPlan: vi.fn(async (_patientId, plan) => {
        operationsLog.push('create-plan');
        createdPlans.push(plan);
      }),
      updateTreatmentPlan: vi.fn(async () => {}),
      deleteTreatmentPlan: vi.fn(async () => {}),
    };
  });

  describe('applyToothStatusChange', () => {
    it('saves updated chart and returns new chart object without touching findings if payload is null', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
      });

      const initialChart: DentalChart = {
        id: 'c1', patientId: 'p1', createdAt: 'old', updatedAt: 'old',
        teeth: [
          { toothNumber: 11, condition: 'healthy', updatedAt: 'old' },
          { toothNumber: 12, condition: 'healthy', updatedAt: 'old' }
        ]
      };
      
      const updatedTooth: ToothRecord = { toothNumber: 11, condition: 'caries', updatedAt: 'new' };

      const result = await orchestrator.applyToothStatusChange({
        patientId: 'p1',
        chart: initialChart,
        updatedTooth,
        findingPayload: null
      });

      expect(fakeDentalChartRepository.saveDentalChart).toHaveBeenCalledOnce();
      expect(result.teeth[0].condition).toBe('caries');
      expect(result.updatedAt).not.toBe('old');
      expect(result).not.toBe(initialChart);
      expect(initialChart.updatedAt).toBe('old'); // not mutated

      expect(fakeFindingsRepository.listFindingsByPatient).not.toHaveBeenCalled();
      expect(fakeFindingsRepository.createFinding).not.toHaveBeenCalled();
      expect(fakeFindingsRepository.updateFinding).not.toHaveBeenCalled();
    });

    it('does not create/update finding when payload is incomplete', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
      });

      const initialChart: DentalChart = {
        id: 'c1', patientId: 'p1', createdAt: 'old', updatedAt: 'old',
        teeth: [{ toothNumber: 11, condition: 'healthy', updatedAt: 'old' }]
      };
      
      const updatedTooth: ToothRecord = { toothNumber: 11, condition: 'caries', updatedAt: 'new' };

      // Missing title
      await orchestrator.applyToothStatusChange({
        patientId: 'p1', chart: initialChart, updatedTooth,
        findingPayload: { category: 'caries', severity: 'high' } as unknown as import('./ClinicalWorkflowOrchestrator').ToothStatusFindingInput
      });

      expect(fakeDentalChartRepository.saveDentalChart).toHaveBeenCalledOnce();
      expect(fakeFindingsRepository.listFindingsByPatient).not.toHaveBeenCalled();
    });

    it('creates new finding when payload is valid and no active finding exists', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
      });

      findings = []; // No existing findings

      await orchestrator.applyToothStatusChange({
        patientId: 'p1',
        chart: { id: 'c1', patientId: 'p1', createdAt: 'old', updatedAt: 'old', teeth: [{ toothNumber: 11, condition: 'healthy', updatedAt: 'old' }] },
        updatedTooth: { toothNumber: 11, condition: 'caries', updatedAt: 'new' },
        findingPayload: {
          title: 'Deep caries',
          category: 'caries',
          severity: 'high',
          description: 'desc',
          isChiefComplaintRelated: true
        }
      });

      expect(fakeFindingsRepository.listFindingsByPatient).toHaveBeenCalledOnce();
      expect(fakeFindingsRepository.createFinding).toHaveBeenCalledOnce();
      expect(fakeFindingsRepository.updateFinding).not.toHaveBeenCalled();
      expect(fakeTreatmentPlansRepository.createTreatmentPlan).not.toHaveBeenCalled();

      expect(createdFindings[0]).toMatchObject({
        toothNumber: 11,
        title: 'Deep caries',
        category: 'caries',
        severity: 'high',
        description: 'desc',
        isChiefComplaintRelated: true,
        status: 'discovered'
      });
    });

    it('updates existing active finding when toothNumber and category match', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
      });

      findings = [
        { id: 'f1', patientId: 'p1', toothNumber: 11, category: 'caries', title: 'Old title', severity: 'medium', status: 'recommended', description: '', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' }
      ];

      await orchestrator.applyToothStatusChange({
        patientId: 'p1',
        chart: { id: 'c1', patientId: 'p1', createdAt: 'old', updatedAt: 'old', teeth: [{ toothNumber: 11, condition: 'healthy', updatedAt: 'old' }] },
        updatedTooth: { toothNumber: 11, condition: 'caries', updatedAt: 'new' },
        findingPayload: {
          title: 'New title',
          category: 'caries',
          severity: 'high'
        }
      });

      expect(fakeFindingsRepository.createFinding).not.toHaveBeenCalled();
      expect(fakeFindingsRepository.updateFinding).toHaveBeenCalledOnce();
      
      expect(updatedFindings[0]).toMatchObject({
        id: 'f1',
        title: 'New title',
        severity: 'high',
        status: 'recommended' // preserved
      });
    });

    it('ignores completed/declined findings and creates a new one', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
      });

      findings = [
        { id: 'f1', patientId: 'p1', toothNumber: 11, category: 'caries', title: 'Old', severity: 'medium', status: 'completed', description: '', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' },
        { id: 'f2', patientId: 'p1', toothNumber: 11, category: 'caries', title: 'Old 2', severity: 'medium', status: 'declined_by_patient', description: '', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' }
      ];

      await orchestrator.applyToothStatusChange({
        patientId: 'p1',
        chart: { id: 'c1', patientId: 'p1', createdAt: 'old', updatedAt: 'old', teeth: [{ toothNumber: 11, condition: 'healthy', updatedAt: 'old' }] },
        updatedTooth: { toothNumber: 11, condition: 'caries', updatedAt: 'new' },
        findingPayload: { title: 'New', category: 'caries', severity: 'high' }
      });

      expect(fakeFindingsRepository.createFinding).toHaveBeenCalledOnce();
      expect(fakeFindingsRepository.updateFinding).not.toHaveBeenCalled();
    });

    it('does not update finding with different category or tooth', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
      });

      findings = [
        { id: 'f1', patientId: 'p1', toothNumber: 11, category: 'pain', title: 'Old', severity: 'medium', status: 'discovered', description: '', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' },
        { id: 'f2', patientId: 'p1', toothNumber: 12, category: 'caries', title: 'Old2', severity: 'medium', status: 'discovered', description: '', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' }
      ];

      await orchestrator.applyToothStatusChange({
        patientId: 'p1',
        chart: { id: 'c1', patientId: 'p1', createdAt: 'old', updatedAt: 'old', teeth: [{ toothNumber: 11, condition: 'healthy', updatedAt: 'old' }] },
        updatedTooth: { toothNumber: 11, condition: 'caries', updatedAt: 'new' },
        findingPayload: { title: 'New', category: 'caries', severity: 'high' }
      });

      expect(fakeFindingsRepository.createFinding).toHaveBeenCalledOnce();
      expect(fakeFindingsRepository.updateFinding).not.toHaveBeenCalled();
    });
  });

  describe('createTreatmentPlanFromFindings', () => {
    it('returns null and does nothing if selectedFindings is empty', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
      });

      const result = await orchestrator.createTreatmentPlanFromFindings({
        patientId: 'p1',
        selectedFindings: []
      });

      expect(result).toBeNull();
      expect(fakeTreatmentPlansRepository.createTreatmentPlan).not.toHaveBeenCalled();
      expect(fakeFindingsRepository.updateFinding).not.toHaveBeenCalled();
      expect(fakeDentalChartRepository.saveDentalChart).not.toHaveBeenCalled();
    });

    it('creates draft treatment plan and updates findings (local backend)', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
      });

      const now = new Date('2026-01-10T12:00:00.000Z');
      const selectedFindings: DentalFinding[] = [
        { id: 'f1', patientId: 'p1', toothNumber: 11, category: 'caries', title: 'Find 1', severity: 'medium', description: 'desc 1', recommendation: 'rec 1', status: 'discovered', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' },
        { id: 'f2', patientId: 'p1', category: 'hygiene', title: 'Find 2', severity: 'low', description: 'desc 2', status: 'discovered', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' } // missing toothNumber and recommendation
      ];

      const result = await orchestrator.createTreatmentPlanFromFindings({
        patientId: 'p1',
        selectedFindings,
        now
      });

      // Verify Plan
      expect(fakeTreatmentPlansRepository.createTreatmentPlan).toHaveBeenCalledOnce();
      expect(result).not.toBeNull();
      expect(result?.id).toBe(`plan_${now.getTime()}`);
      expect(result?.patientId).toBe('p1');
      expect(result?.status).toBe('draft');
      expect(result?.totalPrice).toBe(0);
      expect(result?.createdAt).toBe(now.toISOString());
      expect(result?.updatedAt).toBe(now.toISOString());
      
      expect(result?.stages).toHaveLength(2);
      expect(result?.stages[0].id).toBe(`stage_${now.getTime()}_0_f1`);
      expect(result?.stages[0].title).toBe('Find 1');
      expect(result?.stages[0].teeth).toEqual([11]);
      expect(result?.stages[0].description).toContain('desc 1');
      expect(result?.stages[0].description).toContain('Рекомендация: rec 1');
      expect(result?.stages[0].status).toBe('planned');
      expect(result?.stages[0].findingIds).toEqual(['f1']);
      expect(result?.stages[0].source).toBe('from_finding');

      expect(result?.stages[1].title).toBe('Find 2');
      expect(result?.stages[1].teeth).toEqual([]); // missing tooth
      expect(result?.stages[1].description).toBe('desc 2'); // no recommendation

      // Verify Findings Updated
      expect(fakeFindingsRepository.updateFinding).toHaveBeenCalledTimes(2);
      expect(updatedFindings[0].status).toBe('included_in_plan');
      expect(updatedFindings[0].includeInTreatmentPlan).toBe(true);
      expect(updatedFindings[0].updatedAt).toBe(now.toISOString());
      expect(updatedFindings[1].status).toBe('included_in_plan');
      expect(updatedFindings[1].includeInTreatmentPlan).toBe(true);
      
      // Verify isolation
      expect(fakeDentalChartRepository.saveDentalChart).not.toHaveBeenCalled();
      expect(fakeFindingsRepository.listFindingsByPatient).not.toHaveBeenCalled();
      
      // Verify operation order (plan created before findings updated)
      expect(operationsLog[0]).toBe('create-plan');
      expect(operationsLog[1]).toBe('update-finding:f1');
      expect(operationsLog[2]).toBe('update-finding:f2');
    });

    it('creates draft treatment plan with valid UUIDs in supabase backend', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
        backend: 'supabase',
      });

      const now = new Date('2026-01-10T12:00:00.000Z');
      const validPatientId = crypto.randomUUID();
      const validFindingId1 = crypto.randomUUID();
      const validFindingId2 = crypto.randomUUID();

      const selectedFindings: DentalFinding[] = [
        { id: validFindingId1, patientId: validPatientId, toothNumber: 11, category: 'caries', title: 'Find 1', severity: 'medium', description: 'desc 1', recommendation: 'rec 1', status: 'discovered', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' },
        { id: validFindingId2, patientId: validPatientId, category: 'hygiene', title: 'Find 2', severity: 'low', description: 'desc 2', status: 'discovered', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' }
      ];

      const result = await orchestrator.createTreatmentPlanFromFindings({
        patientId: validPatientId,
        selectedFindings,
        now
      });

      expect(fakeTreatmentPlansRepository.createTreatmentPlan).toHaveBeenCalledOnce();
      expect(result).not.toBeNull();
      // Should be valid UUID
      expect(result?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(result?.patientId).toBe(validPatientId);
      
      expect(result?.stages).toHaveLength(2);
      expect(result?.stages[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(result?.stages[0].findingIds).toEqual([validFindingId1]);

      expect(result?.stages[1].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

      // Verify Findings Updated
      expect(fakeFindingsRepository.updateFinding).toHaveBeenCalledTimes(2);
    });

    it('rejects supabase generation if patientId is invalid UUID', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
        backend: 'supabase',
      });

      const selectedFindings: DentalFinding[] = [
        { id: crypto.randomUUID(), patientId: 'p1', toothNumber: 11, category: 'caries', title: 'Find 1', severity: 'medium', description: '', status: 'discovered', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' }
      ];

      await expect(orchestrator.createTreatmentPlanFromFindings({ patientId: 'invalid-id', selectedFindings }))
        .rejects.toThrow('Invalid patient UUID for Supabase generation');
      expect(fakeTreatmentPlansRepository.createTreatmentPlan).not.toHaveBeenCalled();
    });

    it('rejects supabase generation if any finding ID is invalid UUID', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
        backend: 'supabase',
      });

      const validPatientId = crypto.randomUUID();
      const selectedFindings: DentalFinding[] = [
        { id: 'f1', patientId: validPatientId, toothNumber: 11, category: 'caries', title: 'Find 1', severity: 'medium', description: '', status: 'discovered', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' }
      ];

      await expect(orchestrator.createTreatmentPlanFromFindings({ patientId: validPatientId, selectedFindings }))
        .rejects.toThrow('Invalid finding UUID for Supabase generation: f1');
      expect(fakeTreatmentPlansRepository.createTreatmentPlan).not.toHaveBeenCalled();
    });

    it('rejects supabase generation if any finding belongs to a different patient', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
        backend: 'supabase',
      });

      const validPatientIdA = crypto.randomUUID();
      const validPatientIdB = crypto.randomUUID();
      const validFindingId = crypto.randomUUID();

      const selectedFindings: DentalFinding[] = [
        { id: validFindingId, patientId: validPatientIdB, toothNumber: 11, category: 'caries', title: 'Find 1', severity: 'medium', description: '', status: 'discovered', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' }
      ];

      await expect(orchestrator.createTreatmentPlanFromFindings({ patientId: validPatientIdA, selectedFindings }))
        .rejects.toThrow(`Selected finding does not belong to patient: ${validFindingId}`);
      
      expect(fakeTreatmentPlansRepository.createTreatmentPlan).not.toHaveBeenCalled();
      expect(fakeFindingsRepository.updateFinding).not.toHaveBeenCalled();
    });

    it('propagates repository errors and does not update findings if plan creation fails', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
      });

      fakeTreatmentPlansRepository.createTreatmentPlan = vi.fn().mockRejectedValue(new Error('DB Error'));

      const selectedFindings: DentalFinding[] = [
        { id: 'f1', patientId: 'p1', toothNumber: 11, category: 'caries', title: 'Find 1', severity: 'medium', description: 'desc 1', status: 'discovered', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' }
      ];

      await expect(orchestrator.createTreatmentPlanFromFindings({ patientId: 'p1', selectedFindings }))
        .rejects.toThrow('DB Error');

      expect(fakeFindingsRepository.updateFinding).not.toHaveBeenCalled();
    });
  });

  describe('deleteTreatmentPlanWithCleanup', () => {
    it('deletes treatment plan and restores linked findings successfully', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
      });

      findings = [
        { id: 'f1', patientId: 'p1', category: 'caries', title: 'F1', severity: 'medium', status: 'included_in_plan', isChiefComplaintRelated: false, includeInTreatmentPlan: true, createdAt: '', updatedAt: '', description: '' },
        { id: 'f2', patientId: 'p1', category: 'caries', title: 'F2', severity: 'medium', status: 'included_in_plan', isChiefComplaintRelated: false, includeInTreatmentPlan: true, createdAt: '', updatedAt: '', description: '' },
        { id: 'f3', patientId: 'p1', category: 'pain', title: 'F3', severity: 'low', status: 'discovered', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '', description: '' }, // Not in plan
      ];

      const plan: TreatmentPlan = {
        id: 'plan_1',
        patientId: 'p1',
        title: 'Plan 1',
        status: 'draft',
        totalPrice: 0,
        createdAt: '',
        updatedAt: '',
        stages: [
          { id: 's1', title: 'Stage 1', teeth: [], description: '', price: 0, status: 'planned', findingIds: ['f1', 'f2'] },
          { id: 's2', title: 'Stage 2', teeth: [], description: '', price: 0, status: 'planned', findingIds: ['f1'] } // duplicate findingId
        ]
      };

      await orchestrator.deleteTreatmentPlanWithCleanup({ patientId: 'p1', plan });

      // Verify Plan deleted
      expect(fakeTreatmentPlansRepository.deleteTreatmentPlan).toHaveBeenCalledOnce();
      expect(fakeTreatmentPlansRepository.deleteTreatmentPlan).toHaveBeenCalledWith('p1', 'plan_1');

      // Verify Findings restored (only f1 and f2 exactly once each due to deduplication)
      expect(fakeFindingsRepository.listFindingsByPatient).toHaveBeenCalledOnce();
      expect(fakeFindingsRepository.updateFinding).toHaveBeenCalledTimes(2);

      const f1Update = updatedFindings.find(f => f.id === 'f1');
      const f2Update = updatedFindings.find(f => f.id === 'f2');
      const f3Update = updatedFindings.find(f => f.id === 'f3');

      expect(f1Update?.status).toBe('discovered');
      expect(f1Update?.includeInTreatmentPlan).toBe(false);

      expect(f2Update?.status).toBe('discovered');
      expect(f2Update?.includeInTreatmentPlan).toBe(false);

      expect(f3Update).toBeUndefined(); // f3 was not updated
    });

    it('rejects if delete fails and does not update findings', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
      });

      fakeTreatmentPlansRepository.deleteTreatmentPlan = vi.fn().mockRejectedValue(new Error('Delete Error'));

      const plan: TreatmentPlan = {
        id: 'plan_1', patientId: 'p1', title: '', status: 'draft', totalPrice: 0, createdAt: '', updatedAt: '',
        stages: [{ id: 's1', title: '', teeth: [], description: '', price: 0, status: 'planned', findingIds: ['f1'] }]
      };

      await expect(orchestrator.deleteTreatmentPlanWithCleanup({ patientId: 'p1', plan })).rejects.toThrow('Delete Error');

      expect(fakeTreatmentPlansRepository.deleteTreatmentPlan).toHaveBeenCalledOnce();
      expect(fakeFindingsRepository.updateFinding).not.toHaveBeenCalled();
    });

    it('throws combined error if finding restore fails after plan deletion', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
      });

      findings = [
        { id: 'f1', patientId: 'p1', category: 'caries', title: 'F1', severity: 'medium', status: 'included_in_plan', isChiefComplaintRelated: false, includeInTreatmentPlan: true, createdAt: '', updatedAt: '', description: '' },
      ];

      fakeFindingsRepository.updateFinding = vi.fn().mockRejectedValue(new Error('Update failed'));

      const plan: TreatmentPlan = {
        id: 'plan_1', patientId: 'p1', title: '', status: 'draft', totalPrice: 0, createdAt: '', updatedAt: '',
        stages: [{ id: 's1', title: '', teeth: [], description: '', price: 0, status: 'planned', findingIds: ['f1'] }]
      };

      await expect(orchestrator.deleteTreatmentPlanWithCleanup({ patientId: 'p1', plan }))
        .rejects.toThrow(/Treatment plan was deleted successfully, but failed to restore linked findings: \nFinding f1: Update failed/);

      expect(fakeTreatmentPlansRepository.deleteTreatmentPlan).toHaveBeenCalledOnce();
      expect(fakeFindingsRepository.updateFinding).toHaveBeenCalledOnce();
    });

    it('validates UUIDs in supabase backend', async () => {
      const orchestrator = createClinicalWorkflowOrchestrator({
        dentalChartRepository: fakeDentalChartRepository,
        findingsRepository: fakeFindingsRepository,
        treatmentPlansRepository: fakeTreatmentPlansRepository,
        backend: 'supabase'
      });

      const plan: TreatmentPlan = {
        id: 'invalid-id', patientId: 'p1', title: '', status: 'draft', totalPrice: 0, createdAt: '', updatedAt: '',
        stages: []
      };

      await expect(orchestrator.deleteTreatmentPlanWithCleanup({ patientId: 'p1', plan }))
        .rejects.toThrow('Invalid patient UUID for Supabase deletion');
        
      const validPatientId = crypto.randomUUID();
      await expect(orchestrator.deleteTreatmentPlanWithCleanup({ patientId: validPatientId, plan }))
        .rejects.toThrow(`Invalid plan UUID for Supabase deletion: invalid-id`);
        
      expect(fakeTreatmentPlansRepository.deleteTreatmentPlan).not.toHaveBeenCalled();
    });
  });

  describe('Exports', () => {
    it('exports LocalStorageClinicalWorkflowOrchestrator', () => {
      expect(LocalStorageClinicalWorkflowOrchestrator).toBeDefined();
    });
  });
});
