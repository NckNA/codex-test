import type { ClinicalEncounterStatus, ClinicalEncounterType } from '../../data/repositories/EncounterVisitRepository';

export const ENCOUNTER_STATUS_LABELS: Record<ClinicalEncounterStatus, string> = {
  draft: 'Черновик',
  in_progress: 'В процессе',
  completed: 'Завершён',
  locked: 'Заблокирован',
  archived: 'Архив',
};

export const ENCOUNTER_TYPE_LABELS: Record<ClinicalEncounterType, string> = {
  consultation: 'Консультация',
  treatment: 'Лечение',
  surgery: 'Хирургия',
  orthodontics: 'Ортодонтия',
  prosthetics: 'Ортопедия',
  hygiene: 'Гигиена',
  emergency: 'Экстренный',
  follow_up: 'Повторный',
  other: 'Другое',
};
