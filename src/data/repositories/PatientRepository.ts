import { storage } from '../../utils/storage';
import type { Patient } from '../../types';

export interface PatientRepository {
  getPatientById(patientId: string): Promise<Patient | null>;
  updatePatient(patient: Patient): Promise<void>;
  listPatients(): Promise<Patient[]>;
  createPatient(patient: Patient): Promise<void>;
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
