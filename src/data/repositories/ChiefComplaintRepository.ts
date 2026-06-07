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
