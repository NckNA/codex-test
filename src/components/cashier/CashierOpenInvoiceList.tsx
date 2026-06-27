import type { Invoice, InvoiceItem } from '../../data/repositories/FinanceRepository';
import { formatCashierDateTime, formatCashierMoney, shortCashierId } from './cashierLabels';
import { invoiceStatusLabels } from '../finance/financeLabels';

interface Props {
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  selectedInvoiceIds: string[];
  onSelectInvoice: (invoiceId: string, selected: boolean) => void;
}

export function CashierOpenInvoiceList({ invoices, invoiceItems, selectedInvoiceIds, onSelectInvoice }: Props) {
  return (
    <section data-testid="cashier-open-invoice-list" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Открытые счета</h2>
      <p className="mt-1 text-sm text-slate-500">Выберите счёт для оплаты. Аннулирование в кассовом рабочем месте не показывается.</p>
      {invoices.length === 0 && <p data-testid="cashier-open-invoices-empty" className="mt-4 text-sm text-slate-500">Открытых счетов нет.</p>}
      <div className="mt-4 space-y-3">
        {invoices.map((invoice) => {
          const checked = selectedInvoiceIds.includes(invoice.id);
          const items = invoiceItems.filter((item) => item.invoiceId === invoice.id && item.status === 'active');
          return (
            <article key={invoice.id} data-testid={`cashier-invoice-card-${invoice.id}`} className={`rounded-2xl border p-4 ${checked ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200'}`}>
              <label className="flex items-start gap-3">
                <input data-testid={`cashier-select-invoice-${invoice.id}`} type="checkbox" checked={checked} onChange={(event) => onSelectInvoice(invoice.id, event.target.checked)} className="mt-1" />
                <span className="flex-1">
                  <span className="block font-semibold text-slate-900">Счёт {invoice.invoiceNumber || shortCashierId(invoice.id)}</span>
                  <span className="mt-1 block text-sm text-slate-500">Статус: {invoiceStatusLabels[invoice.status]} · К оплате: {formatCashierMoney(invoice.balanceAmount, invoice.currency)}</span>
                  <span className="mt-1 block text-xs text-slate-400">Всего: {formatCashierMoney(invoice.totalAmount, invoice.currency)} · Оплачено: {formatCashierMoney(invoice.paidAmount, invoice.currency)} · Срок: {formatCashierDateTime(invoice.dueDate)}</span>
                  {invoice.notes && <span className="mt-1 block text-xs text-slate-500">{invoice.notes}</span>}
                  {items.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-slate-500">{items.map((item) => <li key={item.id}>{item.serviceName} · {formatCashierMoney(item.totalAmount, invoice.currency)}</li>)}</ul>}
                </span>
              </label>
            </article>
          );
        })}
      </div>
    </section>
  );
}
