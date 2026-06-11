import type { Patient, Doctor, Appointment, DentalChart, TreatmentPlan, ToothNumber, ToothRecord, ChiefComplaint, DentalFinding } from '../types';
import { demoDoctors, demoPatients, demoAppointments, demoChiefComplaints, demoDentalFindings } from '../data/seed';
import { normalizeDentalChart, normalizeToothRecord } from './dentalChartNormalization';

const STORAGE_KEYS = {
  INITIALIZED: 'df_initialized',
  DOCTORS: 'df_doctors',
  PATIENTS: 'df_patients',
  APPOINTMENTS: 'df_appointments',
  DENTAL_CHARTS: 'df_dental_charts',
  TREATMENT_PLANS: 'df_treatment_plans',
  CHIEF_COMPLAINTS: 'df_chief_complaints',
  DENTAL_FINDINGS: 'df_dental_findings',
};

export const storage = {
  init: () => {
    const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!initialized) {
      localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(demoDoctors));
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(demoPatients));
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(demoAppointments));
      localStorage.setItem(STORAGE_KEYS.CHIEF_COMPLAINTS, JSON.stringify(demoChiefComplaints));
      localStorage.setItem(STORAGE_KEYS.DENTAL_FINDINGS, JSON.stringify(demoDentalFindings));
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
  },

  createDefaultDentalChart: (patientId: string): DentalChart => {
    const teethNumbers: ToothNumber[] = [
      18,17,16,15,14,13,12,11,
      21,22,23,24,25,26,27,28,
      48,47,46,45,44,43,42,41,
      31,32,33,34,35,36,37,38
    ];

    const now = new Date().toISOString();
    const teeth: ToothRecord[] = teethNumbers.map(num => normalizeToothRecord({
      toothNumber: num,
      condition: 'healthy',
      updatedAt: now
    }));

    return normalizeDentalChart({
      id: `chart_${patientId}`,
      patientId,
      teeth,
      createdAt: now,
      updatedAt: now
    });
  },

  getAllDentalCharts: (): Record<string, DentalChart> => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.DENTAL_CHARTS) || '{}');
  },

  getDentalChart: (patientId: string): DentalChart => {
    const charts = storage.getAllDentalCharts();
    if (!charts[patientId]) {
      const defaultChart = storage.createDefaultDentalChart(patientId);
      storage.saveDentalChart(patientId, defaultChart);
      return defaultChart;
    }
    return normalizeDentalChart(charts[patientId]);
  },

  saveDentalChart: (patientId: string, chart: DentalChart) => {
    const charts = storage.getAllDentalCharts();
    charts[patientId] = normalizeDentalChart(chart);
    localStorage.setItem(STORAGE_KEYS.DENTAL_CHARTS, JSON.stringify(charts));
  },

  getAllTreatmentPlans: (): TreatmentPlan[] => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TREATMENT_PLANS) || '[]');
  },

  saveAllTreatmentPlans: (plans: TreatmentPlan[]) => {
    localStorage.setItem(STORAGE_KEYS.TREATMENT_PLANS, JSON.stringify(plans));
  },

  getTreatmentPlans: (patientId: string): TreatmentPlan[] => {
    return storage.getAllTreatmentPlans().filter(p => p.patientId === patientId);
  },

  addTreatmentPlan: (_patientId: string, plan: TreatmentPlan) => {
    const plans = storage.getAllTreatmentPlans();
    plans.push(plan);
    storage.saveAllTreatmentPlans(plans);
  },

  updateTreatmentPlan: (_patientId: string, plan: TreatmentPlan) => {
    const plans = storage.getAllTreatmentPlans();
    const index = plans.findIndex(p => p.id === plan.id);
    if (index !== -1) {
      plans[index] = plan;
      storage.saveAllTreatmentPlans(plans);
    }
  },

  deleteTreatmentPlan: (_patientId: string, planId: string) => {
    const plans = storage.getAllTreatmentPlans();
    storage.saveAllTreatmentPlans(plans.filter(p => p.id !== planId));
  },

  getAllChiefComplaints: (): ChiefComplaint[] => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CHIEF_COMPLAINTS) || '[]');
  },

  saveAllChiefComplaints: (complaints: ChiefComplaint[]) => {
    localStorage.setItem(STORAGE_KEYS.CHIEF_COMPLAINTS, JSON.stringify(complaints));
  },

  getChiefComplaint: (patientId: string): ChiefComplaint | null => {
    const all = storage.getAllChiefComplaints();
    return all.find(c => c.patientId === patientId) || null;
  },

  saveChiefComplaint: (patientId: string, complaint: Omit<ChiefComplaint, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>) => {
    const all = storage.getAllChiefComplaints();
    const index = all.findIndex(c => c.patientId === patientId);

    if (index !== -1) {
      all[index] = {
        ...all[index],
        ...complaint,
        updatedAt: new Date().toISOString(),
      };
    } else {
      all.push({
        id: crypto.randomUUID(),
        patientId,
        ...complaint,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    storage.saveAllChiefComplaints(all);
  },

  getAllFindings: (): DentalFinding[] => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.DENTAL_FINDINGS) || '[]');
  },

  saveAllFindings: (findings: DentalFinding[]) => {
    localStorage.setItem(STORAGE_KEYS.DENTAL_FINDINGS, JSON.stringify(findings));
  },

  getFindings: (patientId: string): DentalFinding[] => {
    const all = storage.getAllFindings();
    return all.filter(f => f.patientId === patientId);
  },

  addFinding: (patientId: string, finding: Omit<DentalFinding, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>) => {
    const all = storage.getAllFindings();
    const newFinding: DentalFinding = {
      ...finding,
      id: crypto.randomUUID(),
      patientId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    all.push(newFinding);
    storage.saveAllFindings(all);
  },

  updateFinding: (patientId: string, finding: DentalFinding) => {
    const all = storage.getAllFindings();
    const index = all.findIndex(f => f.id === finding.id && f.patientId === patientId);
    if (index !== -1) {
      all[index] = { ...finding, updatedAt: new Date().toISOString() };
      storage.saveAllFindings(all);
    }
  },

  deleteFinding: (patientId: string, findingId: string) => {
    const all = storage.getAllFindings();
    storage.saveAllFindings(all.filter(f => !(f.id === findingId && f.patientId === patientId)));
  },

};