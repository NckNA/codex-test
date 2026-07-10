import type { PatientFinanceSummary } from '../../data/repositories/FinanceRepository';
import type { Patient } from '../../types';
import { formatCashierDateTime, formatCashierMoney } from './cashierLabels';

interface Props { patient: Patient | null; summary: PatientFinanceSummary | null; }

export function CashierPatientFinanceSummary({ patient, summary }: Props) {
  if (!patient) return <section data-testid="cashier-summary-no-patient" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Пациент не выбран.</section>;
  const cards = [
    ['Пациент', patient.fullName],
    ['Телефон', patient.phone || '—'],
    ['Начислено', formatCashierMoney(summary?.invoiceTotalAmount ?? 0)],
    ['Оплачено', formatCashierMoney(summary?.allocatedPaymentAmount ?? 0)],
    ['Долг', formatCashierMoney(summary?.balanceAmount ?? 0)],
    ['Переплата', formatCashierMoney(summary?.creditAmount ?? 0)],
    ['Открытые счета', String(summary?.openInvoiceCount ?? 0)],
    ['Последняя оплата', formatCashierDateTime(summary?.lastPaymentAt)],
  ];
  return (
    <section data-testid="cashier-finance-summary" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Кассовая сводка</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {cards.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p></div>)}
      </div>
    </section>
  );
}
