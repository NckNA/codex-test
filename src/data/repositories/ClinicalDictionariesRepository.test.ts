// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
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

  it('keeps local defaults available without touching Supabase', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const repo = new LocalStorageClinicalDictionariesRepository();

    expect(await repo.getDiagnoses()).toEqual(defaultDiagnoses);
    expect(await repo.getWorks()).toEqual(defaultClinicalWorks);
    expect(setItemSpy).toHaveBeenCalledWith('codex_clinical_diagnoses', expect.any(String));
    expect(setItemSpy).toHaveBeenCalledWith('codex_clinical_works', expect.any(String));
  });

  it('explicit local bootstrap is idempotent and preserves existing defaults', async () => {
    const repo = new LocalStorageClinicalDictionariesRepository();

    const first = await repo.bootstrapFromTemplate();
    const second = await repo.bootstrapFromTemplate();

    expect(first.insertedCount).toBe(0);
    expect(first.skippedExistingCount).toBe(defaultDiagnoses.length + defaultClinicalWorks.length);
    expect(second.insertedCount).toBe(0);
    expect(second.skippedExistingCount).toBe(defaultDiagnoses.length + defaultClinicalWorks.length);
  });

  it('requires tenant id for Supabase repository', () => {
    expect(() => new SupabaseClinicalDictionariesRepository(undefined)).toThrowError(
      'SupabaseClinicalDictionariesRepository requires a tenantId'
    );
  });

  it('loads Supabase dictionaries by tenant and type without auto-bootstrap', async () => {
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

  it('maps Supabase work rows and surfaces read errors', async () => {
    const repo = new SupabaseClinicalDictionariesRepository(tenantId);
    const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> };

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (cb: (res: { data: unknown[]; error: Error | null }) => void) => cb({
        data: [{
          id: 'work_1',
          name: 'Test Work',
          allowed_presence_statuses: ['natural'],
          allowed_zones: ['crown'],
          work_access_type: 'requires_diagnosis',
          allowed_diagnosis_ids: ['dx_1'],
          price: '150.50',
          is_active: true,
        }],
        error: null,
      }),
    } as unknown);

    const works = await repo.getWorks();
    expect(works[0]).toMatchObject({
      id: 'work_1',
      type: 'work',
      price: 150.5,
      allowedDiagnosisIds: ['dx_1'],
    });

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (cb: (res: { data: null; error: Error | null }) => void) => cb({ data: null, error: new Error('DB Error') }),
    } as unknown);

    await expect(repo.getDiagnoses()).rejects.toThrow('DB Error');
  });

  it('saves diagnosis and work with tenant-scoped upserts', async () => {
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

    await repo.saveWork({
      id: 'work_1',
      type: 'work',
      name: 'New Work',
      allowedPresenceStatuses: ['natural'],
      allowedZones: ['crown'],
      workAccessType: 'requires_diagnosis',
      allowedDiagnosisIds: ['dx_1'],
      price: 150,
    });

    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: tenantId, id: 'dx_1', type: 'diagnosis', price: null }), { onConflict: 'tenant_id,id' });
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: tenantId, id: 'work_1', type: 'work', price: 150 }), { onConflict: 'tenant_id,id' });
  });

  it('calls bootstrap RPC once and maps result', async () => {
    const repo = new SupabaseClinicalDictionariesRepository(tenantId);
    const mockSupabase = supabase as unknown as { rpc: ReturnType<typeof vi.fn> };

    mockSupabase.rpc.mockResolvedValue({ data: { inserted_count: 43, skipped_existing_count: 0, template_key: 'default_dental_v1', tenant_id: tenantId }, error: null });

    const result = await repo.bootstrapFromTemplate();

    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('bootstrap_clinical_dictionary_from_template', { target_tenant_id: tenantId, template_key: 'default_dental_v1' });
    expect(result).toEqual({ insertedCount: 43, skippedExistingCount: 0, templateKey: 'default_dental_v1', tenantId });
  });

  it('surfaces bootstrap RPC errors', async () => {
    const repo = new SupabaseClinicalDictionariesRepository(tenantId);
    const mockSupabase = supabase as unknown as { rpc: ReturnType<typeof vi.fn> };
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('not allowed') });

    await expect(repo.bootstrapFromTemplate()).rejects.toThrow('not allowed');
  });

  it('factory returns configured repository implementations', () => {
    expect(createClinicalDictionariesRepository({ backend: 'local' })).toBeInstanceOf(LocalStorageClinicalDictionariesRepository);
    expect(createClinicalDictionariesRepository({ backend: 'supabase', tenantId })).toBeInstanceOf(SupabaseClinicalDictionariesRepository);
    expect(() => createClinicalDictionariesRepository({ backend: 'supabase' })).toThrow();
  });
});
