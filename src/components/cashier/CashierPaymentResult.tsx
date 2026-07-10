import type { CashierPaymentResult } from '../../data/hooks/useCashierPaymentFlow';
import type { Patient } from '../../types';
import { cashierPaymentMethodLabels, formatCashierDateTime, formatCashierMoney, shortCashierId } from './cashierLabels';

interface Props { patient: Patient | null; result: CashierPaymentResult | null; }

export function CashierPaymentResult({ patient, result }: Props) {
  if (!result) return null;
  return (
    <section data-testid="cashier-payment-result" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-emerald-900">Результат оплаты</h2>
      <div className="mt-3 grid gap-2 text-sm text-emerald-900 md:grid-cols-2">
        <p>Пациент: <strong>{patient?.fullName ?? '—'}</strong></p>
        <p>Сумма: <strong>{formatCashierMoney(result.payment.amount, result.payment.currency)}</strong></p>
        <p>Способ оплаты: <strong>{cashierPaymentMethodLabels[result.payment.paymentMethod]}</strong></p>
        <p>Внешняя ссылка: <strong>{result.payment.externalReference || '—'}</strong></p>
        <p>Распределено: <strong>{formatCashierMoney(result.allocatedAmount, result.payment.currency)}</strong></p>
        <p>Остаток долга: <strong>{formatCashierMoney(result.remainingDebt, result.payment.currency)}</strong></p>
        <p>Переплата: <strong>{formatCashierMoney(result.unallocatedAmount, result.payment.currency)}</strong></p>
        <p>Время: <strong>{formatCashierDateTime(result.payment.receivedAt)}</strong></p>
      </div>
      <div className="mt-3 text-xs text-emerald-800">Распределения: {result.allocations.map((allocation) => shortCashierId(allocation.invoiceId)).join(', ') || '—'}</div>
    </section>
  );
}
