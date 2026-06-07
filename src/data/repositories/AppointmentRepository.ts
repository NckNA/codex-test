import type { Appointment } from '../../types';
import { storage } from '../../utils/storage';

export interface IAppointmentRepository {
  listAppointmentsByPatient(patientId: string): Promise<Appointment[]>;
}

export const LocalStorageAppointmentRepository: IAppointmentRepository = {
  listAppointmentsByPatient: async (patientId: string): Promise<Appointment[]> => {
    // Mimics the sorting behavior from the UI component directly in the repository
    const appointments = storage.getAppointments()
      .filter(a => a.patientId === patientId)
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
    return Promise.resolve(appointments);
  }
};
