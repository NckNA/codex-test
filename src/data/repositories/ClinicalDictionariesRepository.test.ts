
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
  },
}));

describe('ClinicalDictionariesRepository', () => {
  const tenantId = 'test-tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('A. Local behavior (legacy facade)', () => {
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

    it('reads and writes to localStorage', () => {
      const dx = [...defaultDiagnoses];
      dx[0] = { ...dx[0], name: 'Updated Dx' };
      
      ClinicalDictionariesRepository.saveDiagnoses(dx);
      expect(ClinicalDictionariesRepository.getDiagnoses()[0].name).toBe('Updated Dx');

      const wx = [...defaultClinicalWorks];
      wx[0] = { ...wx[0], name: 'Updated Work' };
      
      ClinicalDictionariesRepository.saveWorks(wx);
      expect(ClinicalDictionariesRepository.getWorks()[0].name).toBe('Updated Work');
    });
  });

  describe('B. Supabase read mapping', () => {
    let repo: SupabaseClinicalDictionariesRepository;

    beforeEach(() => {
      repo = new SupabaseClinicalDictionariesRepository(tenantId);
    });

    it('maps diagnosis row to domain correctly', async () => {
      const mockRow = {
        id: 'dx_1',
        name: 'Test Dx',
        description: 'Test Desc',
        allowed_presence_statuses: ['natural'],
        allowed_zones: ['crown'],
        visual_priority: 10,
        is_active: false,
      };

      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const orderMock = vi.fn().mockReturnThis();
      const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> };
      mockSupabase.from.mockReturnValue({
        select: selectMock,
        eq: eqMock,
        order: orderMock,
        then: (cb: (res: { data: unknown[]; error: Error | null }) => void) => cb({ data: [mockRow], error: null }),
      } as unknown);

      const result = await repo.getDiagnoses();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'dx_1',
        name: 'Test Dx',
        description: 'Test Desc',
        allowedPresenceStatuses: ['natural'],
        allowedZones: ['crown'],
        visualPriority: 10,
        isActive: false,
      });
    });

    it('handles null/missing array fields gracefully for diagnosis', async () => {
      const mockRow = {
        id: 'dx_2',
        name: 'Test Dx 2',
        allowed_presence_statuses: null,
        allowed_zones: null,
        is_active: null,
      };

      const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (cb: (res: { data: unknown[]; error: Error | null }) => void) => cb({ data: [mockRow], error: null }),
      } as unknown);

      const result = await repo.getDiagnoses();
      expect(result[0].allowedPresenceStatuses).toEqual([]);
      expect(result[0].allowedZones).toEqual([]);
      expect(result[0].isActive).toBe(true); // default true
    });

    it('maps work row to domain correctly', async () => {
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
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'work_1',
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

    it('handles null/missing array fields and price gracefully for work', async () => {
      const mockRow = {
        id: 'work_2',
        name: 'Test Work 2',
        work_access_type: 'base_available',
        price: null,
      };

      const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (cb: (res: { data: unknown[]; error: Error | null }) => void) => cb({ data: [mockRow], error: null }),
      } as unknown);

      const result = await repo.getWorks();
      expect(result[0].allowedPresenceStatuses).toEqual([]);
      expect(result[0].allowedZones).toEqual([]);
      expect(result[0].allowedDiagnosisIds).toEqual([]);
      expect(result[0].price).toBeUndefined();
      expect(result[0].isActive).toBe(true); // default true
    });
  });

  describe('C. Supabase query safety', () => {
    it('throws if no tenantId provided', () => {
      expect(() => new SupabaseClinicalDictionariesRepository(undefined)).toThrowError(
        'SupabaseClinicalDictionariesRepository requires a tenantId'
      );
      expect(() => new SupabaseClinicalDictionariesRepository('')).toThrowError(
        'SupabaseClinicalDictionariesRepository requires a tenantId'
      );
    });

    it('filters diagnoses by tenant_id and type', async () => {
      const repo = new SupabaseClinicalDictionariesRepository(tenantId);
      const eqMock = vi.fn().mockReturnThis();
      const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        order: vi.fn().mockReturnThis(),
        then: (cb: (res: { data: unknown[]; error: Error | null }) => void) => cb({ data: [], error: null }),
      } as unknown);

      await repo.getDiagnoses();
      expect(mockSupabase.from).toHaveBeenCalledWith('clinical_dictionary_items');
      expect(eqMock).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(eqMock).toHaveBeenCalledWith('type', 'diagnosis');
    });

    it('filters works by tenant_id and type', async () => {
      const repo = new SupabaseClinicalDictionariesRepository(tenantId);
      const eqMock = vi.fn().mockReturnThis();
      const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        order: vi.fn().mockReturnThis(),
        then: (cb: (res: { data: unknown[]; error: Error | null }) => void) => cb({ data: [], error: null }),
      } as unknown);

      await repo.getWorks();
      expect(mockSupabase.from).toHaveBeenCalledWith('clinical_dictionary_items');
      expect(eqMock).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(eqMock).toHaveBeenCalledWith('type', 'work');
    });

    it('throws Supabase errors, does not swallow them', async () => {
      const repo = new SupabaseClinicalDictionariesRepository(tenantId);
      const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (cb: (res: { data: null; error: Error | null }) => void) => cb({ data: null, error: new Error('DB Error') }),
      } as unknown);

      await expect(repo.getDiagnoses()).rejects.toThrow('DB Error');
    });
  });

  describe('D. Supabase save mapping', () => {
    let repo: SupabaseClinicalDictionariesRepository;
    let upsertMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      repo = new SupabaseClinicalDictionariesRepository(tenantId);
      upsertMock = vi.fn().mockReturnValue({ error: null });
      const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> };
      mockSupabase.from.mockReturnValue({
        upsert: upsertMock,
      } as unknown);
    });

    it('saves diagnosis correctly', async () => {
      const dx = {
        id: 'dx_1',
        name: 'New Dx',
        allowedPresenceStatuses: ['natural'],
        allowedZones: ['crown'],
      } as unknown as import('../../config/clinicalDictionaries').ClinicalDiagnosis;

      await repo.saveDiagnosis(dx);

      expect(upsertMock).toHaveBeenCalledWith(
        {
          tenant_id: tenantId,
          id: 'dx_1',
          type: 'diagnosis',
          name: 'New Dx',
          description: null,
          allowed_presence_statuses: ['natural'],
          allowed_zones: ['crown'],
          work_access_type: null,
          allowed_diagnosis_ids: [],
          price: null,
          visual_priority: null,
          is_active: true,
        },
        { onConflict: 'tenant_id,id' }
      );
    });

    it('saves work correctly', async () => {
      const work = {
        id: 'work_1',
        name: 'New Work',
        allowedPresenceStatuses: ['natural'],
        allowedZones: ['crown'],
        workAccessType: 'requires_diagnosis',
        allowedDiagnosisIds: ['dx_1'],
        price: 150,
        isActive: false,
      } as unknown as import('../../config/clinicalDictionaries').ClinicalWork;

      await repo.saveWork(work);

      expect(upsertMock).toHaveBeenCalledWith(
        {
          tenant_id: tenantId,
          id: 'work_1',
          type: 'work',
          name: 'New Work',
          description: null,
          allowed_presence_statuses: ['natural'],
          allowed_zones: ['crown'],
          work_access_type: 'requires_diagnosis',
          allowed_diagnosis_ids: ['dx_1'],
          price: 150,
          visual_priority: null,
          is_active: false,
        },
        { onConflict: 'tenant_id,id' }
      );
    });

    it('throws errors on save', async () => {
      upsertMock.mockReturnValue({ error: new Error('Save failed') });
      await expect(repo.saveDiagnosis({} as unknown as import('../../config/clinicalDictionaries').ClinicalDiagnosis)).rejects.toThrow('Save failed');
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
