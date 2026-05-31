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
