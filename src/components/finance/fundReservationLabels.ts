import type {
  PatientFundReservationPurpose,
  PatientFundReservationStatus,
} from '../../data/repositories/FinanceRepository';

export const patientFundReservationStatusLabels: Record<PatientFundReservationStatus, string> = {
  active: 'Активен',
  partially_used: 'Частично использован',
  fully_used: 'Использован полностью',
  released: 'Освобождён',
  refunded: 'Возвращён',
  archived: 'Архив',
};

export const patientFundReservationPurposeLabels: Record<PatientFundReservationPurpose, string> = {
  general: 'Общий депозит',
  appointment: 'Под запись',
  treatment_plan: 'Под план лечения',
  service: 'Под услугу',
  other: 'Другое',
};

export function getPatientFundReservationPurposeLabel(
  purposeType: PatientFundReservationPurpose,
  purposeLabel?: string | null,
) {
  if (purposeType === 'other') return purposeLabel?.trim() || 'Другое';
  if (purposeType === 'service' && purposeLabel?.trim()) return purposeLabel.trim();
  return patientFundReservationPurposeLabels[purposeType];
}

export function isActiveFundReservationStatus(status: PatientFundReservationStatus) {
  return status === 'active' || status === 'partially_used';
}

export function isUsedFundReservationStatus(status: PatientFundReservationStatus) {
  return status === 'partially_used' || status === 'fully_used';
}

export function isTerminalFundReservationStatus(status: PatientFundReservationStatus) {
  return !isActiveFundReservationStatus(status);
}
