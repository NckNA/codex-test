// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ClinicalDictionariesRepository,
  LocalStorageClinicalDictionariesRepository,
  SupabaseClinicalDictionariesRepository,
  createClinicalDictionariesRepository,
} from './ClinicalDictionariesRepository';
import { supabase } from '../../lib/supabaseClient';
import { defaultDiagnoses, defaultClinicalWorks } from '../../config/clinicalDictionaries';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('ClinicalDictionariesRepository', () => {
  const tenantId = 'test-tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('A. Local behavior', () => {
    it('returns defaults if localStorage is missing and auto-saves them', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      const diagnoses = ClinicalDictionariesRepository.getDiagnoses();
      expect(diagnoses).toEqual(defaultDiagnoses);
      expect(setItemSpy).toHaveBeenCalledWith('codex_clinical_diagnoses', expect.any(String));

      const works = ClinicalDictionariesRepository.getWorks();
      expect(works).toEqual(defaultClinicalWorks);
      expect(setItemSpy).toHaveBeenCalledWith('codex_clinical_works', expect.any(String));
    });

    it('returns defaults if localStorage parse fails', () => {
      localStorage.setItem('codex_clinical_diagnoses', 'invalid-json');
      localStorage.setItem('codex_clinical_works', 'invalid-json');

      expect(ClinicalDictionariesRepository.getDiagnoses()).toEqual(defaultDiagnoses);
      expect(ClinicalDictionariesRepository.getWorks()).toEqual(defaultClinicalWorks);
    });

    it('explicitly imports missing local defaults without overwriting existing custom items', async () => {
      const repo = new LocalStorageClinicalDictionariesRepository();
      await repo.saveDiagnosis({ ...defaultDiagnoses[0], name: 'Custom diagnosis name' });
      await repo.saveWork({ ...defaultClinicalWorks[0], name: 'Custom work name' });

      const result = await repo.bootstrapFromTemplate();

      expect(result.insertedCount).toBe(defaultDiagnoses.length + defaultClinicalWorks.length - 2);
      expect(result.skippedExistingCount).toBe(2);
      expect((await repo.getDiagnoses()).find((item) => item.id === defaultDiagnoses[0].id)?.name).toBe('Custom diagnosis name');
      expect((await repo.getWorks()).find((item) => item.id === defaultClinicalWorks[0].id)?.name).toBe('Custom work name');
    });
  });

  describe('B. Supabase read mapping', () => {
    it('maps diagnosis row to domain correctly', async () => {
      const repo = new SupabaseClinicalDictionariesRepository(tenantId);
      const mockRow = {
        id: 'dx_1',
        name: 'Test Dx',
        description: 'Test Desc',
        allowed_presence_statuses: ['natural'],
        allowed_zones: ['crown'],
        visual_priority: 10,
        is_active: false,
      };

      const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (cb: (res: { data: unknown[]; error: Error | null }) => void) => cb({ data: [mockRow], error: null }),
      } as unknown);

      const result = await repo.getDiagnoses();

      expect(result).toEqual([{
        id: 'dx_1',
        type: 'diagnosis',
        name: 'Test Dx',
        description: 'Test Desc',
        allowedPresenceStatuses: ['natural'],
        allowedZones: ['crown'],
        visualPriority: 10,
        isActive: false,
      }]);
    });

    it('maps work row to domain correctly', async () => {
      const repo = new SupabaseClinicalDictionariesRepository(tenantId);
      const mockRow = {
        id: 'work_1',
        name: 'Test Work',
        description: 'Test Desc',
        allowed_presence_statuses: ['natural'],
        allowed_zones: ['crown'],
        work_access_type: 'requires_diagnosis',
        allowed_diagnosis_ids: ['dx_1'],
        price: '150.50',
        is_active: true,
      };

      const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (cb: (res: { data: unknown[]; error: Error | null }) => void) => cb({ data: [mockRow], error: null }),
      } as unknown);

      const result = await repo.getWorks();

      expect(result[0]).toEqual({
        id: 'work_1',
        type: 'work',
        name: 'Test Work',
        description: 'Test Desc',
        allowedPresenceStatuses: ['natural'],
        allowedZones: ['crown'],
        workAccessType: 'requires_diagnosis',
        allowedDiagnosisIds: ['dx_1'],
        price: 150.5,
        isActive: true,
      });
    });

    it('filters diagnoses and works by tenant_id and type without auto-bootstrap', async () => {
      const repo = new SupabaseClinicalDictionariesRepository(tenantId);
      const eqMock = vi.fn().mockReturnThis();
      const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn>, rpc: ReturnType<typeof vi.fn> };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        order: vi.fn().mockReturnThis(),
        then: (cb: (res: { data: unknown[]; error: Error | null }) => void) => cb({ data: [], error: null }),
      } as unknown);

      await repo.getDiagnoses();
      await repo.getWorks();

      expect(mockSupabase.from).toHaveBeenCalledWith('clinical_dictionary_items');
      expect(eqMock).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(eqMock).toHaveBeenCalledWith('type', 'diagnosis');
      expect(eqMock).toHaveBeenCalledWith('type', 'work');
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('C. Supabase save mapping', () => {
    it('throws if no tenantId provided', () => {
      expect(() => new SupabaseClinicalDictionariesRepository(undefined)).toThrowError(
        'SupabaseClinicalDictionariesRepository requires a tenantId'
      );
      expect(() => new SupabaseClinicalDictionariesRepository('')).toThrowError(
        'SupabaseClinicalDictionariesRepository requires a tenantId'
      );
    });

    it('saves diagnosis correctly', async () => {
      const repo = new SupabaseClinicalDictionariesRepository(tenantId);
      const upsertMock = vi.fn().mockReturnValue({ error: null });
      const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> };
      mockSupabase.from.mockReturnValue({ upsert: upsertMock } as unknown);

      await repo.saveDiagnosis({
        id: 'dx_1',
        type: 'diagnosis',
        name: 'New Dx',
        allowedPresenceStatuses: ['natural'],
        allowedZones: ['crown'],
      });

      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: tenantId,
          id: 'dx_1',
          type: 'diagnosis',
          name: 'New Dx',
          work_access_type: null,
          allowed_diagnosis_ids: [],
          price: null,
        }),
        { onConflict: 'tenant_id,id' }
      );
    });

    it('saves work correctly', async () => {
      const repo = new SupabaseClinicalDictionariesRepository(tenantId);
      const upsertMock = vi.fn().mockReturnValue({ error: null });
      const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> };
      mockSupabase.from.mockReturnValue({ upsert: upsertMock } as unknown);

      await repo.saveWork({
        id: 'work_1',
        type: 'work',
        name: 'New Work',
        allowedPresenceStatuses: ['natural'],
        allowedZones: ['crown'],
        workAccessType: 'requires_diagnosis',
        allowedDiagnosisIds: ['dx_1'],
        price: 150,
        isActive: false,
      });

      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: tenantId,
          id: 'work_1',
          type: 'work',
          name: 'New Work',
          work_access_type: 'requires_diagnosis',
          allowed_diagnosis_ids: ['dx_1'],
          price: 150,
          is_active: false,
        }),
        { onConflict: 'tenant_id,id' }
      );
    });
  });

  describe('D. Supabase bootstrap RPC', () => {
    it('calls bootstrap RPC once with active tenant id and template key', async () => {
      const repo = new SupabaseClinicalDictionariesRepository(tenantId);
      const mockSupabase = supabase as unknown as { rpc: ReturnType<typeof vi.fn> };
      mockSupabase.rpc.mockResolvedValue({
        data: {
          inserted_count: 43,
          skipped_existing_count: 0,
          template_key: 'default_dental_v1',
          tenant_id: tenantId,
        },
        error: null,
      });

      const result = await repo.bootstrapFromTemplate();

      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('bootstrap_clinical_dictionary_from_template', {
        target_tenant_id: tenantId,
        template_key: 'default_dental_v1',
      });
      expect(result).toEqual({
        insertedCount: 43,
        skippedExistingCount: 0,
        templateKey: 'default_dental_v1',
        tenantId,
      });
    });

    it('passes custom template key to bootstrap RPC', async () => {
      const repo = new SupabaseClinicalDictionariesRepository(tenantId);
      const mockSupabase = supabase as unknown as { rpc: ReturnType<typeof vi.fn> };
      mockSupabase.rpc.mockResolvedValue({
        data: { inserted_count: 0, skipped_existing_count: 43, template_key: 'custom_v1' },
        error: null,
      });

      await repo.bootstrapFromTemplate('custom_v1');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('bootstrap_clinical_dictionary_from_template', {
        target_tenant_id: tenantId,
        template_key: 'custom_v1',
      });
    });

    it('surfaces bootstrap RPC errors', async () => {
      const repo = new SupabaseClinicalDictionariesRepository(tenantId);
      const mockSupabase = supabase as unknown as { rpc: ReturnType<typeof vi.fn> };
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('not allowed') });

      await expect(repo.bootstrapFromTemplate()).rejects.toThrow('not allowed');
    });
  });

  describe('E. Factory', () => {
    it('returns LocalStorage repo for backend = local', () => {
      const repo = createClinicalDictionariesRepository({ backend: 'local' });
      expect(repo).toBeInstanceOf(LocalStorageClinicalDictionariesRepository);
    });

    it('returns Supabase repo for backend = supabase with tenantId', () => {
      const repo = createClinicalDictionariesRepository({ backend: 'supabase', tenantId });
      expect(repo).toBeInstanceOf(SupabaseClinicalDictionariesRepository);
    });

    it('throws if backend = supabase without tenantId', () => {
      expect(() => createClinicalDictionariesRepository({ backend: 'supabase' })).toThrow();
    });

    it('throws if unrecognized backend', () => {
      // @ts-expect-error Intentionally invalid backend
      expect(() => createClinicalDictionariesRepository({ backend: 'invalid' })).toThrow();
    });
  });
});
