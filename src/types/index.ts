// src/types/index.ts

export type AppointmentStatus = 'new' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'blocked';
export type CancellationSource = 'patient' | 'clinic' | 'doctor' | 'technical' | 'other';
export type AppointmentConfirmationState = 'unconfirmed' | 'contact_in_progress' | 'confirmed' | 'unreachable' | 'callback_requested';
export type AppointmentContactChannel = 'phone' | 'whatsapp' | 'sms' | 'email' | 'in_person' | 'other';
export type AppointmentContactOutcome = 'confirmed' | 'no_answer' | 'unreachable' | 'callback_requested' | 'declined' | 'wrong_number' | 'message_sent' | 'other';
export type PaymentType = 'cash' | 'card' | 'kaspi' | 'insurance' | 'installment' | 'unpaid';
export type Source = 'phone' | 'whatsapp' | 'instagram' | 'walk_in' | 'repeat' | 'referral';


export type PatientSource = 'manual' | 'instagram' | 'whatsapp' | 'website' | 'phone' | 'amocrm' | 'referral' | 'other';
export type PatientLeadStatus = 'new_lead' | 'contacted' | 'scheduled' | 'arrived' | 'treatment_plan_created' | 'treatment_plan_approved' | 'declined' | 'lost';
export type ExternalCrmProvider = 'amocrm' | 'other';
export type SyncStatus = 'not_synced' | 'synced' | 'sync_error' | 'needs_update';

export interface ExternalCrmLink {
  provider: ExternalCrmProvider;
  externalContactId?: string;
  externalLeadId?: string;
  externalDealId?: string;
  syncStatus: SyncStatus;
  lastSyncAt?: string;
  lastSyncError?: string;
}

export interface PatientIntegrationMeta {
  source: PatientSource;
  sourceComment?: string;
  leadStatus: PatientLeadStatus;
  externalCrm?: ExternalCrmLink;
  createdFromExternal?: boolean;
}

export interface Patient {
  id: string;
  fullName: string;
  phone: string;
  birthDate?: string;
  source: Source;
  status: string; // e.g., 'active', 'archived'
  notes?: string;
  allergies?: string;
  balance?: number;
  bonusBalance?: number;
  createdAt: string;
  integration?: PatientIntegrationMeta;
}

export interface Doctor {
  id: string;
  fullName: string;
  specialization: string;
  cabinet: string;
  color: string;
  active: boolean;
}

