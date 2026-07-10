import type { FinanceSummaryWarningCode, PatientFinanceSummary } from '../../data/repositories/FinanceRepository';
import { getPatientFinanceCurrencySummaries } from '../../data/repositories/FinanceRepository';
import { formatFinanceDateTime, formatFinanceMoney } from './financeLabels';

interface PatientFinanceSummaryCardProps {
  summary: PatientFinanceSummary | null;
}

const warningLabels: Record<FinanceSummaryWarningCode, string> = {
  PAYMENT_OVERCONSUMED: 'Платёж использован сверх доступной суммы',
  REFUND_RESERVATION_EXCEEDS_CAPACITY: 'Возврат зарезервирован сверх доступной суммы',
  INVOICE_NEGATIVE_BALANCE: 'У счёта отрицательный остаток',
  INVOICE_PAID_MISMATCH: 'Оплаченная сумма счёта не совпадает с распределениями',
  INVOICE_WRITEOFF_MISMATCH: 'Списание счёта не совпадает с подтверждёнными решениями',
  INVOICE_STATUS_MISMATCH: 'Статус счёта не соответствует финансовым фактам',
  PAYMENT_STATUS_MISMATCH: 'Статус платежа не соответствует его использованию',
  MULTIPLE_CURRENCIES: 'У пациента есть операции в нескольких валютах',
};

function SummaryCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

export function PatientFinanceSummaryCard({ summary }: PatientFinanceSummaryCardProps) {
  const currencies = getPatientFinanceCurrencySummaries(summary);
  const warnings = Array.isArray(summary?.warnings) ? summary.warnings : [];

  return (
    <section data-testid="patient-finance-summary-card" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Финансовая сводка</h2>
        <p className="mt-1 text-sm text-slate-500">Полный серверный срез финансовых фактов пациента без ограничения по количеству записей.</p>
        {summary?.asOf && (
          <p data-testid="patient-finance-summary-metadata" className="mt-2 text-xs text-slate-400">
            На {formatFinanceDateTime(summary.asOf)} · модель {summary.modelVersion} · {summary.factComplete ? 'данные полные' : 'данные неполные'}
          </p>
        )}
      </div>

      {currencies.length === 0 && <p className="mt-5 text-sm text-slate-500">Финансовых операций пока нет.</p>}

      <div className="mt-5 space-y-5">
        {currencies.map((bucket) => (
          <article key={bucket.currency} data-testid={`patient-finance-summary-currency-${bucket.currency}`} className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-base font-semibold text-slate-800">Валюта: {bucket.currency}</h3>
            <dl className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              <SummaryCell label="Начислено" value={formatFinanceMoney(bucket.totalInvoiced, bucket.currency)} />
              <SummaryCell label="Денежные поступления" value={formatFinanceMoney(bucket.cashReceived, bucket.currency)} />
              <SummaryCell label="Распределено" value={formatFinanceMoney(bucket.activeAllocatedAmount, bucket.currency)} />
              <SummaryCell label="Завершённые возвраты" value={formatFinanceMoney(bucket.completedRefundAmount, bucket.currency)} />
              <SummaryCell label="Подтверждённые списания" value={formatFinanceMoney(bucket.approvedWriteOffAmount, bucket.currency)} />
              <SummaryCell label="Текущий долг" value={formatFinanceMoney(bucket.currentDebt, bucket.currency)} />
              <SummaryCell label="Нераспределено всего" value={formatFinanceMoney(bucket.grossUnallocatedAmount, bucket.currency)} />
              <SummaryCell label="Зарезервировано на возврат" value={formatFinanceMoney(bucket.refundReservedAmount, bucket.currency)} />
              <SummaryCell label="Доступный кредит" value={formatFinanceMoney(bucket.availableCreditAmount, bucket.currency)} />
              <SummaryCell label="Чистая позиция" value={formatFinanceMoney(bucket.netPositionAmount, bucket.currency)} />
              <SummaryCell label="Открытые счета" value={bucket.openInvoiceCount} />
              <SummaryCell label="Неоплаченные" value={bucket.unpaidInvoiceCount} />
              <SummaryCell label="Частично оплаченные" value={bucket.partiallyPaidInvoiceCount} />
              <SummaryCell label="Последний платёж" value={formatFinanceDateTime(bucket.lastPaymentAt)} />
            </dl>
          </article>
        ))}
      </div>

      {warnings.length > 0 && (
        <div data-testid="patient-finance-summary-warnings" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-900">Требуется проверка финансовых данных</h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {warnings.map((warning, index) => (
              <li key={`${warning.code}:${warning.entityId ?? index}`}>{warningLabels[warning.code]}{warning.currency ? ` (${warning.currency})` : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
