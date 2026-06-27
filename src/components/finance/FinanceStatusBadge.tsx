import type { InvoiceItemStatus, InvoiceStatus, PaymentStatus } from '../../data/repositories/FinanceRepository';
import { allocationStatusLabels, invoiceItemStatusLabels, invoiceStatusLabels, paymentStatusLabels } from './financeLabels';

export type FinanceBadgeStatus = InvoiceStatus | InvoiceItemStatus | PaymentStatus | 'active';

type FinanceBadgeKind = 'invoice' | 'invoiceItem' | 'payment' | 'allocation';

interface FinanceStatusBadgeProps {
  kind: FinanceBadgeKind;
  status: FinanceBadgeStatus;
}

function badgeTone(status: FinanceBadgeStatus) {
  if (status === 'paid' || status === 'allocated' || status === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'partially_paid' || status === 'partially_allocated' || status === 'issued') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'draft' || status === 'received' || status === 'adjusted') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'voided') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function statusLabel(kind: FinanceBadgeKind, status: FinanceBadgeStatus) {
  if (kind === 'invoice') return invoiceStatusLabels[status as InvoiceStatus] ?? status;
  if (kind === 'invoiceItem') return invoiceItemStatusLabels[status as InvoiceItemStatus] ?? status;
  if (kind === 'payment') return paymentStatusLabels[status as PaymentStatus] ?? status;
  return allocationStatusLabels[status as 'active' | 'voided' | 'archived'] ?? status;
}

export function FinanceStatusBadge({ kind, status }: FinanceStatusBadgeProps) {
  return (
    <span data-testid={`finance-status-${kind}-${status}`} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeTone(status)}`}>
      {statusLabel(kind, status)}
    </span>
  );
}
