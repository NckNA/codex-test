import type { FinanceSummaryWarningCode, PatientFinanceSummary } from '../../data/repositories/FinanceRepository';
import { getPatientFinanceCurrencySummaries } from '../../data/repositories/FinanceRepository';
import type { Patient } from '../../types';
import { formatCashierDateTime, formatCashierMoney } from './cashierLabels';

interface Props { patient: Patient | null; summary: PatientFinanceSummary | null; }

const warningLabels: Record<FinanceSummaryWarningCode, string> = {
  PAYMENT_OVERCONSUMED: 'Платёж использован сверх доступной суммы',
  REFUND_RESERVATION_EXCEEDS_CAPACITY: 'Резерв возврата превышает остаток платежа',
  INVOICE_NEGATIVE_BALANCE: 'У счёта отрицательный остаток',
  INVOICE_PAID_MISMATCH: 'Сумма оплаты счёта требует проверки',
  INVOICE_WRITEOFF_MISMATCH: 'Сумма списания счёта требует проверки',
  INVOICE_STATUS_MISMATCH: 'Статус счёта не соответствует фактам',
  PAYMENT_STATUS_MISMATCH: 'Статус платежа не соответствует фактам',
  MULTIPLE_CURRENCIES: 'Операции пациента разделены по нескольким валютам',
};

export function CashierPatientFinanceSummary({ patient, summary }: Props) {
  if (!patient) return <section data-testid="cashier-summary-no-patient" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Пациент не выбран.</section>;
  const currencies = getPatientFinanceCurrencySummaries(summary);
  const warnings = Array.isArray(summary?.warnings) ? summary.warnings : [];

  return (
    <section data-testid="cashier-finance-summary" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Кассовая сводка</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Пациент</p><p className="mt-1 font-semibold text-slate-900">{patient.fullName}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Телефон</p><p className="mt-1 font-semibold text-slate-900">{patient.phone || '-'}</p></div>
      </div>

      {currencies.length === 0 && <p className="mt-4 text-sm text-slate-500">Финансовых операций пока нет.</p>}
      <div className="mt-4 space-y-4">
        {currencies.map((bucket) => {
          const cards = [
            ['Начислено', formatCashierMoney(bucket.totalInvoiced, bucket.currency)],
            ['Получено денег', formatCashierMoney(bucket.cashReceived, bucket.currency)],
            ['Распределено', formatCashierMoney(bucket.activeAllocatedAmount, bucket.currency)],
            ['Текущий долг', formatCashierMoney(bucket.currentDebt, bucket.currency)],
            ['Доступный кредит', formatCashierMoney(bucket.availableCreditAmount, bucket.currency)],
            ['Резерв возврата', formatCashierMoney(bucket.refundReservedAmount, bucket.currency)],
            ['Открытые счета', String(bucket.openInvoiceCount)],
            ['Последний платёж', formatCashierDateTime(bucket.lastPaymentAt)],
          ];
          return (
            <article key={bucket.currency} data-testid={`cashier-summary-currency-${bucket.currency}`} className="rounded-2xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-800">Валюта: {bucket.currency}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {cards.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p></div>)}
              </div>
            </article>
          );
        })}
      </div>

      {summary?.asOf && <p className="mt-4 text-xs text-slate-400">Срез на {formatCashierDateTime(summary.asOf)} · {summary.modelVersion}</p>}
      {warnings.length > 0 && (
        <div data-testid="cashier-summary-warnings" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {warnings.map((warning, index) => <p key={`${warning.code}:${warning.entityId ?? index}`}>{warningLabels[warning.code]}{warning.currency ? ` (${warning.currency})` : ''}</p>)}
        </div>
      )}
    </section>
  );
}
