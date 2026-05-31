import type { Patient, Doctor, Appointment } from '../types';
import { demoDoctors, demoPatients, demoAppointments } from '../data/seed';

const STORAGE_KEYS = {
  INITIALIZED: 'df_initialized',
  DOCTORS: 'df_doctors',
  PATIENTS: 'df_patients',
  APPOINTMENTS: 'df_appointments',
};

export const storage = {
  init: () => {
    const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!initialized) {
      localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(demoDoctors));
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(demoPatients));
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(demoAppointments));
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    }
  },

  reset: () => {
    localStorage.removeItem(STORAGE_KEYS.INITIALIZED);
    storage.init();
  },

  getDoctors: (): Doctor[] => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.DOCTORS) || '[]');
  },

  getPatients: (): Patient[] => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PATIENTS) || '[]');
  },

  savePatients: (patients: Patient[]) => {
    localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
  },

  addPatient: (patient: Patient) => {
    const patients = storage.getPatients();
    patients.push(patient);
    storage.savePatients(patients);
  },

  updatePatient: (updated: Patient) => {
    const patients = storage.getPatients();
    const index = patients.findIndex(p => p.id === updated.id);
    if (index !== -1) {
      patients[index] = updated;
      storage.savePatients(patients);
    }
  },

  getAppointments: (): Appointment[] => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.APPOINTMENTS) || '[]');
  },

  saveAppointments: (appointments: Appointment[]) => {
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
  },

  addAppointment: (appointment: Appointment) => {
    const appointments = storage.getAppointments();
    appointments.push(appointment);
    storage.saveAppointments(appointments);
  },

  updateAppointment: (updated: Appointment) => {
    const appointments = storage.getAppointments();
    const index = appointments.findIndex(a => a.id === updated.id);
    if (index !== -1) {
      appointments[index] = updated;
      storage.saveAppointments(appointments);
    }
  },

  deleteAppointment: (id: string) => {
    const appointments = storage.getAppointments();
    storage.saveAppointments(appointments.filter(a => a.id !== id));
  }
};
