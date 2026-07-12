// src/types/index.ts

export type AppointmentStatus = 'new' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'blocked';
export type CancellationSource = 'patient' | 'clinic' | 'doctor' | 'technical' | 'other';
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
  createdAt: string;
  updatedAt?: string;
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