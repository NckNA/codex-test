import type {
  Appointment,
  ChiefComplaint,
  DentalChart,
  DentalFinding,
  Patient,
  TreatmentPlan,
} from '../../types';
import { isArchivedFindingStatus } from '../../domain/findingStatus';
import type { PatientFileRecord } from '../repositories/PatientFilesRepository';

export type PatientTimelineEventCategory =
  | 'patient'
  | 'complaint'
  | 'dental_chart'
  | 'finding'
  | 'treatment_plan'
  | 'appointment'
  | 'file'
  | 'payment'
  | 'stock'
  | 'audit';

export type PatientTimelineEventVisibility = 'clinical' | 'admin' | 'financial' | 'system';

export type PatientTimelineSourceType =
  | 'patient'
  | 'complaint'
  | 'dental_chart'
  | 'finding'
  | 'treatment_plan'
  | 'treatment_stage'
  | 'appointment'
  | 'patient_file'
  | 'payment'
  | 'stock_movement'
  | 'audit_event';

export interface PatientTimelineEvent {
  id: string;
  tenantId: string;
  patientId: string;
  occurredAt: string;
  category: PatientTimelineEventCategory;
  type: string;
  title: string;
  sourceType: PatientTimelineSourceType;
  sourceId: string;
  visibility: PatientTimelineEventVisibility;
  description?: string;
  sourceStatus?: string;
  toothId?: string | null;
  findingId?: string | null;
  treatmentPlanId?: string | null;
  treatmentStageId?: string | null;
  appointmentId?: string | null;
  fileId?: string | null;
  actorUserId?: string | null;
  actorLabel?: string | null;
  isArchived?: boolean;
  linkTarget?: string;
  metadata?: Record<string, unknown>;
}

export interface PatientTimelineFilterOptions {
  categories?: PatientTimelineEventCategory[];
  visibility?: PatientTimelineEventVisibility[];
  includeArchived?: boolean;
}

export type TimelinePatientFile = PatientFileRecord & {
  findingId?: string | null;
  treatmentPlanId?: string | null;
  treatmentStageId?: string | null;
  appointmentId?: string | null;
};

export interface BuildPatientTimelineInput {
  tenantId: string;
  patientId: string;
  patient?: Patient | null;
  chiefComplaint?: ChiefComplaint | null;
  findings?: DentalFinding[];
  treatmentPlans?: TreatmentPlan[];
  appointments?: Appointment[];
  patientFiles?: TimelinePatientFile[];
  dentalChart?: DentalChart | null;
  includeArchived?: boolean;
}

const CATEGORY_ORDER: Record<PatientTimelineEventCategory, number> = {
  patient: 10,
  complaint: 20,
  dental_chart: 30,
  finding: 40,
  treatment_plan: 50,
  appointment: 60,
  file: 70,
  payment: 80,
  stock: 90,
  audit: 100,
};

export const ACTIVE_CLINIC_REQUIRED_FOR_TIMELINE = 'Active clinic is required for patient timeline.';
export const PATIENT_REQUIRED_FOR_TIMELINE = 'Patient is required for patient timeline.';

function isValidIsoLikeDate(value: string | undefined | null): value is string {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()));
}

function eventId(sourceType: PatientTimelineSourceType, sourceId: string, type: string) {
  return `${sourceType}:${sourceId}:${type}`;
}

function createEvent(input: Omit<PatientTimelineEvent, 'occurredAt'> & { occurredAt?: string | null }): PatientTimelineEvent | null {
  if (!isValidIsoLikeDate(input.occurredAt)) return null;
  return { ...input, occurredAt: input.occurredAt };
}

function pushEvent(events: PatientTimelineEvent[], event: PatientTimelineEvent | null) {
  if (event) events.push(event);
}

export function sortPatientTimelineEvents(events: PatientTimelineEvent[]): PatientTimelineEvent[] {
  return [...events].sort((a, b) => {
    const byDate = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    if (byDate !== 0) return byDate;

    const byCategory = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (byCategory !== 0) return byCategory;

    const bySourceType = a.sourceType.localeCompare(b.sourceType);
    if (bySourceType !== 0) return bySourceType;

    const bySourceId = a.sourceId.localeCompare(b.sourceId);
    if (bySourceId !== 0) return bySourceId;

    return a.id.localeCompare(b.id);
  });
}

