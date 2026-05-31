// src/types/index.ts

export type AppointmentStatus = 'new' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'blocked';
export type PaymentType = 'cash' | 'card' | 'kaspi' | 'insurance' | 'installment' | 'unpaid';
export type Source = 'phone' | 'whatsapp' | 'instagram' | 'walk_in' | 'repeat' | 'referral';

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
  createdAt: string;
}

export type ToothNumber =
  | 18 | 17 | 16 | 15 | 14 | 13 | 12 | 11
  | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28
  | 48 | 47 | 46 | 45 | 44 | 43 | 42 | 41
  | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38;

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

export type ToothSurface = 'occlusal' | 'mesial' | 'distal' | 'vestibular' | 'oral';

export interface ToothRecord {
  toothNumber: ToothNumber;
  condition: ToothCondition;
  surfaces?: ToothSurface[];
  crown?: string;
  root?: string;
  gum?: string;
  bone?: string;
  canal?: string;
  notes?: string;
  updatedAt: string;
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

export type TreatmentPlanStatus = 'draft' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
export type TreatmentStageStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface TreatmentStage {
  id: string;
  title: string;
  teeth: number[];
  description: string;
  price: number;
  status: TreatmentStageStatus;
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