export interface Appointment {
  id: string;
  patientId?: string; // Optional for blocked slots
  doctorId: string;
  cabinet: string;
  service: string;
  start: string; // ISO string or specific format like '2023-10-25T09:00:00'
  end: string;
  status: AppointmentStatus;
  paymentType?: PaymentType;
  source?: Source;
  comment?: string;
  price?: number;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationSource?: CancellationSource;
  cancellationReason?: string;
  noShowAt?: string;
  noShowBy?: string;
  noShowReason?: string;
  lifecycleMetadataVersion?: number;
  confirmationState?: AppointmentConfirmationState;
  confirmedAt?: string;
  confirmedBy?: string;
  confirmationChannel?: AppointmentContactChannel;
  confirmationNote?: string;
  lastConfirmationAttemptAt?: string;
  confirmationAttemptCount?: number;
  confirmationMetadataVersion?: number;
  lastConfirmationOutcome?: AppointmentContactOutcome;
  lastConfirmationNote?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AppointmentConfirmationAttempt {
  id: string;
  tenantId: string;
  appointmentId?: string;
  patientId: string;
  actorUserId: string;
  channel: AppointmentContactChannel;
  outcome: AppointmentContactOutcome;
  note?: string;
  attemptedAt: string;
  operationKey?: string;
  createdAt: string;
}

export type AppointmentReminderType =
  | 'confirmation_request'
  | 'day_before_reminder'
  | 'control_call_task'
  | 'callback_task';

export type AppointmentReminderExecutionMode = 'manual';
export type AppointmentReminderJobState = 'scheduled' | 'ready' | 'completed' | 'cancelled' | 'superseded' | 'skipped';
export type AppointmentReminderOperationalState = AppointmentReminderJobState;

export interface AppointmentReminderJob {
  id: string;
  tenantId: string;
  appointmentId: string;
  patientId: string;
  reminderType: AppointmentReminderType;
  executionMode: AppointmentReminderExecutionMode;
  dueAt: string;
  state: AppointmentReminderJobState;
  operationalState: AppointmentReminderOperationalState;
  appointmentUpdatedAt: string;
  policyVersion: number;
  planKey: string;
  payloadFingerprint: string;
  priority: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  supersededAt?: string;
  cancelledAt?: string;
  skippedAt?: string;
  completedAt?: string;
  originalDueAt: string;
  completedBy?: string;
  completionOutcome?: AppointmentContactOutcome;
  completionNote?: string;
  confirmationAttemptId?: string;
  deferredAt?: string;
  deferredBy?: string;
  deferReason?: string;
  skippedBy?: string;
  operationKey?: string;
  operationFingerprint?: string;
  lastManualActionAt?: string;
  terminalReason?: string;
  metadata: Record<string, unknown>;
}

export interface AppointmentReminderQueueItem {
  job: AppointmentReminderJob;
  appointment: Appointment;
  patient: Pick<Patient, 'id' | 'fullName' | 'phone'>;
  doctor: Pick<Doctor, 'id' | 'fullName' | 'specialization' | 'cabinet'>;
  attemptCount: number;
  lastAttempt?: AppointmentConfirmationAttempt;
  communicationEligibility?: PatientCommunicationEligibilitySummary;
}

export type AppointmentReminderOperationType = 'reminder_complete' | 'reminder_defer' | 'reminder_skip';

export interface CompleteAppointmentReminderJobInput {
  jobId: string;
  channel: AppointmentContactChannel;
  outcome: AppointmentContactOutcome;
  note?: string;
  expectedJobUpdatedAt: string;
  expectedAppointmentUpdatedAt: string;
  operationKey: string;
}

export interface DeferAppointmentReminderJobInput {
  jobId: string;
  newDueAt: string;
  reason: string;
  expectedJobUpdatedAt: string;
  expectedAppointmentUpdatedAt: string;
  operationKey: string;
}

export interface SkipAppointmentReminderJobInput {
  jobId: string;
  reason: string;
  expectedJobUpdatedAt: string;
  expectedAppointmentUpdatedAt: string;
  operationKey: string;
}

export interface AppointmentReminderOperationResult {
  job: AppointmentReminderJob;
  appointment: Appointment;
  confirmationAttempt?: AppointmentConfirmationAttempt;
  replayed: boolean;
  recovered: boolean;
  operationType: AppointmentReminderOperationType;
}

export interface AppointmentReminderPlanResult {
  created: AppointmentReminderJob[];
  reused: AppointmentReminderJob[];
  superseded: AppointmentReminderJob[];
  cancelled: AppointmentReminderJob[];
  skipped: AppointmentReminderJob[];
  desired: Array<Record<string, unknown>>;
  appointmentVersion: string;
  policyVersion: number;
  policyEnabled: boolean;
  callbackDeferred: boolean;
}

export interface TenantReminderReconcileResult {
  processed: number;
  created: number;
  reused: number;
  superseded: number;
  cancelled: number;
  skipped: number;
}

export type PatientCommunicationContactType = 'phone' | 'email';
export type PatientCommunicationOwnerType = 'patient' | 'representative';
export type PatientRepresentativeRelation = 'parent' | 'guardian' | 'spouse' | 'child' | 'caregiver' | 'other';
export type PatientCommunicationLanguage = 'ru' | 'kk' | 'en';
export type PatientPreferredCommunicationChannel = 'phone' | 'whatsapp' | 'sms' | 'email' | 'none';
export type PatientAutomatedCommunicationChannel = 'sms' | 'whatsapp' | 'email';
export type PatientCommunicationChannel = 'phone' | PatientAutomatedCommunicationChannel;
export type PatientCommunicationConsentState = 'unknown' | 'granted' | 'denied' | 'withdrawn';
export type PatientCommunicationConsentSource =
  | 'patient_verbal'
  | 'patient_written'
  | 'representative_verbal'
  | 'representative_written'
  | 'staff_correction'
  | 'import_legacy'
  | 'system';
export type PatientCommunicationSuppressionReason =
  | 'patient_request'
  | 'representative_request'
  | 'invalid_contact'
  | 'wrong_number'
  | 'duplicate_contact'
  | 'legal_restriction'
  | 'staff_decision'
  | 'other';
export type PatientCommunicationEligibilityStatus =
  | 'available'
  | 'blocked'
  | 'manual_only'
  | 'consent_unknown'
  | 'invalid_contact'
  | 'suppressed';
export type PatientCommunicationBlockedReason =
  | 'no_contact'
  | 'invalid_contact'
  | 'unverified_contact'
  | 'consent_unknown'
  | 'consent_denied'
  | 'consent_withdrawn'
  | 'channel_suppressed'
  | 'global_suppression'
  | 'no_preferred_channel'
  | 'representative_review_required';

export interface PatientCommunicationContact {
  id: string;
  tenantId: string;
  patientId: string;
  contactType: PatientCommunicationContactType;
  contactValueRaw: string;
  contactValueNormalized?: string;
  countryCode?: string;
  isPrimary: boolean;
  isVerified: boolean;
  verificationSource?: string;
  ownerType: PatientCommunicationOwnerType;
  representativeName?: string;
  representativeRelation?: PatientRepresentativeRelation;
  language?: PatientCommunicationLanguage;
  possibleDuplicate: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface PatientCommunicationPreferences {
  tenantId: string;
  patientId: string;
  preferredLanguage: PatientCommunicationLanguage;
  preferredChannel: PatientPreferredCommunicationChannel;
  allowManualPhone: boolean;
  smsConsentState: PatientCommunicationConsentState;
  whatsappConsentState: PatientCommunicationConsentState;
  emailConsentState: PatientCommunicationConsentState;
  phoneSuppressed: boolean;
  phoneSuppressionReason?: PatientCommunicationSuppressionReason;
  smsSuppressed: boolean;
  smsSuppressionReason?: PatientCommunicationSuppressionReason;
  whatsappSuppressed: boolean;
  whatsappSuppressionReason?: PatientCommunicationSuppressionReason;
  emailSuppressed: boolean;
  emailSuppressionReason?: PatientCommunicationSuppressionReason;
  globalSuppression: boolean;
  globalSuppressionReason?: PatientCommunicationSuppressionReason;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface PatientCommunicationConsentEvent {
  id: string;
  tenantId: string;
  patientId: string;
  channel: PatientAutomatedCommunicationChannel;
  previousState: PatientCommunicationConsentState;
  newState: PatientCommunicationConsentState;
  source: PatientCommunicationConsentSource;
  actorUserId?: string;
  reason?: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface PatientCommunicationEligibility {
  eligible: boolean;
  automatedEligible: boolean;
  manualEligible: boolean;
  status: PatientCommunicationEligibilityStatus;
  channel: PatientCommunicationChannel;
  selectedContactId?: string;
  normalizedDestination?: string;
  language: PatientCommunicationLanguage;
  blockedReasons: PatientCommunicationBlockedReason[];
  consentState: PatientCommunicationConsentState | 'not_required';
  suppressionState: { global: boolean; channel: boolean };
  representative: boolean;
  requiresManualReview: boolean;
}

export interface PatientCommunicationEligibilitySummary {
  phone: PatientCommunicationEligibility;
  sms: PatientCommunicationEligibility;
  whatsapp: PatientCommunicationEligibility;
  email: PatientCommunicationEligibility;
  status: PatientCommunicationEligibilityStatus;
}

export interface PatientCommunicationProfile {
  contacts: PatientCommunicationContact[];
  preferences: PatientCommunicationPreferences;
  consentEvents: PatientCommunicationConsentEvent[];
  eligibility: PatientCommunicationEligibilitySummary;
}

export type ToothNumber =
  | 18 | 17 | 16 | 15 | 14 | 13 | 12 | 11
  | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28
  | 48 | 47 | 46 | 45 | 44 | 43 | 42 | 41
  | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38
  | 55 | 54 | 53 | 52 | 51
  | 61 | 62 | 63 | 64 | 65
  | 85 | 84 | 83 | 82 | 81
  | 71 | 72 | 73 | 74 | 75;

export type ToothCondition =
  | 'healthy'
  | 'caries'
  | 'filled'
  | 'missing'
  | 'crown'
  | 'implant'
  | 'root'
  | 'pulpitis'
  | 'periodontitis'
  | 'needs_treatment';

export type ToothPresenceStatus =
  | 'natural'
  | 'missing'
  | 'implant'
  | 'root_remnant'
  | 'deciduous'
  | 'impacted';

export type ToothVisualState = ToothCondition;

export type ClinicalZone =
  | 'crown'
  | 'endodontics'
  | 'root'
  | 'periodontium'
  | 'bone'
  | 'orthopedics'
  | 'planning';

export type PlannedWorkRecordStatus =
  | 'planned'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface PlannedWorkRecord {
  id: string;
  workId: string;
  zone: ClinicalZone;
  status: PlannedWorkRecordStatus;
  priceSnapshot?: number;
  createdAt: string;
  updatedAt: string;
}

export type ToothSurface = 'occlusal' | 'mesial' | 'distal' | 'vestibular' | 'oral';

export interface ToothRecord {
  toothNumber: ToothNumber;
  condition: ToothCondition;
  surfaces?: ToothSurface[];
  crown?: string;
  workCrown?: string;
  root?: string;
  workRoot?: string;
  gum?: string;
  workGum?: string;
  bone?: string;
  workBone?: string;
  canal?: string;
  workCanal?: string;
  notes?: string;
  updatedAt: string;
  presenceStatus?: ToothPresenceStatus;
  visualState?: ToothVisualState;
  visualStateOverride?: ToothVisualState;
  diagnoses?: string[];
  plannedWorks?: string[];
  plannedWorkRecords?: PlannedWorkRecord[];
  completedWorks?: string[];
}

export interface DentalChart {
  id: string;
  patientId: string;
  teeth: ToothRecord[];
  complaints?: string;
  diagnosis?: string;
  createdAt: string;
  updatedAt: string;
}

export type FindingCategory =
  | 'caries'
  | 'missing_tooth'
  | 'gum_problem'
  | 'root_problem'
  | 'bite_problem'
  | 'aesthetic_problem'
  | 'pain'
  | 'risk_zone'
  | 'hygiene'
  | 'prosthetics'
  | 'implantology'
  | 'other';

export type FindingSeverity = 'low' | 'medium' | 'high' | 'urgent';

export type FindingStatus =
  | 'discovered'
  | 'planned'
  | 'in_treatment'
  | 'completed'
  | 'declined_by_patient'
  | 'monitoring'
  | 'archived';

export interface DentalFinding {
  id: string;
  patientId: string;
  toothNumber?: number;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  description: string;
  riskDescription?: string;
  recommendation?: string;
  isChiefComplaintRelated: boolean;
  includeInTreatmentPlan: boolean;
  status: FindingStatus;
  clinicalZone?: ClinicalZone;
  diagnosisIds?: string[];
  plannedWorkIds?: string[];
  plannedWorkRecordIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChiefComplaint {
  id: string;
  patientId: string;
  text: string;
  relatedTeeth: number[];
  createdAt: string;
  updatedAt: string;
}

export type TreatmentPlanStatus = 'draft' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
export type TreatmentStageStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type TreatmentPlanSource = 'manual' | 'from_finding';

export interface TreatmentStage {
  id: string;
  title: string;
  teeth: number[];
  description: string;
  price: number;
  status: TreatmentStageStatus;
  findingIds?: string[];
  source?: TreatmentPlanSource;
}

export interface TreatmentPlan {
  id: string;
  patientId: string;
  title: string;
  status: TreatmentPlanStatus;
  stages: TreatmentStage[];
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
}