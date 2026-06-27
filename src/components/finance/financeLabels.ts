import type { InvoiceItemStatus, InvoiceStatus, PaymentMethod, PaymentStatus } from '../../data/repositories/FinanceRepository';

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: 'Черновик',
  issued: 'Выставлен',
  partially_paid: 'Частично оплачен',
  paid: 'Оплачен',
  voided: 'Аннулирован',
  written_off: 'Списан',
  archived: 'Архив',
};

export const invoiceItemStatusLabels: Record<InvoiceItemStatus, string> = {
  active: 'Активна',
  voided: 'Аннулирована',
  adjusted: 'Скорректирована',
  archived: 'Архив',
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  received: 'Получена',
  allocated: 'Распределена',
  partially_allocated: 'Частично распределена',
  refunded: 'Возвращена',
  partially_refunded: 'Частично возвращена',
  voided: 'Аннулирована',
  archived: 'Архив',
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Наличные',
  kaspi: 'Kaspi',
  halyk_terminal: 'Halyk терминал',
  card: 'Карта',
  bank_transfer: 'Банковский перевод',
  insurance: 'Страховка',
  osms: 'ОСМС',
  mixed: 'Смешанная оплата',
  other: 'Другое',
};

export const allocationStatusLabels: Record<'active' | 'voided' | 'archived', string> = {
  active: 'Активно',
  voided: 'Аннулировано',
  archived: 'Архив',
};

export function formatFinanceMoney(amount?: number | null, currency = 'KZT') {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return `${new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

export function formatFinanceDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatFinanceDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function shortFinanceId(value?: string | null) {
  if (!value) return '—';
  return value.length <= 8 ? value : value.slice(0, 8);
}
