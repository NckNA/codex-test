import type { Payment } from '../../data/repositories/FinanceRepository';
import type { FinanceActionName, RecordPaymentActionInput } from '../../data/hooks/useFinanceActions';
import { FinanceStatusBadge } from './FinanceStatusBadge';
import { formatFinanceDateTime, formatFinanceMoney, paymentMethodLabels, shortFinanceId } from './financeLabels';
import type { FinanceUserRole } from './financePermissions';
import { PaymentActions } from './PaymentActions';

interface PaymentListProps {
  payments: Payment[];
  role: FinanceUserRole;
  actionLoading: FinanceActionName | null;
  onRecordPayment: (input: RecordPaymentActionInput) => Promise<void>;
  onVoidPayment: (paymentId: string, reason: string) => Promise<void>;
}

function PaymentField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-700">{value === undefined || value === null || value === '' ? '—' : value}</dd>
    </div>
  );
}

export function PaymentList({ payments, role, actionLoading, onRecordPayment, onVoidPayment }: PaymentListProps) {
  return (
    <section data-testid="finance-payment-list" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Оплаты</h3>
      <PaymentActions payments={payments} role={role} actionLoading={actionLoading} onRecordPayment={onRecordPayment} onVoidPayment={onVoidPayment} />
      {payments.length === 0 && <p data-testid="finance-payments-empty" className="mt-4 text-sm text-slate-500">Оплат пока нет.</p>}
      <div className="mt-4 space-y-3">
        {payments.map((payment) => (
          <article key={payment.id} data-testid={`finance-payment-card-${payment.id}`} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <FinanceStatusBadge kind="payment" status={payment.status} />
                <span className="text-sm font-semibold text-slate-900">{paymentMethodLabels[payment.paymentMethod]}</span>
                <span className="text-xs text-slate-400">#{shortFinanceId(payment.id)}</span>
              </div>
              <div className="text-sm font-semibold text-slate-900">{formatFinanceMoney(payment.amount, payment.currency)}</div>
            </div>
            <dl className="mt-4 grid gap-4 md:grid-cols-4">
              <PaymentField label="Дата" value={formatFinanceDateTime(payment.receivedAt)} />
              <PaymentField label="Плательщик" value={payment.payerName} />
              <PaymentField label="Внешняя ссылка" value={payment.externalReference} />
              <PaymentField label="Примечание" value={payment.notes} />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
