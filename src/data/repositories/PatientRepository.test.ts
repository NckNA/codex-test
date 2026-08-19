import { describe, it, expect, vi } from 'vitest';
import { createPatientRepository, LocalStoragePatientRepository, SupabasePatientRepository } from './PatientRepository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Patient } from '../../types';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('PatientRepository Factory', () => {
  it('returns LocalStoragePatientRepository for backend local', () => {
    const repo = createPatientRepository({ backend: 'local' });
    expect(repo).toBe(LocalStoragePatientRepository);
  });

  it('returns SupabasePatientRepository for backend supabase with tenantId', () => {
    const repo = createPatientRepository({ backend: 'supabase', tenantId: '123' });
    expect(repo).toBeInstanceOf(SupabasePatientRepository);
  });

  it('returns LocalStoragePatientRepository for backend supabase without tenantId', () => {
    const repo = createPatientRepository({ backend: 'supabase' });
    expect(repo).toBe(LocalStoragePatientRepository);
  });
});

describe('SupabasePatientRepository', () => {
  it('listPatients fetches and maps correctly', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{
        id: 'p1',
        full_name: 'John',
        phone: '123',
        status: 'active',
        source: 'phone',
        created_at: '2023'
      }],
      error: null
    });
    const mockEqTenant = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqTenant });
    const mockClient = { from: vi.fn().mockReturnValue({ select: mockSelect }) } as unknown as SupabaseClient;

    const repo = new SupabasePatientRepository('t_1', mockClient);
    const result = await repo.listPatients();
    
    expect(mockClient.from).toHaveBeenCalledWith('patients');
    expect(mockEqTenant).toHaveBeenCalledWith('tenant_id', 't_1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
    expect(result[0].fullName).toBe('John');
  });

  it('getPatientById fetches maybeSingle and maps', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'p1', full_name: 'John', phone: '123', source: 'walk_in', status: 'active', created_at: '2023' },
      error: null
    });
    const mockEqId = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqTenant = vi.fn().mockReturnValue({ eq: mockEqId });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqTenant });
    const mockClient = { from: vi.fn().mockReturnValue({ select: mockSelect }) } as unknown as SupabaseClient;

    const repo = new SupabasePatientRepository('t_1', mockClient);
    const result = await repo.getPatientById('p1');
    
    expect(mockEqId).toHaveBeenCalledWith('id', 'p1');
    expect(result?.id).toBe('p1');
    expect(result?.fullName).toBe('John');
  });

  it('getPatientById returns null if missing', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqId = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqTenant = vi.fn().mockReturnValue({ eq: mockEqId });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqTenant });
    const mockClient = { from: vi.fn().mockReturnValue({ select: mockSelect }) } as unknown as SupabaseClient;

    const repo = new SupabasePatientRepository('t_1', mockClient);
    const result = await repo.getPatientById('p1');
    expect(result).toBeNull();
  });

  it('createPatient inserts mapped row with tenant_id', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockClient = { from: vi.fn().mockReturnValue({ insert: mockInsert }) } as unknown as SupabaseClient;
    const repo = new SupabasePatientRepository('t_1', mockClient);

    await repo.createPatient({
      id: 'p1', fullName: 'John', phone: '123', source: 'walk_in', status: 'active', createdAt: '2023'
    });

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'p1',
      tenant_id: 't_1',
      full_name: 'John',
      phone: '123'
    }));
  });

  it('updatePatient updates mapped row with tenant_id filter', async () => {
    const mockEqId = vi.fn().mockResolvedValue({ error: null });
    const mockEqTenant = vi.fn().mockReturnValue({ eq: mockEqId });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqTenant });
    const mockClient = { from: vi.fn().mockReturnValue({ update: mockUpdate }) } as unknown as SupabaseClient;
    const repo = new SupabasePatientRepository('t_1', mockClient);

    await repo.updatePatient({
      id: 'p1', fullName: 'John', phone: '123', source: 'walk_in', status: 'active', createdAt: '2023'
    });

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'John'
    }));
    expect(mockEqTenant).toHaveBeenCalledWith('tenant_id', 't_1');
    expect(mockEqId).toHaveBeenCalledWith('id', 'p1');
  });

  it('searchPatientLookup uses a bounded tenant-scoped minimal name query and escapes LIKE wildcards', async () => {
    const mockLimit = vi.fn().mockResolvedValue({
      data: [{ id: 'p1', full_name: 'Ana% Test', phone: '+77001', status: 'active' }],
      error: null,
    });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockIlike = vi.fn().mockReturnValue({ order: mockOrder });
    const mockNeq = vi.fn().mockReturnValue({ ilike: mockIlike });
    const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockClient = { from: vi.fn().mockReturnValue({ select: mockSelect }) } as unknown as SupabaseClient;
    const repo = new SupabasePatientRepository('tenant-a', mockClient);

    const result = await repo.searchPatientLookup({ query: '  Ana%_  ', limit: 999 });

    expect(mockClient.from).toHaveBeenCalledWith('patients');
    expect(mockSelect).toHaveBeenCalledWith('id,full_name,phone,status');
    expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(mockNeq).toHaveBeenCalledWith('status', 'archived');
    expect(mockIlike).toHaveBeenCalledWith('full_name', '%Ana\\%\\_%');
    expect(mockOrder).toHaveBeenCalledWith('full_name', { ascending: true });
    expect(mockLimit).toHaveBeenCalledWith(20);
    expect(result).toEqual([{ id: 'p1', fullName: 'Ana% Test', phone: '+77001', status: 'active' }]);
  });

  it('searchPatientLookup normalizes phone-like input and never uses a raw or-filter string', async () => {
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockIlike = vi.fn().mockReturnValue({ order: mockOrder });
    const mockNeq = vi.fn().mockReturnValue({ ilike: mockIlike });
    const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const from = vi.fn().mockReturnValue({ select: mockSelect });
    const repo = new SupabasePatientRepository('tenant-a', { from } as unknown as SupabaseClient);

    await repo.searchPatientLookup({ query: '+7 (700) 12-34', limit: 5 });

    expect(mockIlike).toHaveBeenCalledWith('phone', '%+77001234%');
    expect(mockLimit).toHaveBeenCalledWith(5);
  });

  it('searchPatientLookup does not touch Supabase for a short query', async () => {
    const from = vi.fn();
    const repo = new SupabasePatientRepository('tenant-a', { from } as unknown as SupabaseClient);
    await expect(repo.searchPatientLookup({ query: ' a ' })).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('searchPatientLookup propagates Supabase failures', async () => {
    const mockLimit = vi.fn().mockResolvedValue({ data: null, error: new Error('lookup failed') });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockIlike = vi.fn().mockReturnValue({ order: mockOrder });
    const mockNeq = vi.fn().mockReturnValue({ ilike: mockIlike });
    const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const repo = new SupabasePatientRepository('tenant-a', { from: vi.fn().mockReturnValue({ select: mockSelect }) } as unknown as SupabaseClient);
    await expect(repo.searchPatientLookup({ query: 'Alice' })).rejects.toThrow('lookup failed');
  });

  it('throws on error', async () => {
    const mockEqId = vi.fn().mockResolvedValue({ error: new Error('DB Update Error') });
    const mockEqTenant = vi.fn().mockReturnValue({ eq: mockEqId });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqTenant });
    const mockClient = { from: vi.fn().mockReturnValue({ update: mockUpdate }) } as unknown as SupabaseClient;
    const repo = new SupabasePatientRepository('t_1', mockClient);

    await expect(repo.updatePatient({ id: 'p1' } as Patient)).rejects.toThrow('DB Update Error');
  });
});
