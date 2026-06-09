// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { LocalStorageFindingsRepository, SupabaseFindingsRepository, createFindingsRepository, type CreateFindingInput } from './FindingsRepository';
import type { DentalFinding } from '../../types';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {}
}));

describe('FindingsRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('LocalStorageFindingsRepository', () => {
    it('listFindingsByPatient returns only matching patient findings', async () => {
      const finding1: DentalFinding = { id: '1', patientId: 'patient_1', toothNumber: 11, category: 'caries', title: 'A', severity: 'medium', description: 'a', isChiefComplaintRelated: false, includeInTreatmentPlan: false, status: 'discovered', createdAt: '', updatedAt: '' };
      const finding2: DentalFinding = { id: '2', patientId: 'patient_2', toothNumber: 12, category: 'caries', title: 'B', severity: 'medium', description: 'b', isChiefComplaintRelated: false, includeInTreatmentPlan: false, status: 'discovered', createdAt: '', updatedAt: '' };
      
      localStorage.setItem('df_dental_findings', JSON.stringify([finding1, finding2]));

      const patient1Findings = await LocalStorageFindingsRepository.listFindingsByPatient('patient_1');
      expect(patient1Findings).toHaveLength(1);
      expect(patient1Findings[0].id).toBe('1');
    });

    it('createFinding persists finding with generated id, patientId, createdAt, updatedAt', async () => {
      const findingDraft: CreateFindingInput = {
        toothNumber: 11,
        category: 'caries',
        title: 'Caries',
        description: 'Deep caries',
        severity: 'high',
        isChiefComplaintRelated: false,
        includeInTreatmentPlan: false,
        status: 'discovered'
      };

      await LocalStorageFindingsRepository.createFinding('patient_1', findingDraft);

      const findings = await LocalStorageFindingsRepository.listFindingsByPatient('patient_1');
      expect(findings).toHaveLength(1);
      const saved = findings[0];
      
      expect(saved.patientId).toBe('patient_1');
      expect(typeof saved.id).toBe('string');
      expect(typeof saved.createdAt).toBe('string');
      expect(typeof saved.updatedAt).toBe('string');
      expect(saved.title).toBe('Caries');
      expect(saved.status).toBe('discovered');
    });

    it('updateFinding updates only matching patient/finding', async () => {
      const finding1: DentalFinding = { id: '1', patientId: 'patient_1', toothNumber: 11, category: 'caries', title: 'A', severity: 'medium', description: 'a', isChiefComplaintRelated: false, includeInTreatmentPlan: false, status: 'discovered', createdAt: 'old', updatedAt: 'old' };
      const finding2: DentalFinding = { id: '2', patientId: 'patient_2', toothNumber: 12, category: 'caries', title: 'B', severity: 'medium', description: 'b', isChiefComplaintRelated: false, includeInTreatmentPlan: false, status: 'discovered', createdAt: 'old', updatedAt: 'old' };
      
      localStorage.setItem('df_dental_findings', JSON.stringify([finding1, finding2]));

      const updatedFinding = { ...finding1, title: 'Updated Title', status: 'completed' as const };
      await LocalStorageFindingsRepository.updateFinding('patient_1', updatedFinding);

      const p1 = await LocalStorageFindingsRepository.listFindingsByPatient('patient_1');
      expect(p1[0].title).toBe('Updated Title');
      expect(p1[0].status).toBe('completed');
      expect(p1[0].updatedAt).not.toBe('old');

      const p2 = await LocalStorageFindingsRepository.listFindingsByPatient('patient_2');
      expect(p2[0].title).toBe('B');
      expect(p2[0].status).toBe('discovered');
    });

    it('deleteFinding removes only matching finding', async () => {
      const finding1: DentalFinding = { id: '1', patientId: 'patient_1', toothNumber: 11, category: 'caries', title: 'A', severity: 'medium', description: 'a', isChiefComplaintRelated: false, includeInTreatmentPlan: false, status: 'discovered', createdAt: 'old', updatedAt: 'old' };
      const finding2: DentalFinding = { id: '2', patientId: 'patient_1', toothNumber: 12, category: 'caries', title: 'B', severity: 'medium', description: 'b', isChiefComplaintRelated: false, includeInTreatmentPlan: false, status: 'discovered', createdAt: 'old', updatedAt: 'old' };
      
      localStorage.setItem('df_dental_findings', JSON.stringify([finding1, finding2]));

      await LocalStorageFindingsRepository.deleteFinding('patient_1', '1');

      const p1 = await LocalStorageFindingsRepository.listFindingsByPatient('patient_1');
      expect(p1).toHaveLength(1);
      expect(p1[0].id).toBe('2');
    });
  });

  describe('createFindingsRepository', () => {
    it('returns LocalStorageFindingsRepository by default', () => {
      const repo = createFindingsRepository({ backend: 'local' });
      expect(repo).toBe(LocalStorageFindingsRepository);
    });

    it('returns LocalStorageFindingsRepository if tenantId is missing even when backend is supabase', () => {
      const repo = createFindingsRepository({ backend: 'supabase' });
      expect(repo).toBe(LocalStorageFindingsRepository);
    });

    it('returns SupabaseFindingsRepository if backend is supabase and tenantId is provided', () => {
      const repo = createFindingsRepository({ backend: 'supabase', tenantId: 't1' });
      expect(repo).toBeInstanceOf(SupabaseFindingsRepository);
    });
  });

  describe('SupabaseFindingsRepository', () => {
    const mockClient = {
      from: vi.fn(),
    } as unknown as SupabaseClient;

    const mockSelect = vi.fn();
    const mockInsert = vi.fn();
    const mockUpdate = vi.fn();
    const mockDelete = vi.fn();
    const mockEq = vi.fn();
    const mockOrder = vi.fn();

    beforeEach(() => {
      (mockClient.from as Mock).mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      });

      mockSelect.mockReturnValue({ eq: mockEq });
      mockInsert.mockReturnValue({ error: null });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockDelete.mockReturnValue({ eq: mockEq });
      
      // Setup chainable eq
      const mockEqChain = { eq: mockEq, order: mockOrder };
      mockEq.mockReturnValue(mockEqChain);
      mockOrder.mockResolvedValue({ data: [], error: null });
    });

    it('listFindingsByPatient filters by tenant_id and patient_id and orders by created_at', async () => {
      const repo = new SupabaseFindingsRepository('tenant1', mockClient);
      await repo.listFindingsByPatient('patient1');
      expect((mockClient.from as Mock)).toHaveBeenCalledWith('findings');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant1');
      expect(mockEq).toHaveBeenCalledWith('patient_id', 'patient1');
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('listFindingsByPatient maps fields correctly and handles null tooth_number', async () => {
      mockOrder.mockResolvedValue({
        data: [{
          id: 'uuid-1',
          patient_id: 'patient1',
          tooth_number: null,
          title: 'Gum problem',
          category: 'gum_problem',
          severity: 'low',
          description: 'desc',
          risk_description: null,
          recommendation: null,
          is_chief_complaint_related: true,
          include_in_treatment_plan: false,
          status: 'discovered',
          created_at: '2020',
          updated_at: '2020',
        }],
        error: null,
      });

      const repo = new SupabaseFindingsRepository('tenant1', mockClient);
      const res = await repo.listFindingsByPatient('patient1');
      expect(res).toHaveLength(1);
      expect(res[0]).toEqual({
        id: 'uuid-1',
        patientId: 'patient1',
        toothNumber: undefined,
        title: 'Gum problem',
        category: 'gum_problem',
        severity: 'low',
        description: 'desc',
        riskDescription: undefined,
        recommendation: undefined,
        isChiefComplaintRelated: true,
        includeInTreatmentPlan: false,
        status: 'discovered',
        createdAt: '2020',
        updatedAt: '2020',
      });
    });

    it('createFinding maps inputs properly and generates UUID', async () => {
      const repo = new SupabaseFindingsRepository('tenant1', mockClient);
      await repo.createFinding('patient1', {
        toothNumber: undefined,
        title: 'Gum problem',
        category: 'gum_problem',
        severity: 'low',
        description: 'mild gingivitis',
        isChiefComplaintRelated: false,
        includeInTreatmentPlan: false,
        status: 'discovered',
      });

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        id: expect.any(String),
        tenant_id: 'tenant1',
        patient_id: 'patient1',
        tooth_number: null,
        title: 'Gum problem',
        category: 'gum_problem',
        severity: 'low',
        description: 'mild gingivitis',
        risk_description: null,
        recommendation: null,
        is_chief_complaint_related: false,
        include_in_treatment_plan: false,
        status: 'discovered',
      }));
    });

    it('updateFinding maps and filters by tenant_id', async () => {
      // Setup mock returns for the chain
      mockEq.mockReturnValueOnce({ eq: mockEq });
      mockEq.mockReturnValueOnce({ eq: mockEq });
      mockEq.mockResolvedValueOnce({ error: null });

      const repo = new SupabaseFindingsRepository('tenant1', mockClient);
      await repo.updateFinding('patient1', {
        id: 'uuid-1',
        patientId: 'patient1',
        toothNumber: 12,
        title: 'A',
        category: 'caries',
        severity: 'high',
        description: 'desc',
        isChiefComplaintRelated: true,
        includeInTreatmentPlan: true,
        status: 'completed',
        createdAt: '2020',
        updatedAt: '2020',
      });

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        tooth_number: 12,
        status: 'completed',
        is_chief_complaint_related: true,
        include_in_treatment_plan: true,
      }));
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant1');
      expect(mockEq).toHaveBeenCalledWith('patient_id', 'patient1');
      expect(mockEq).toHaveBeenCalledWith('id', 'uuid-1');
    });

    it('deleteFinding filters by tenant_id and finding id', async () => {
      mockEq.mockReturnValueOnce({ eq: mockEq });
      mockEq.mockReturnValueOnce({ eq: mockEq });
      mockEq.mockResolvedValueOnce({ error: null });

      const repo = new SupabaseFindingsRepository('tenant1', mockClient);
      await repo.deleteFinding('patient1', 'uuid-1');

      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant1');
      expect(mockEq).toHaveBeenCalledWith('patient_id', 'patient1');
      expect(mockEq).toHaveBeenCalledWith('id', 'uuid-1');
    });
  });
});
