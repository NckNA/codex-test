import { createDentalChartRepository } from '../repositories/DentalChartRepository';
import { createTreatmentPlansRepository } from '../repositories/TreatmentPlansRepository';
import { createChiefComplaintRepository } from '../repositories/ChiefComplaintRepository';
import { createFindingsRepository } from '../repositories/FindingsRepository';
import { createAppointmentRepository } from '../repositories/AppointmentRepository';
import { getPatientAppointmentSummary } from '../../domain/appointmentSummary';
import { isActiveFindingStatus } from '../../domain/findingStatus';

export interface PatientDentalSummary {
  needsTreatment: number;
  missing: number;
  activePlans: number;
  totalAmount: number;
  chiefComplaintText: string;
  highUrgentFindings: number;
  notIncludedFindings: number;
  monitoringFindings: number;
}

export interface PatientMedicalSummaryData {
  dentalSummary: PatientDentalSummary;
  lastVisit?: Date;
  nextVisit?: Date;
}

export interface ClinicalSummaryRepositoryConfig {
  backend: 'local' | 'supabase';
  tenantId?: string;
}

export const EMPTY_PATIENT_DENTAL_SUMMARY: PatientDentalSummary = {
  needsTreatment: 0,
  missing: 0,
  activePlans: 0,
  totalAmount: 0,
  chiefComplaintText: '',
  highUrgentFindings: 0,
  notIncludedFindings: 0,
  monitoringFindings: 0,
};

export const EMPTY_PATIENT_MEDICAL_SUMMARY: PatientMedicalSummaryData = {
  dentalSummary: EMPTY_PATIENT_DENTAL_SUMMARY,
};

export async function getPatientMedicalSummary(patientId: string, config: ClinicalSummaryRepositoryConfig): Promise<PatientMedicalSummaryData> {
  if (!patientId) {
    return EMPTY_PATIENT_MEDICAL_SUMMARY;
  }

  if (config.backend === 'supabase' && !config.tenantId) {
    // Cannot query supabase without tenantId
    return EMPTY_PATIENT_MEDICAL_SUMMARY;
  }

  const chartRepo = createDentalChartRepository(config);
  const plansRepo = createTreatmentPlansRepository(config);
  const complaintRepo = createChiefComplaintRepository(config);
  const findingsRepo = createFindingsRepository(config);
  const appointmentRepo = createAppointmentRepository(config);

  const [chart, plans, complaint, findings, patientAppointments] = await Promise.all([
    chartRepo.getDentalChart(patientId),
    plansRepo.listTreatmentPlansByPatient(patientId),
    complaintRepo.getChiefComplaint(patientId),
    findingsRepo.listFindingsByPatient(patientId),
    appointmentRepo.listAppointmentsByPatient(patientId),
  ]);

  const needsTreatment = chart.teeth.filter(t => ['needs_treatment', 'caries', 'pulpitis', 'periodontitis'].includes(t.condition)).length;
  const missing = chart.teeth.filter(t => t.condition === 'missing').length;
  const activePlans = plans.filter(p => ['draft', 'in_progress', 'approved'].includes(p.status)).length;
  const totalAmount = plans.reduce((sum, p) => sum + p.totalPrice, 0);

  const chiefComplaintText = complaint?.text || '';
  const activeFindings = findings.filter(f => isActiveFindingStatus(f.status));
  const highUrgentFindings = activeFindings.filter(f => f.severity === 'high' || f.severity === 'urgent').length;
  const notIncludedFindings = activeFindings.filter(f => f.status === 'discovered').length;
  const monitoringFindings = activeFindings.filter(f => f.status === 'monitoring').length;

  const appointmentSummary = getPatientAppointmentSummary(patientAppointments, patientId);
  const lastVisit = appointmentSummary.previousAppointment
    ? new Date(appointmentSummary.previousAppointment.start)
    : undefined;
  const nextVisit = appointmentSummary.nextAppointment
    ? new Date(appointmentSummary.nextAppointment.start)
    : undefined;

  return {
    dentalSummary: {
      needsTreatment,
      missing,
      activePlans,
      totalAmount,
      chiefComplaintText,
      highUrgentFindings,
      notIncludedFindings,
      monitoringFindings,
    },
    lastVisit,
    nextVisit,
  };
}
