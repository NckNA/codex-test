import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  createAppointmentRepository, 
  SupabaseAppointmentRepository, 
  LocalStorageAppointmentRepository 
} from './AppointmentRepository';
import { supabase } from '../../lib/supabaseClient';
import type { Appointment } from '../../types';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('AppointmentRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Factory', () => {
    it('returns LocalStorageAppointmentRepository when backend is local', () => {
      const repo = createAppointmentRepository({ backend: 'local' });
      expect(repo).toBe(LocalStorageAppointmentRepository);
    });

    it('returns LocalStorageAppointmentRepository when backend is supabase but no tenantId', () => {
      const repo = createAppointmentRepository({ backend: 'supabase', tenantId: null });
      expect(repo).toBe(LocalStorageAppointmentRepository);
    });

    it('returns SupabaseAppointmentRepository when backend is supabase with tenantId', () => {
      const repo = createAppointmentRepository({ backend: 'supabase', tenantId: 't1' });
      expect(repo).toBeInstanceOf(SupabaseAppointmentRepository);
    });
  });

  describe('SupabaseAppointmentRepository', () => {
    const tenantId = 'test-tenant';
    const client = supabase as unknown as SupabaseClient;
    const repo = new SupabaseAppointmentRepository(tenantId, client);
    
    const mockSelect = vi.fn();
    const mockEq = vi.fn();
    const mockOrder = vi.fn();
    const mockInsert = vi.fn();
    const mockUpdate = vi.fn();
    const mockDelete = vi.fn();

    beforeEach(() => {
      vi.mocked(client.from).mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ eq: mockEq, order: mockOrder, maybeSingle: vi.fn() });
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockInsert.mockResolvedValue({ error: null });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockDelete.mockReturnValue({ eq: mockEq });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockEq.mockImplementation((...args: any[]) => {
        void args;
        const chain = { eq: mockEq, order: mockOrder };
        return Object.assign(Promise.resolve({ error: null }), chain);
      });
    });

    it('listAppointments filters by tenant_id and orders asc', async () => {
      await repo.listAppointments();
      expect(client.from).toHaveBeenCalledWith('appointments');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(mockOrder).toHaveBeenCalledWith('start_time', { ascending: true });
    });

    it('listAppointmentsByPatient filters by tenant_id and patient_id and orders desc', async () => {
      await repo.listAppointmentsByPatient('p1');
      expect(client.from).toHaveBeenCalledWith('appointments');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(mockEq).toHaveBeenCalledWith('patient_id', 'p1');
      expect(mockOrder).toHaveBeenCalledWith('start_time', { ascending: false });
    });

    it('createAppointment inserts tenant_id and generates UUID if missing', async () => {
      const appt: Appointment = {
        id: 'a123',
        doctorId: 'd1',
        patientId: '',
        cabinet: '1',
        service: 'test',
        status: 'new',
        start: '2023-01-01T10:00',
        end: '2023-01-01T11:00',
        createdAt: '2023-01-01T09:00',
      };
      
      await repo.createAppointment(appt);
      expect(mockInsert).toHaveBeenCalled();
      const insertArg = mockInsert.mock.calls[0][0];
      
      expect(insertArg.tenant_id).toBe(tenantId);
      expect(insertArg.id).not.toBe('a123');
      expect(insertArg.id.length).toBe(36);
      expect(insertArg.patient_id).toBeNull();
      expect(insertArg.payment_type).toBeNull();
      expect(insertArg.start_time).toBe('2023-01-01T10:00:00Z');
    });

    it('updateAppointment updates by tenant_id and id', async () => {
      const appt: Appointment = {
        id: 'uuid-123',
        doctorId: 'd1',
        cabinet: '1',
        service: 'test',
        status: 'new',
        start: '2023-01-01T10:00',
        end: '2023-01-01T11:00',
        createdAt: '2023-01-01T09:00',
      };
      
      await repo.updateAppointment(appt);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(mockEq).toHaveBeenCalledWith('id', 'uuid-123');
    });

    it('deleteAppointment deletes by tenant_id and id', async () => {
      await repo.deleteAppointment('uuid-123');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(mockEq).toHaveBeenCalledWith('id', 'uuid-123');
    });

    it('throws Supabase errors', async () => {
      mockInsert.mockResolvedValueOnce({ error: new Error('DB Error') });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(repo.createAppointment({} as any)).rejects.toThrow('DB Error');
    });
  });
});
