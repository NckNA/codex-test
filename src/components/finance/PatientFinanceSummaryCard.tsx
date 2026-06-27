import type { PatientFinanceSummary } from '../../data/repositories/FinanceRepository';
import { formatFinanceDateTime, formatFinanceMoney } from './financeLabels';

interface PatientFinanceSummaryCardProps {
  summary: PatientFinanceSummary | null;
}

function SummaryCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

export function PatientFinanceSummaryCard({ summary }: PatientFinanceSummaryCardProps) {
  const currency = 'KZT';

  return (
    <section data-testid="patient-finance-summary-card" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Финансовая сводка</h2>
        <p className="mt-1 text-sm text-slate-500">Сводка рассчитывается по финансовым операциям пациента.</p>
      </div>

      <dl className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <SummaryCell label="Начислено" value={formatFinanceMoney(summary?.invoiceTotalAmount, currency)} />
        <SummaryCell label="Оплачено" value={formatFinanceMoney(summary?.allocatedPaymentAmount ?? summary?.paidAmount, currency)} />
        <SummaryCell label="Возвраты" value={formatFinanceMoney(summary?.refundedAmount, currency)} />
        <SummaryCell label="Долг" value={formatFinanceMoney(summary?.balanceAmount, currency)} />
        <SummaryCell label="Переплата" value={formatFinanceMoney(summary?.creditAmount, currency)} />
        <SummaryCell label="Открытые счета" value={summary?.openInvoiceCount ?? 0} />
        <SummaryCell label="Неоплаченные" value={summary?.unpaidInvoiceCount ?? 0} />
        <SummaryCell label="Частично оплаченные" value={summary?.partiallyPaidInvoiceCount ?? 0} />
        <SummaryCell label="Последняя оплата" value={formatFinanceDateTime(summary?.lastPaymentAt)} />
      </dl>
    </section>
  );
}
