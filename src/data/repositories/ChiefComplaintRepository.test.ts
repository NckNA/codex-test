import { describe, it, expect, vi } from 'vitest';
import { createChiefComplaintRepository, LocalStorageChiefComplaintRepository, SupabaseChiefComplaintRepository } from './ChiefComplaintRepository';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock supabase imported by the factory
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('ChiefComplaintRepository Factory', () => {
  it('returns LocalStorageChiefComplaintRepository for backend local', () => {
    const repo = createChiefComplaintRepository({ backend: 'local' });
    expect(repo).toBe(LocalStorageChiefComplaintRepository);
  });

  it('returns SupabaseChiefComplaintRepository for backend supabase with tenantId and configured supabase', () => {
    const repo = createChiefComplaintRepository({ backend: 'supabase', tenantId: '123' });
    expect(repo).toBeInstanceOf(SupabaseChiefComplaintRepository);
  });

  it('returns LocalStorageChiefComplaintRepository for backend supabase without tenantId', () => {
    const repo = createChiefComplaintRepository({ backend: 'supabase' });
    expect(repo).toBe(LocalStorageChiefComplaintRepository);
  });
});

describe('SupabaseChiefComplaintRepository', () => {
  it('getChiefComplaint maps Supabase row to frontend ChiefComplaint', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'c_1',
        patient_id: 'p_1',
        text: 'Pain',
        related_teeth: [11],
        created_at: '2023-01-01',
        updated_at: '2023-01-02'
      },
      error: null
    });
    const mockEqPatient = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqTenant = vi.fn().mockReturnValue({ eq: mockEqPatient });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqTenant });
    
    // We can inject a mock client into SupabaseChiefComplaintRepository
    const mockClient = {
      from: vi.fn().mockReturnValue({ select: mockSelect })
    } as unknown as SupabaseClient;

    const repo = new SupabaseChiefComplaintRepository('t_1', mockClient);
    
    const result = await repo.getChiefComplaint('p_1');
    
    expect(mockClient.from).toHaveBeenCalledWith('chief_complaints');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEqTenant).toHaveBeenCalledWith('tenant_id', 't_1');
    expect(mockEqPatient).toHaveBeenCalledWith('patient_id', 'p_1');
    
    expect(result).toEqual({
      id: 'c_1',
      patientId: 'p_1',
      text: 'Pain',
      relatedTeeth: [11],
      createdAt: '2023-01-01',
      updatedAt: '2023-01-02'
    });
  });

  it('getChiefComplaint returns null when maybeSingle returns no data', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqPatient = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqTenant = vi.fn().mockReturnValue({ eq: mockEqPatient });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqTenant });
    const mockClient = { from: vi.fn().mockReturnValue({ select: mockSelect }) } as unknown as SupabaseClient;

    const repo = new SupabaseChiefComplaintRepository('t_1', mockClient);
    const result = await repo.getChiefComplaint('p_1');
    
    expect(result).toBeNull();
  });

  it('getChiefComplaint throws on Supabase error', async () => {
    const mockError = new Error('DB Error');
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: mockError });
    const mockEqPatient = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqTenant = vi.fn().mockReturnValue({ eq: mockEqPatient });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqTenant });
    const mockClient = { from: vi.fn().mockReturnValue({ select: mockSelect }) } as unknown as SupabaseClient;

    const repo = new SupabaseChiefComplaintRepository('t_1', mockClient);
    
    await expect(repo.getChiefComplaint('p_1')).rejects.toThrow('DB Error');
  });

  it('saveChiefComplaint performs upsert with tenant_id, patient_id, text, related_teeth', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockClient = { from: vi.fn().mockReturnValue({ upsert: mockUpsert }) } as unknown as SupabaseClient;

    const repo = new SupabaseChiefComplaintRepository('t_1', mockClient);
    
    await repo.saveChiefComplaint('p_1', {
      text: 'New Pain',
      relatedTeeth: [12]
    });
    
    expect(mockClient.from).toHaveBeenCalledWith('chief_complaints');
    expect(mockUpsert).toHaveBeenCalledWith({
      tenant_id: 't_1',
      patient_id: 'p_1',
      text: 'New Pain',
      related_teeth: [12]
    }, {
      onConflict: 'tenant_id,patient_id'
    });
  });

  it('saveChiefComplaint throws on Supabase error', async () => {
    const mockError = new Error('Insert Error');
    const mockUpsert = vi.fn().mockResolvedValue({ error: mockError });
    const mockClient = { from: vi.fn().mockReturnValue({ upsert: mockUpsert }) } as unknown as SupabaseClient;

    const repo = new SupabaseChiefComplaintRepository('t_1', mockClient);
    
    await expect(repo.saveChiefComplaint('p_1', { text: 'New Pain', relatedTeeth: [] })).rejects.toThrow('Insert Error');
  });
});
