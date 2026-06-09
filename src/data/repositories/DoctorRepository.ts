import type { Doctor } from '../../types';
import { storage } from '../../utils/storage';
import { supabase } from '../../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface IDoctorRepository {
  listDoctors(): Promise<Doctor[]>;
  listActiveDoctors(): Promise<Doctor[]>;
}

export const LocalStorageDoctorRepository: IDoctorRepository = {
  listDoctors: async (): Promise<Doctor[]> => {
    return Promise.resolve(storage.getDoctors());
  },
  
  listActiveDoctors: async (): Promise<Doctor[]> => {
    const allDoctors = storage.getDoctors();
    return Promise.resolve(allDoctors.filter(d => d.active));
  }
};

export class SupabaseDoctorRepository implements IDoctorRepository {
  tenantId: string;
  client: SupabaseClient;

  constructor(tenantId: string, client: SupabaseClient) {
    this.tenantId = tenantId;
    this.client = client;
  }

  async listDoctors(): Promise<Doctor[]> {
    const { data, error } = await this.client
      .from('doctors')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .order('full_name', { ascending: true });

    if (error) throw error;
    return (data || []).map(row => this.mapToDoctor(row));
  }

  async listActiveDoctors(): Promise<Doctor[]> {
    const { data, error } = await this.client
      .from('doctors')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('active', true)
      .order('full_name', { ascending: true });

    if (error) throw error;
    return (data || []).map(row => this.mapToDoctor(row));
  }

  private mapToDoctor(row: Record<string, unknown>): Doctor {
    return {
      id: row.id as string,
      fullName: row.full_name as string,
      specialization: (row.specialization as string) || '',
      cabinet: (row.cabinet as string) || '',
      color: (row.color as string) || '',
      active: row.active === undefined || row.active === null ? true : (row.active as boolean),
    };
  }
}

export type DoctorRepositoryBackend = 'local' | 'supabase';

export interface CreateDoctorRepositoryOptions {
  tenantId?: string | null;
  backend: DoctorRepositoryBackend;
}

export function createDoctorRepository(options?: CreateDoctorRepositoryOptions): IDoctorRepository {
  if (options?.backend === 'supabase' && typeof options.tenantId === 'string' && supabase) {
    return new SupabaseDoctorRepository(options.tenantId, supabase);
  }
  return LocalStorageDoctorRepository;
}
