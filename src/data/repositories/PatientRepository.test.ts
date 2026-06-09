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

  it('throws on error', async () => {
    const mockEqId = vi.fn().mockResolvedValue({ error: new Error('DB Update Error') });
    const mockEqTenant = vi.fn().mockReturnValue({ eq: mockEqId });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqTenant });
    const mockClient = { from: vi.fn().mockReturnValue({ update: mockUpdate }) } as unknown as SupabaseClient;
    const repo = new SupabasePatientRepository('t_1', mockClient);

    await expect(repo.updatePatient({ id: 'p1' } as Patient)).rejects.toThrow('DB Update Error');
  });
});
