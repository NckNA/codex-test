import type { CompletedServiceStatus } from '../../data/repositories/EncounterVisitRepository';

export const COMPLETED_SERVICE_STATUS_LABELS: Record<CompletedServiceStatus, string> = {
  completed: 'Выполнена',
  corrected: 'Исправлена',
  voided: 'Аннулирована',
  archived: 'Архив',
};

export function formatCompletedServiceMoney(amount?: number | null, currency = 'KZT') {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '—';
  return `${amount.toLocaleString('ru-RU')} ${currency || 'KZT'}`;
}
