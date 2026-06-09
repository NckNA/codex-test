import { LocalStorageDentalChartRepository } from '../repositories/DentalChartRepository';
import { LocalStorageTreatmentPlansRepository } from '../repositories/TreatmentPlansRepository';
import { LocalStorageChiefComplaintRepository } from '../repositories/ChiefComplaintRepository';
import { LocalStorageFindingsRepository } from '../repositories/FindingsRepository';
import { LocalStorageAppointmentRepository } from '../repositories/AppointmentRepository';

export interface PatientDentalSummary {
  needsTreatment: number;
  missing: number;
  activePlans: number;
  totalAmount: number;
  chiefComplaintText: string;
  highUrgentFindings: number;
  notIncludedFindings: number;
  observingFindings: number;
}

export interface PatientMedicalSummaryData {
  dentalSummary: PatientDentalSummary;
  lastVisit?: Date;
  nextVisit?: Date;
}

export const EMPTY_PATIENT_DENTAL_SUMMARY: PatientDentalSummary = {
  needsTreatment: 0,
  missing: 0,
  activePlans: 0,
  totalAmount: 0,
  chiefComplaintText: '',
  highUrgentFindings: 0,
  notIncludedFindings: 0,
  observingFindings: 0,
};

export const EMPTY_PATIENT_MEDICAL_SUMMARY: PatientMedicalSummaryData = {
  dentalSummary: EMPTY_PATIENT_DENTAL_SUMMARY,
};

export async function getPatientMedicalSummary(patientId: string): Promise<PatientMedicalSummaryData> {
  if (!patientId) {
    return EMPTY_PATIENT_MEDICAL_SUMMARY;
  }

  const [chart, plans, complaint, findings, allAppointments] = await Promise.all([
    LocalStorageDentalChartRepository.getDentalChart(patientId),
    LocalStorageTreatmentPlansRepository.listTreatmentPlansByPatient(patientId),
    LocalStorageChiefComplaintRepository.getChiefComplaint(patientId),
    LocalStorageFindingsRepository.listFindingsByPatient(patientId),
    LocalStorageAppointmentRepository.listAppointments(),
  ]);

  const patientAppointments = allAppointments
    .filter(a => a.patientId === patientId)
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

  const needsTreatment = chart.teeth.filter(t => ['needs_treatment', 'caries', 'pulpitis', 'periodontitis'].includes(t.condition)).length;
  const missing = chart.teeth.filter(t => t.condition === 'missing').length;
  const activePlans = plans.filter(p => ['draft', 'in_progress', 'approved'].includes(p.status)).length;
  const totalAmount = plans.reduce((sum, p) => sum + p.totalPrice, 0);

  const chiefComplaintText = complaint?.text || '';
  const highUrgentFindings = findings.filter(f => (f.severity === 'high' || f.severity === 'urgent') && f.status !== 'completed' && f.status !== 'declined_by_patient').length;
  const notIncludedFindings = findings.filter(f => f.status === 'discovered' || f.status === 'recommended').length;
  const observingFindings = findings.filter(f => f.status === 'observing').length;

  let lastVisit: Date | undefined;
  let nextVisit: Date | undefined;
  const now = new Date();

  const sortedAsc = [...patientAppointments].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  for (const appt of sortedAsc) {
    if (appt.status === 'blocked' || appt.status === 'cancelled') continue;
    const apptDate = new Date(appt.start);
    if (apptDate < now) {
      lastVisit = apptDate;
    } else {
      if (!nextVisit) nextVisit = apptDate;
    }
  }

  return {
    dentalSummary: {
      needsTreatment,
      missing,
      activePlans,
      totalAmount,
      chiefComplaintText,
      highUrgentFindings,
      notIncludedFindings,
      observingFindings,
    },
    lastVisit,
    nextVisit,
  };
}
