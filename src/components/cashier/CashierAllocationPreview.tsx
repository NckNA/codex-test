import type { Invoice } from '../../data/repositories/FinanceRepository';
import { formatCashierMoney } from './cashierLabels';

interface Props { selectedInvoices: Invoice[]; amount: number; }

export function CashierAllocationPreview({ selectedInvoices, amount }: Props) {
  const selectedBalance = selectedInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.balanceAmount), 0);
  const remaining = Math.max(0, selectedBalance - (Number.isFinite(amount) ? amount : 0));
  return (
    <section data-testid="cashier-allocation-preview" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Предпросмотр распределения</h2>
      {selectedInvoices.length === 0 ? <p className="mt-3 text-sm text-slate-500">Счёт не выбран.</p> : (
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <p>Выбрано счетов: <strong>{selectedInvoices.length}</strong></p>
          <p>Долг по выбранным счетам: <strong>{formatCashierMoney(selectedBalance)}</strong></p>
          <p>Сумма оплаты: <strong>{formatCashierMoney(Number.isFinite(amount) ? amount : 0)}</strong></p>
          <p>Остаток долга после оплаты: <strong>{formatCashierMoney(remaining)}</strong></p>
        </div>
      )}
    </section>
  );
}
