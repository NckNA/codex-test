import { storage } from '../../utils/storage';
import type { TreatmentPlan } from '../../types';

export interface TreatmentPlansRepository {
  listTreatmentPlansByPatient(patientId: string): Promise<TreatmentPlan[]>;
  createTreatmentPlan(patientId: string, plan: TreatmentPlan): Promise<void>;
  updateTreatmentPlan(patientId: string, plan: TreatmentPlan): Promise<void>;
  deleteTreatmentPlan(patientId: string, planId: string): Promise<void>;
}

export const LocalStorageTreatmentPlansRepository: TreatmentPlansRepository = {
  async listTreatmentPlansByPatient(patientId: string): Promise<TreatmentPlan[]> {
    return storage.getTreatmentPlans(patientId);
  },

  async createTreatmentPlan(patientId: string, plan: TreatmentPlan): Promise<void> {
    storage.addTreatmentPlan(patientId, plan);
  },

  async updateTreatmentPlan(patientId: string, plan: TreatmentPlan): Promise<void> {
    storage.updateTreatmentPlan(patientId, plan);
  },

  async deleteTreatmentPlan(patientId: string, planId: string): Promise<void> {
    storage.deleteTreatmentPlan(patientId, planId);
  },
};
