import type { ChiefComplaint } from '../../types';
import { storage } from '../../utils/storage';

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

/**
 * Factory function to instantiate the ChiefComplaintRepository.
 * 
 * @param tenantId Accepted as a future boundary parameter for Supabase RLS.
 *                 Currently unused because the Supabase implementation is intentionally 
 *                 not included in this task.
 * @returns IChiefComplaintRepository
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createChiefComplaintRepository(_tenantId?: string): IChiefComplaintRepository {
  // localStorage remains the only active backend for this repository.
  return LocalStorageChiefComplaintRepository;
}

