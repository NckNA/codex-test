import type { ChiefComplaint } from '../../types';
import { storage } from '../../utils/storage';
import { supabase } from '../../lib/supabaseClient';
import { SupabaseClient } from '@supabase/supabase-js';

export interface IChiefComplaintRepository {
  getChiefComplaint(patientId: string): Promise<ChiefComplaint | null>;
  saveChiefComplaint(
    patientId: string,
    complaint: Omit<ChiefComplaint, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>
  ): Promise<void>;
}

export const LocalStorageChiefComplaintRepository: IChiefComplaintRepository = {
  getChiefComplaint: async (patientId: string): Promise<ChiefComplaint | null> => {
    return Promise.resolve(storage.getChiefComplaint(patientId));
  },
  
  saveChiefComplaint: async (
    patientId: string,
    complaint: Omit<ChiefComplaint, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>
  ): Promise<void> => {
    storage.saveChiefComplaint(patientId, complaint);
    return Promise.resolve();
  }
};

export class SupabaseChiefComplaintRepository implements IChiefComplaintRepository {
  private readonly tenantId: string;
  private readonly client: SupabaseClient;

  constructor(tenantId: string, client: SupabaseClient) {
    this.tenantId = tenantId;
    this.client = client;
  }

  async getChiefComplaint(patientId: string): Promise<ChiefComplaint | null> {
    const { data, error } = await this.client
      .from('chief_complaints')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('patient_id', patientId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      patientId: data.patient_id,
      text: data.text,
      relatedTeeth: data.related_teeth || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async saveChiefComplaint(
    patientId: string,
    complaint: Omit<ChiefComplaint, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    const { error } = await this.client
      .from('chief_complaints')
      .upsert({
        tenant_id: this.tenantId,
        patient_id: patientId,
        text: complaint.text,
        related_teeth: complaint.relatedTeeth ?? [],
      }, {
        onConflict: 'tenant_id,patient_id'
      });

    if (error) {
      throw error;
    }
  }
}

export type ChiefComplaintRepositoryBackend = 'local' | 'supabase';

export interface CreateChiefComplaintRepositoryOptions {
  tenantId?: string | null;
  backend: ChiefComplaintRepositoryBackend;
}

/**
 * Factory function to instantiate the ChiefComplaintRepository.
 */
export function createChiefComplaintRepository(options: CreateChiefComplaintRepositoryOptions): IChiefComplaintRepository {
  if (options.backend === 'supabase' && options.tenantId && supabase) {
    return new SupabaseChiefComplaintRepository(options.tenantId, supabase);
  }

  // Safe fallback to localStorage if explicitly requested, or if Supabase/tenantId are missing
  return LocalStorageChiefComplaintRepository;
}