export function filterPatientTimelineEvents(
  events: PatientTimelineEvent[],
  options: PatientTimelineFilterOptions = {},
): PatientTimelineEvent[] {
  return events.filter((event) => {
    if (options.categories?.length && !options.categories.includes(event.category)) return false;
    if (options.visibility?.length && !options.visibility.includes(event.visibility)) return false;
    if (options.includeArchived === false && event.isArchived) return false;
    return true;
  });
}

function buildPatientEvent(input: BuildPatientTimelineInput): PatientTimelineEvent | null {
  const patient = input.patient;
  if (!patient) return null;

  return createEvent({
    id: eventId('patient', patient.id, 'created'),
    tenantId: input.tenantId,
    patientId: input.patientId,
    occurredAt: patient.createdAt,
    category: 'patient',
    type: 'patient_created',
    title: 'Пациент добавлен',
    description: patient.fullName,
    sourceType: 'patient',
    sourceId: patient.id,
    visibility: 'admin',
    sourceStatus: patient.status,
    linkTarget: 'patient_card',
  });
}

function buildChiefComplaintEvent(input: BuildPatientTimelineInput): PatientTimelineEvent | null {
  const complaint = input.chiefComplaint;
  if (!complaint) return null;

  return createEvent({
    id: eventId('complaint', complaint.id, 'created'),
    tenantId: input.tenantId,
    patientId: input.patientId,
    occurredAt: complaint.createdAt,
    category: 'complaint',
    type: 'chief_complaint_added',
    title: 'Добавлена жалоба пациента',
    description: complaint.text,
    sourceType: 'complaint',
    sourceId: complaint.id,
    visibility: 'clinical',
    metadata: { relatedTeeth: complaint.relatedTeeth },
  });
}

function buildFindingEvents(input: BuildPatientTimelineInput): PatientTimelineEvent[] {
  return (input.findings ?? []).flatMap((finding) => {
    const isArchived = isArchivedFindingStatus(finding.status);
    if (isArchived && !input.includeArchived) return [];

    const event = createEvent({
      id: eventId('finding', finding.id, 'created'),
      tenantId: input.tenantId,
      patientId: input.patientId,
      occurredAt: finding.createdAt,
      category: 'finding',
      type: isArchived ? 'finding_archived' : 'finding_discovered',
      title: isArchived ? 'Находка в архиве' : 'Выявлена находка',
      description: finding.title,
      sourceType: 'finding',
      sourceId: finding.id,
      sourceStatus: finding.status,
      toothId: finding.toothNumber ? String(finding.toothNumber) : null,
      findingId: finding.id,
      visibility: 'clinical',
      isArchived,
      linkTarget: 'findings',
      metadata: {
        category: finding.category,
        severity: finding.severity,
        clinicalZone: finding.clinicalZone ?? null,
        includeInTreatmentPlan: finding.includeInTreatmentPlan,
      },
    });

    return event ? [event] : [];
  });
}

function buildTreatmentPlanEvents(input: BuildPatientTimelineInput): PatientTimelineEvent[] {
  return (input.treatmentPlans ?? []).flatMap((plan) => {
    const event = createEvent({
      id: eventId('treatment_plan', plan.id, 'created'),
      tenantId: input.tenantId,
      patientId: input.patientId,
      occurredAt: plan.createdAt,
      category: 'treatment_plan',
      type: 'treatment_plan_created',
      title: 'Создан план лечения',
      description: plan.title,
      sourceType: 'treatment_plan',
      sourceId: plan.id,
      sourceStatus: plan.status,
      treatmentPlanId: plan.id,
      visibility: 'clinical',
      linkTarget: 'treatment_plans',
      metadata: {
        totalPrice: plan.totalPrice,
        stageCount: plan.stages.length,
      },
    });

    return event ? [event] : [];
  });
}

