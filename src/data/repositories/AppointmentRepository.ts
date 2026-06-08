import type { Appointment } from '../../types';
import { storage } from '../../utils/storage';

export interface IAppointmentRepository {
  listAppointmentsByPatient(patientId: string): Promise<Appointment[]>;
  listAppointments(): Promise<Appointment[]>;
  createAppointment(appointment: Appointment): Promise<void>;
  updateAppointment(appointment: Appointment): Promise<void>;
  deleteAppointment(appointmentId: string): Promise<void>;
}

export const LocalStorageAppointmentRepository: IAppointmentRepository = {
  listAppointmentsByPatient: async (patientId: string): Promise<Appointment[]> => {
    // Mimics the sorting behavior from the UI component directly in the repository
    const appointments = storage.getAppointments()
      .filter(a => a.patientId === patientId)
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
    return Promise.resolve(appointments);
  },
  listAppointments: async (): Promise<Appointment[]> => {
    return Promise.resolve(storage.getAppointments());
  },
  createAppointment: async (appointment: Appointment): Promise<void> => {
    storage.addAppointment(appointment);
    return Promise.resolve();
  },
  updateAppointment: async (appointment: Appointment): Promise<void> => {
    storage.updateAppointment(appointment);
    return Promise.resolve();
  },
  deleteAppointment: async (appointmentId: string): Promise<void> => {
    storage.deleteAppointment(appointmentId);
    return Promise.resolve();
  }
};
