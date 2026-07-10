import type { FinancialAdjustmentStatus, RefundMethod, RefundStatus } from '../../data/repositories/FinanceRepository';

export const refundMethodLabels: Record<RefundMethod, string> = {
  cash: 'Наличные',
  kaspi: 'Kaspi',
  halyk_terminal: 'Halyk терминал',
  card: 'Карта',
  bank_transfer: 'Банковский перевод',
  other: 'Другое',
};

export const refundStatusLabels: Record<RefundStatus, string> = {
  pending: 'Ожидает одобрения',
  approved: 'Одобрен',
  completed: 'Завершён',
  rejected: 'Отклонён',
  voided: 'Отменён',
  archived: 'Архивный',
};

export const writeOffStatusLabels: Record<FinancialAdjustmentStatus, string> = {
  active: 'Ожидает одобрения',
  approved: 'Одобрено',
  rejected: 'Отклонено',
  voided: 'Отменено',
  archived: 'Архивное',
};

export function safeRefundUnavailableReason(input: {
  refundableAmount: number;
  activeAllocatedAmount: number;
  completedRefundAmount: number;
  reservedRefundAmount: number;
}) {
  if (input.activeAllocatedAmount > 0) return 'Возврат недоступен: средства распределены по счетам. Сначала отмените распределение платежа по счёту.';
  if (input.reservedRefundAmount > 0) return 'Возврат недоступен: сумма зарезервирована действующей заявкой.';
  if (input.completedRefundAmount > 0 && input.refundableAmount <= 0) return 'Возврат недоступен: сумма уже возвращена.';
  return 'Возврат недоступен.';
}

export function safeWriteOffUnavailableReason(reason?: string | null) {
  const lower = reason?.toLowerCase() ?? '';
  if (lower.includes('draft')) return 'Черновой счёт нельзя списать.';
  if (lower.includes('paid')) return 'Оплаченный счёт нельзя списать.';
  if (lower.includes('void')) return 'Счёт уже аннулирован.';
  if (lower.includes('archiv')) return 'Архивный счёт нельзя списать.';
  if (lower.includes('reserved') || lower.includes('active')) return 'Есть действующая заявка на списание.';
  return 'Весь доступный долг уже списан или зарезервирован.';
}
