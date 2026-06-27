import type { PaymentMethod } from '../../data/repositories/FinanceRepository';

export const cashierPaymentMethodLabels: Record<PaymentMethod, string> = {
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

export const CASHIER_PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'kaspi',
  'halyk_terminal',
  'card',
  'bank_transfer',
  'insurance',
  'osms',
  'mixed',
  'other',
];

export function formatCashierMoney(amount?: number | null, currency = 'KZT') {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return `${new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

export function formatCashierDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function shortCashierId(value?: string | null) {
  if (!value) return '—';
  return value.length <= 8 ? value : value.slice(0, 8);
}
