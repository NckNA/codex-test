import { createDentalChartRepository } from '../repositories/DentalChartRepository';
import { createTreatmentPlansRepository } from '../repositories/TreatmentPlansRepository';
import { createChiefComplaintRepository } from '../repositories/ChiefComplaintRepository';
import { createFindingsRepository } from '../repositories/FindingsRepository';
import { createAppointmentRepository } from '../repositories/AppointmentRepository';
import { ACTIVE_FINDING_STATUSES } from '../../domain/findingStatus';

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

  const [chart, plans, complaint, findings, allAppointments] = await Promise.all([
    chartRepo.getDentalChart(patientId),
    plansRepo.listTreatmentPlansByPatient(patientId),
    complaintRepo.getChiefComplaint(patientId),
    findingsRepo.listFindingsByPatient(patientId),
    appointmentRepo.listAppointments(),
  ]);

  const patientAppointments = allAppointments
    .filter(a => a.patientId === patientId)
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

  const needsTreatment = chart.teeth.filter(t => ['needs_treatment', 'caries', 'pulpitis', 'periodontitis'].includes(t.condition)).length;
  const missing = chart.teeth.filter(t => t.condition === 'missing').length;
  const activePlans = plans.filter(p => ['draft', 'in_progress', 'approved'].includes(p.status)).length;
  const totalAmount = plans.reduce((sum, p) => sum + p.totalPrice, 0);

  const chiefComplaintText = complaint?.text || '';
  const highUrgentFindings = findings.filter(f => (f.severity === 'high' || f.severity === 'urgent') && ACTIVE_FINDING_STATUSES.includes(f.status)).length;
  const notIncludedFindings = findings.filter(f => f.status === 'discovered').length;
  const monitoringFindings = findings.filter(f => f.status === 'monitoring').length;

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
      monitoringFindings,
    },
    lastVisit,
    nextVisit,
  };
}
