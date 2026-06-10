// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageTreatmentPlansRepository, createTreatmentPlansRepository, SupabaseTreatmentPlansRepository } from './TreatmentPlansRepository';
import type { TreatmentPlan, TreatmentStage } from '../../types';

import type { Mock } from 'vitest';

interface MockQueryBuilder {
  select: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  upsert: Mock;
  eq: Mock;
  then: Mock;
}

const { mockQueryBuilder, mockSupabase } = vi.hoisted(() => {
  const qb: MockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: (value: unknown) => void) => resolve({ data: [], error: null })),
  };
  return {
    mockQueryBuilder: qb,
    mockSupabase: {
      from: vi.fn(() => qb)
    }
  };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: mockSupabase,
}));

describe('TreatmentPlansRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    
    // Default success mock for supabase
    mockQueryBuilder.then.mockImplementation((resolve: (value: unknown) => void) => resolve({ data: [], error: null }));
  });

  describe('LocalStorageTreatmentPlansRepository', () => {
    it('listTreatmentPlansByPatient returns only matching patient plans', async () => {
      const plan1: TreatmentPlan = { id: '1', patientId: 'patient_1', title: 'A', status: 'draft', stages: [], totalPrice: 0, createdAt: '', updatedAt: '' };
      const plan2: TreatmentPlan = { id: '2', patientId: 'patient_2', title: 'B', status: 'draft', stages: [], totalPrice: 0, createdAt: '', updatedAt: '' };
      
      localStorage.setItem('df_treatment_plans', JSON.stringify([plan1, plan2]));

      const p1Plans = await LocalStorageTreatmentPlansRepository.listTreatmentPlansByPatient('patient_1');
      expect(p1Plans).toHaveLength(1);
      expect(p1Plans[0].id).toBe('1');
    });

    it('createTreatmentPlan persists plan', async () => {
      const newPlan: TreatmentPlan = { id: '123', patientId: 'patient_1', title: 'New Plan', status: 'draft', stages: [], totalPrice: 100, createdAt: 'now', updatedAt: 'now' };
      
      await LocalStorageTreatmentPlansRepository.createTreatmentPlan('patient_1', newPlan);

      const plans = await LocalStorageTreatmentPlansRepository.listTreatmentPlansByPatient('patient_1');
      expect(plans).toHaveLength(1);
      expect(plans[0].title).toBe('New Plan');
    });

    it('updateTreatmentPlan updates existing plan fields', async () => {
      const plan1: TreatmentPlan = { id: '1', patientId: 'patient_1', title: 'A', status: 'draft', stages: [], totalPrice: 0, createdAt: 'old', updatedAt: 'old' };
      localStorage.setItem('df_treatment_plans', JSON.stringify([plan1]));

      const updatedPlan = { ...plan1, title: 'Updated Plan', status: 'approved' as const };
      await LocalStorageTreatmentPlansRepository.updateTreatmentPlan('patient_1', updatedPlan);

      const plans = await LocalStorageTreatmentPlansRepository.listTreatmentPlansByPatient('patient_1');
      expect(plans[0].title).toBe('Updated Plan');
      expect(plans[0].status).toBe('approved');
    });

    it('deleteTreatmentPlan removes only the target plan', async () => {
      const plan1: TreatmentPlan = { id: '1', patientId: 'patient_1', title: 'A', status: 'draft', stages: [], totalPrice: 0, createdAt: 'old', updatedAt: 'old' };
      const plan2: TreatmentPlan = { id: '2', patientId: 'patient_1', title: 'B', status: 'draft', stages: [], totalPrice: 0, createdAt: 'old', updatedAt: 'old' };
      localStorage.setItem('df_treatment_plans', JSON.stringify([plan1, plan2]));

      await LocalStorageTreatmentPlansRepository.deleteTreatmentPlan('patient_1', '1');

      const plans = await LocalStorageTreatmentPlansRepository.listTreatmentPlansByPatient('patient_1');
      expect(plans).toHaveLength(1);
      expect(plans[0].id).toBe('2');
    });

    it('does not touch findings or dental charts', async () => {
      localStorage.setItem('df_dental_findings', JSON.stringify([{ id: '1' }]));
      localStorage.setItem('df_dental_charts', JSON.stringify([{ id: '1' }]));

      const plan: TreatmentPlan = { id: '1', patientId: 'patient_1', title: 'A', status: 'draft', stages: [], totalPrice: 0, createdAt: 'old', updatedAt: 'old' };
      
      await LocalStorageTreatmentPlansRepository.createTreatmentPlan('patient_1', plan);
      await LocalStorageTreatmentPlansRepository.updateTreatmentPlan('patient_1', { ...plan, title: 'B' });
      await LocalStorageTreatmentPlansRepository.deleteTreatmentPlan('patient_1', '1');

      expect(localStorage.getItem('df_dental_findings')).toBe(JSON.stringify([{ id: '1' }]));
      expect(localStorage.getItem('df_dental_charts')).toBe(JSON.stringify([{ id: '1' }]));
    });
  });

  describe('SupabaseTreatmentPlansRepository', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const validPlanUuid = '987e6543-e21b-12d3-a456-426614174000';
    const invalidUuid = 'local_patient_1';
    const repo = new SupabaseTreatmentPlansRepository('tenant_1');

    it('listTreatmentPlansByPatient throws on invalid UUID', async () => {
      await expect(repo.listTreatmentPlansByPatient(invalidUuid)).rejects.toThrow('Invalid patient UUID');
    });

    it('listTreatmentPlansByPatient filters by tenant_id and patient_id', async () => {
      await repo.listTreatmentPlansByPatient(validUuid);
      expect(mockSupabase.from).toHaveBeenCalledWith('treatment_plans');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*, treatment_stages(*)');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant_1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('patient_id', validUuid);
    });

    it('listTreatmentPlansByPatient correctly maps nullable fields', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: (value: unknown) => void) => resolve({
        data: [{
          id: validPlanUuid,
          patient_id: validUuid,
          title: 'Plan',
          status: 'draft',
          total_price: 100,
          created_at: '2023-01-01',
          updated_at: '2023-01-01',
          treatment_stages: [
            {
              id: 'stage-1',
              title: 'Stage',
              order_index: 0,
              // Nullable fields missing or null
              teeth: null,
              description: null,
              price: null,
              finding_ids: null,
              source: null
            }
          ]
        }],
        error: null
      }));

      const result = await repo.listTreatmentPlansByPatient(validUuid);
      expect(result).toHaveLength(1);
      const stage = result[0].stages[0];
      expect(stage.teeth).toEqual([]);
      expect(stage.description).toBe('');
      expect(stage.findingIds).toEqual([]);
      expect(stage.source).toBeUndefined();
    });

    it('createTreatmentPlan throws on invalid patient UUID before Supabase call', async () => {
      const plan: TreatmentPlan = { id: validPlanUuid, patientId: invalidUuid, title: 'A', status: 'draft', stages: [], totalPrice: 0, createdAt: '', updatedAt: '' };
      await expect(repo.createTreatmentPlan(invalidUuid, plan)).rejects.toThrow('Invalid patient UUID');
      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
    });

    it('createTreatmentPlan inserts plan and stages with tenant_id, order_index, and safely handles local IDs', async () => {
      const plan: TreatmentPlan = {
        id: 'local_plan_1', // Invalid UUID
        patientId: validUuid,
        title: 'Plan',
        status: 'draft',
        totalPrice: 100,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
        stages: [
          {
            id: 'local_stage_1', // Invalid UUID
            title: 'Stage 1',
            teeth: [11],
            price: 50,
            status: 'planned',
            findingIds: ['f1', 'f2', validUuid], // Mix of invalid and valid UUIDs
          } as TreatmentStage
        ]
      };

      await repo.createTreatmentPlan(validUuid, plan);

      expect(mockSupabase.from).toHaveBeenCalledWith('treatment_plans');
      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(2); // once for plan, once for stages

      // Plan insertion check
      const planInsertArgs = mockQueryBuilder.insert.mock.calls[0][0];
      expect(planInsertArgs.id).not.toBe('local_plan_1');
      expect(planInsertArgs.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(planInsertArgs.tenant_id).toBe('tenant_1');
      expect(planInsertArgs.patient_id).toBe(validUuid);

      // Stages insertion check
      const stagesInsertArgs = mockQueryBuilder.insert.mock.calls[1][0];
      expect(stagesInsertArgs).toHaveLength(1);
      expect(stagesInsertArgs[0].id).not.toBe('local_stage_1');
      expect(stagesInsertArgs[0].tenant_id).toBe('tenant_1');
      expect(stagesInsertArgs[0].treatment_plan_id).toBe(planInsertArgs.id);
      expect(stagesInsertArgs[0].order_index).toBe(0);
      expect(stagesInsertArgs[0].finding_ids).toEqual([validUuid]); // 'f1' and 'f2' filtered out
    });

    it('createTreatmentPlan throws on Supabase error', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: (value: unknown) => void) => resolve({ data: null, error: { message: 'DB Error' } }));
      const plan: TreatmentPlan = { id: validPlanUuid, patientId: validUuid, title: 'A', status: 'draft', stages: [], totalPrice: 0, createdAt: '', updatedAt: '' };
      await expect(repo.createTreatmentPlan(validUuid, plan)).rejects.toThrow('Failed to create treatment plan in Supabase: DB Error');
    });

    it('updateTreatmentPlan throws on invalid plan UUID', async () => {
      const plan: TreatmentPlan = { id: 'local_plan', patientId: validUuid, title: 'A', status: 'draft', stages: [], totalPrice: 0, createdAt: '', updatedAt: '' };
      await expect(repo.updateTreatmentPlan(validUuid, plan)).rejects.toThrow('Invalid plan UUID');
    });

    it('updateTreatmentPlan updates plan and uses upsert for stages', async () => {
      const plan: TreatmentPlan = {
        id: validPlanUuid,
        patientId: validUuid,
        title: 'Updated',
        status: 'approved',
        totalPrice: 200,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
        stages: [
          {
            id: 'local_stage_2',
            title: 'Stage 2',
            teeth: [12],
            price: 100,
            status: 'planned',
            findingIds: [],
            description: '',
          } as TreatmentStage
        ]
      };

      await repo.updateTreatmentPlan(validUuid, plan);

      expect(mockQueryBuilder.update).toHaveBeenCalled();
      // Verifying update filtering
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant_1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('patient_id', validUuid);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', validPlanUuid);

      // Verifying upsert strategy for stages
      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
      const upsertArgs = mockQueryBuilder.upsert.mock.calls[0][0];
      expect(upsertArgs[0].tenant_id).toBe('tenant_1');
      expect(upsertArgs[0].treatment_plan_id).toBe(validPlanUuid);
    });

    it('deleteTreatmentPlan filters securely by tenant_id, patient_id, and id', async () => {
      await repo.deleteTreatmentPlan(validUuid, validPlanUuid);
      expect(mockSupabase.from).toHaveBeenCalledWith('treatment_plans');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant_1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('patient_id', validUuid);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', validPlanUuid);
    });
  });

  describe('createTreatmentPlansRepository Factory', () => {
    it('returns LocalStorage repo when backend is local', () => {
      const repo = createTreatmentPlansRepository({ backend: 'local' });
      expect(repo).toBe(LocalStorageTreatmentPlansRepository);
    });

    it('returns LocalStorage repo when backend is local even if tenantId is provided', () => {
      const repo = createTreatmentPlansRepository({ backend: 'local', tenantId: 'tenant-1' });
      expect(repo).toBe(LocalStorageTreatmentPlansRepository);
    });

    it('returns SupabaseTreatmentPlansRepository when backend is supabase and tenantId is provided', () => {
      const repo = createTreatmentPlansRepository({ backend: 'supabase', tenantId: 'tenant-1' });
      expect(repo).toBeInstanceOf(SupabaseTreatmentPlansRepository);
    });

    it('throws error when backend is supabase but no tenantId is provided', () => {
      expect(() => {
        createTreatmentPlansRepository({ backend: 'supabase' });
      }).toThrow('tenantId is required for SupabaseTreatmentPlansRepository');
    });
  });
});
