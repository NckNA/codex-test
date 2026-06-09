import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDoctorRepository, SupabaseDoctorRepository, LocalStorageDoctorRepository } from './DoctorRepository';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../utils/storage', () => ({
  storage: {
    getDoctors: vi.fn(() => [
      { id: 'd1', fullName: 'Dr. One', active: true },
      { id: 'd2', fullName: 'Dr. Two', active: false },
    ]),
  },
}));

describe('DoctorRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Factory createDoctorRepository', () => {
    it('returns LocalStorageDoctorRepository for backend local', () => {
      const repo = createDoctorRepository({ backend: 'local', tenantId: '123' });
      expect(repo).toBe(LocalStorageDoctorRepository);
    });

    it('returns SupabaseDoctorRepository for backend supabase with tenantId', () => {
      const repo = createDoctorRepository({ backend: 'supabase', tenantId: '123' });
      expect(repo).toBeInstanceOf(SupabaseDoctorRepository);
    });

    it('returns LocalStorageDoctorRepository for backend supabase without tenantId', () => {
      const repo = createDoctorRepository({ backend: 'supabase' });
      expect(repo).toBe(LocalStorageDoctorRepository);
    });
  });

  describe('SupabaseDoctorRepository', () => {
    const tenantId = 't1';
    let repo: SupabaseDoctorRepository;
    
    beforeEach(() => {
      repo = new SupabaseDoctorRepository(tenantId, supabase!);
    });

    it('listDoctors filters by tenant_id, orders by full_name and maps data', async () => {
      const mockEq = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          { id: 'u1', full_name: 'Supa Dr 1', active: true, specialization: null },
        ],
        error: null,
      });

      vi.mocked(supabase!.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: mockEq,
        order: mockOrder,
      } as never);

      const result = await repo.listDoctors();

      expect(supabase!.from).toHaveBeenCalledWith('doctors');
      expect(mockEq).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(mockOrder).toHaveBeenCalledWith('full_name', { ascending: true });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'u1',
        fullName: 'Supa Dr 1',
        active: true,
        specialization: '',
        cabinet: '',
        color: '',
      });
    });

    it('listActiveDoctors filters by tenant_id and active=true', async () => {
      const mockEq = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });

      vi.mocked(supabase!.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: mockEq,
        order: mockOrder,
      } as never);

      await repo.listActiveDoctors();

      expect(mockEq).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(mockEq).toHaveBeenCalledWith('active', true);
    });

    it('throws errors from Supabase', async () => {
      vi.mocked(supabase!.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      } as never);

      await expect(repo.listDoctors()).rejects.toThrow('DB error');
    });
  });

  describe('LocalStorageDoctorRepository', () => {
    it('listDoctors returns all doctors from storage', async () => {
      const result = await LocalStorageDoctorRepository.listDoctors();
      expect(result).toHaveLength(2);
    });

    it('listActiveDoctors returns only active doctors', async () => {
      const result = await LocalStorageDoctorRepository.listActiveDoctors();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('d1');
    });
  });
});