function buildAppointmentEvents(input: BuildPatientTimelineInput): PatientTimelineEvent[] {
  return (input.appointments ?? []).flatMap((appointment) => {
    if (appointment.patientId !== input.patientId) return [];

    const event = createEvent({
      id: eventId('appointment', appointment.id, 'scheduled'),
      tenantId: input.tenantId,
      patientId: input.patientId,
      occurredAt: appointment.start,
      category: 'appointment',
      type: 'appointment_scheduled',
      title: 'Запланирован приём',
      description: appointment.service,
      sourceType: 'appointment',
      sourceId: appointment.id,
      sourceStatus: appointment.status,
      appointmentId: appointment.id,
      actorUserId: appointment.doctorId,
      visibility: 'admin',
      linkTarget: 'appointments',
      metadata: {
        cabinet: appointment.cabinet,
        end: appointment.end,
        paymentType: appointment.paymentType ?? null,
      },
    });

    return event ? [event] : [];
  });
}

function buildPatientFileEvents(input: BuildPatientTimelineInput): PatientTimelineEvent[] {
  return (input.patientFiles ?? []).flatMap((file) => {
    if (file.patientId !== input.patientId) return [];
    if (file.isArchived && !input.includeArchived) return [];

    const event = createEvent({
      id: eventId('patient_file', file.id, file.isArchived ? 'archived' : 'uploaded'),
      tenantId: input.tenantId,
      patientId: input.patientId,
      occurredAt: file.isArchived ? file.archivedAt ?? file.updatedAt : file.createdAt,
      category: 'file',
      type: file.isArchived ? 'patient_file_archived' : 'patient_file_uploaded',
      title: file.isArchived ? 'Файл в архиве' : 'Загружен файл пациента',
      description: file.originalFilename,
      sourceType: 'patient_file',
      sourceId: file.id,
      sourceStatus: file.fileKind,
      toothId: file.toothId ?? null,
      findingId: file.findingId ?? null,
      treatmentPlanId: file.treatmentPlanId ?? null,
      treatmentStageId: file.treatmentStageId ?? null,
      appointmentId: file.appointmentId ?? null,
      fileId: file.id,
      actorUserId: file.isArchived ? file.archivedBy ?? null : file.uploadedBy ?? null,
      visibility: 'clinical',
      isArchived: file.isArchived,
      linkTarget: 'patient_files',
      metadata: {
        fileKind: file.fileKind,
        sourceContext: file.sourceContext,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      },
    });

    return event ? [event] : [];
  });
}

export function buildPatientTimeline(input: BuildPatientTimelineInput): PatientTimelineEvent[] {
  if (!input.tenantId) throw new Error(ACTIVE_CLINIC_REQUIRED_FOR_TIMELINE);
  if (!input.patientId) throw new Error(PATIENT_REQUIRED_FOR_TIMELINE);

  const events: PatientTimelineEvent[] = [];

  pushEvent(events, buildPatientEvent(input));
  pushEvent(events, buildChiefComplaintEvent(input));
  events.push(...buildFindingEvents(input));
  events.push(...buildTreatmentPlanEvents(input));
  events.push(...buildAppointmentEvents(input));
  events.push(...buildPatientFileEvents(input));

  // Dental chart changes are intentionally not emitted yet because the current chart model has
  // tooth-level updatedAt values but no reliable per-change actor/type history.
  void input.dentalChart;

  return sortPatientTimelineEvents(events);
}

export function canRoleSeePatientTimelineEvent(role: string | null | undefined, event: PatientTimelineEvent): boolean {
  if (!role) return false;

  if (role === 'clinic_owner' || role === 'clinic_admin') return true;
  if (role === 'doctor') return event.visibility === 'clinical' || event.visibility === 'admin';
  if (role === 'registrar' || role === 'receptionist') return event.visibility === 'admin';
  if (role === 'cashier') return event.visibility === 'financial' || event.visibility === 'admin';

  // Platform roles require explicit audited patient access in a future task.
  return false;
}
