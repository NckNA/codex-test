import type { Invoice } from '../../data/repositories/FinanceRepository';
import type { FinanceActionName } from '../../data/hooks/useFinanceActions';
import { FinanceStatusBadge } from './FinanceStatusBadge';
import { formatFinanceDate, formatFinanceMoney, shortFinanceId } from './financeLabels';
import type { FinanceUserRole } from './financePermissions';
import { InvoiceActions } from './InvoiceActions';

interface InvoiceListProps {
  invoices: Invoice[];
  selectedInvoiceId: string | null;
  role: FinanceUserRole;
  actionLoading: FinanceActionName | null;
  onSelectInvoice: (invoiceId: string) => void;
  onIssueInvoice: (invoiceId: string) => Promise<void>;
  onVoidInvoice: (invoiceId: string, reason: string) => Promise<void>;
}

function InvoiceField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-700">{value === undefined || value === null || value === '' ? '—' : value}</dd>
    </div>
  );
}

export function InvoiceList({ invoices, selectedInvoiceId, role, actionLoading, onSelectInvoice, onIssueInvoice, onVoidInvoice }: InvoiceListProps) {
  return (
    <section data-testid="finance-invoice-list" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Счета</h3>
      {invoices.length === 0 && <p data-testid="finance-invoices-empty" className="mt-4 text-sm text-slate-500">Счетов пока нет.</p>}
      <div className="mt-4 space-y-4">
        {invoices.map((invoice) => (
          <article key={invoice.id} data-testid={`finance-invoice-card-${invoice.id}`} className={`rounded-2xl border p-4 ${selectedInvoiceId === invoice.id ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <FinanceStatusBadge kind="invoice" status={invoice.status} />
                  <button type="button" data-testid={`finance-select-invoice-${invoice.id}`} onClick={() => onSelectInvoice(invoice.id)} className="text-sm font-semibold text-blue-700 hover:text-blue-900">
                    {invoice.invoiceNumber || `Счёт ${shortFinanceId(invoice.id)}`}
                  </button>
                </div>
                {invoice.notes && <p className="mt-2 text-sm text-slate-500">{invoice.notes}</p>}
              </div>
              <div className="text-left text-sm font-semibold text-slate-900 sm:text-right">{formatFinanceMoney(invoice.totalAmount, invoice.currency)}</div>
            </div>
            <dl className="mt-4 grid gap-4 md:grid-cols-4">
              <InvoiceField label="Выставлен" value={formatFinanceDate(invoice.issueDate || invoice.issuedAt)} />
              <InvoiceField label="Срок оплаты" value={formatFinanceDate(invoice.dueDate)} />
              <InvoiceField label="Оплачено" value={formatFinanceMoney(invoice.paidAmount, invoice.currency)} />
              <InvoiceField label="Остаток" value={formatFinanceMoney(invoice.balanceAmount, invoice.currency)} />
              <InvoiceField label="Валюта" value={invoice.currency} />
            </dl>
            <InvoiceActions invoice={invoice} role={role} actionLoading={actionLoading} onIssue={onIssueInvoice} onVoid={onVoidInvoice} />
          </article>
        ))}
      </div>
    </section>
  );
}
