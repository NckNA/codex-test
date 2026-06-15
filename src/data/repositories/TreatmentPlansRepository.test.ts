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
      from: vi.fn(() => qb),
      rpc: vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
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
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
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
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('createTreatmentPlan invokes save_treatment_plan_with_stages RPC once with mapped params', async () => {
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

      expect(mockSupabase.rpc).toHaveBeenCalledOnce();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('save_treatment_plan_with_stages', expect.any(Object));

      const rpcArgs = mockSupabase.rpc.mock.calls[0][1] as Record<string, any>;
      expect(rpcArgs.p_tenant_id).toBe('tenant_1');
      expect(rpcArgs.p_patient_id).toBe(validUuid);
      expect(rpcArgs.p_plan_id).not.toBe('local_plan_1');
      expect(rpcArgs.p_plan_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(rpcArgs.p_title).toBe('Plan');
      expect(rpcArgs.p_status).toBe('draft');
      expect(rpcArgs.p_total_price).toBe(100);

      expect(rpcArgs.p_stages).toHaveLength(1);
      const stage = rpcArgs.p_stages[0];
      expect(stage.id).not.toBe('local_stage_1');
      expect(stage.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(stage.title).toBe('Stage 1');
      expect(stage.teeth).toEqual([11]);
      expect(stage.price).toBe(50);
      expect(stage.status).toBe('planned');
      expect(stage.findingIds).toEqual([validUuid]);
    });

    it('createTreatmentPlan throws on Supabase RPC error', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'RPC DB Error' } });
      const plan: TreatmentPlan = { id: validPlanUuid, patientId: validUuid, title: 'A', status: 'draft', stages: [], totalPrice: 0, createdAt: '', updatedAt: '' };
      await expect(repo.createTreatmentPlan(validUuid, plan)).rejects.toThrow('Failed to create treatment plan in Supabase: RPC DB Error');
    });

    it('updateTreatmentPlan throws on invalid plan UUID', async () => {
      const plan: TreatmentPlan = { id: 'local_plan', patientId: validUuid, title: 'A', status: 'draft', stages: [], totalPrice: 0, createdAt: '', updatedAt: '' };
      await expect(repo.updateTreatmentPlan(validUuid, plan)).rejects.toThrow('Invalid plan UUID');
    });

    it('updateTreatmentPlan invokes save_treatment_plan_with_stages RPC once with submitted stages', async () => {
      const validStageUuid = '111e6543-e21b-12d3-a456-426614174000';
      const externalStageUuid = '222e6543-e21b-12d3-a456-426614174000';

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
            id: validStageUuid,
            title: 'Stage 1',
            teeth: [12],
            price: 100,
            status: 'planned',
            findingIds: [],
            description: '',
          } as TreatmentStage,
          {
            id: externalStageUuid,
            title: 'Stage 2',
            teeth: [13],
            price: 50,
            status: 'planned',
            findingIds: [],
            description: '',
          } as TreatmentStage,
          {
            id: 'local_stage_1',
            title: 'Stage 3',
            teeth: [14],
            price: 50,
            status: 'planned',
            findingIds: [],
            description: '',
          } as TreatmentStage
        ]
      };

      await repo.updateTreatmentPlan(validUuid, plan);

      expect(mockSupabase.rpc).toHaveBeenCalledOnce();
      const rpcArgs = mockSupabase.rpc.mock.calls[0][1] as Record<string, any>;
      expect(rpcArgs.p_plan_id).toBe(validPlanUuid);
      expect(rpcArgs.p_stages).toHaveLength(3);

      expect(rpcArgs.p_stages[0].id).toBe(validStageUuid);
      expect(rpcArgs.p_stages[1].id).toBe(externalStageUuid); // Sent to RPC to handle ownership rejection
      expect(rpcArgs.p_stages[2].id).not.toBe('local_stage_1');
      expect(rpcArgs.p_stages[2].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('updateTreatmentPlan delegates stage deletion by sending only submitted stages', async () => {
      const validStageUuid = '111e6543-e21b-12d3-a456-426614174000';
      const plan: TreatmentPlan = {
        id: validPlanUuid,
        patientId: validUuid,
        title: 'Updated',
        status: 'approved',
        totalPrice: 100,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
        stages: [
          {
            id: validStageUuid,
            title: 'Stage 1',
            teeth: [12],
            price: 100,
            status: 'planned',
            findingIds: [],
            description: '',
          } as TreatmentStage
        ]
      };

      await repo.updateTreatmentPlan(validUuid, plan);

      expect(mockSupabase.rpc).toHaveBeenCalledOnce();
      const rpcArgs = mockSupabase.rpc.mock.calls[0][1] as Record<string, any>;
      expect(rpcArgs.p_stages).toHaveLength(1);
      expect(rpcArgs.p_stages[0].id).toBe(validStageUuid);
    });

    it('deleteTreatmentPlan proves delete Supabase error is thrown for non-admin', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: (value: unknown) => void) => resolve({ data: null, error: { message: 'new row violates row-level security policy' } }));
      
      await expect(repo.deleteTreatmentPlan(validUuid, validPlanUuid)).rejects.toThrow('Failed to delete treatment plan in Supabase: new row violates row-level security policy');
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
