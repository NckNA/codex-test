import type { PatientVisitStatus, PatientVisitType } from '../../data/repositories/EncounterVisitRepository';

export const VISIT_STATUS_LABELS: Record<PatientVisitStatus, string> = {
  checked_in: 'Ожидает приёма',
  in_progress: 'На приёме',
  completed: 'Визит завершён',
  cancelled: 'Визит отменён',
  archived: 'Архив',
};

export const VISIT_TYPE_LABELS: Record<PatientVisitType, string> = {
  regular: 'Обычный',
  emergency: 'Экстренный',
  consultation: 'Консультация',
  follow_up: 'Повторный',
  procedure: 'Процедура',
  other: 'Другое',
};
