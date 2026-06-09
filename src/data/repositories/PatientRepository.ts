import { storage } from '../../utils/storage';
import type { Patient, Source, PatientIntegrationMeta } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PatientRepository {
  getPatientById(patientId: string): Promise<Patient | null>;
  updatePatient(patient: Patient): Promise<void>;
  listPatients(): Promise<Patient[]>;
  createPatient(patient: Patient): Promise<void>;
}

export type PatientRepositoryBackend = 'local' | 'supabase';

export interface CreatePatientRepositoryOptions {
  tenantId?: string | null;
  backend: PatientRepositoryBackend;
}

export const LocalStoragePatientRepository: PatientRepository = {
  async getPatientById(patientId: string): Promise<Patient | null> {
    const patients = storage.getPatients();
    const patient = patients.find((p) => p.id === patientId);
    return patient || null;
  },

  async updatePatient(patient: Patient): Promise<void> {
    storage.updatePatient(patient);
  },

  async listPatients(): Promise<Patient[]> {
    return storage.getPatients();
  },

  async createPatient(patient: Patient): Promise<void> {
    storage.addPatient(patient);
  },
};

export class SupabasePatientRepository implements PatientRepository {
  private readonly tenantId: string;
  private readonly client: SupabaseClient;

  constructor(tenantId: string, client: SupabaseClient) {
    this.tenantId = tenantId;
    this.client = client;
  }

  async getPatientById(patientId: string): Promise<Patient | null> {
    const { data, error } = await this.client
      .from('patients')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('id', patientId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return this.mapToPatient(data);
  }

  async updatePatient(patient: Patient): Promise<void> {
    const { error } = await this.client
      .from('patients')
      .update(this.mapToRow(patient))
      .eq('tenant_id', this.tenantId)
      .eq('id', patient.id);

    if (error) throw error;
  }

  async listPatients(): Promise<Patient[]> {
    const { data, error } = await this.client
      .from('patients')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToPatient);
  }

  async createPatient(patient: Patient): Promise<void> {
    const { error } = await this.client
      .from('patients')
      .insert({
        ...this.mapToRow(patient),
        tenant_id: this.tenantId
      });

    if (error) throw error;
  }

  private mapToPatient(row: Record<string, unknown>): Patient {
    return {
      id: row.id as string,
      fullName: row.full_name as string,
      phone: row.phone as string,
      birthDate: (row.birth_date as string) || undefined,
      source: row.source as Source,
      status: row.status as string,
      notes: (row.notes as string) || undefined,
      allergies: (row.allergies as string) || undefined,
      balance: (row.balance as number) || 0,
      bonusBalance: (row.bonus_balance as number) || 0,
      integration: (row.integration as PatientIntegrationMeta) || undefined,
      createdAt: row.created_at as string,
    };
  }

  private mapToRow(patient: Patient): Record<string, unknown> {
    return {
      id: patient.id,
      full_name: patient.fullName,
      phone: patient.phone,
      birth_date: patient.birthDate || null,
      source: patient.source,
      status: patient.status,
      notes: patient.notes || null,
      allergies: patient.allergies || null,
      balance: patient.balance || 0,
      bonus_balance: patient.bonusBalance || 0,
      integration: patient.integration || null,
    };
  }
}

export function createPatientRepository(options?: CreatePatientRepositoryOptions): PatientRepository {
  if (options?.backend === 'supabase' && typeof options.tenantId === 'string' && supabase) {
    return new SupabasePatientRepository(options.tenantId, supabase);
  }
  return LocalStoragePatientRepository;
}
