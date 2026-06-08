import { storage } from '../../utils/storage';
import type { DentalFinding } from '../../types';

export type CreateFindingInput = Omit<DentalFinding, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>;

export interface FindingsRepository {
  listFindingsByPatient(patientId: string): Promise<DentalFinding[]>;
  createFinding(patientId: string, finding: CreateFindingInput): Promise<void>;
  updateFinding(patientId: string, finding: DentalFinding): Promise<void>;
  deleteFinding(patientId: string, findingId: string): Promise<void>;
}

export const LocalStorageFindingsRepository: FindingsRepository = {
  async listFindingsByPatient(patientId: string): Promise<DentalFinding[]> {
    return storage.getFindings(patientId);
  },

  async createFinding(patientId: string, finding: CreateFindingInput): Promise<void> {
    storage.addFinding(patientId, finding);
  },

  async updateFinding(patientId: string, finding: DentalFinding): Promise<void> {
    storage.updateFinding(patientId, finding);
  },

  async deleteFinding(patientId: string, findingId: string): Promise<void> {
    storage.deleteFinding(patientId, findingId);
  },
};
