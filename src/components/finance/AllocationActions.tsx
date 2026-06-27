import { useMemo, useState, type FormEvent } from 'react';
import type { Invoice, InvoiceItem, Payment, PaymentAllocation } from '../../data/repositories/FinanceRepository';
import type { AllocatePaymentActionInput, FinanceActionName } from '../../data/hooks/useFinanceActions';
import { FinanceStatusBadge } from './FinanceStatusBadge';
import { allocationStatusLabels, formatFinanceDateTime, formatFinanceMoney, shortFinanceId } from './financeLabels';
import { getFinanceRoleCapabilities, type FinanceUserRole } from './financePermissions';

interface AllocationActionsProps {
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  payments: Payment[];
  allocations: PaymentAllocation[];
  role: FinanceUserRole;
  actionLoading: FinanceActionName | null;
  onAllocatePayment: (input: AllocatePaymentActionInput) => Promise<void>;
  onVoidAllocation: (allocationId: string, reason: string) => Promise<void>;
}

function allocatedAmount(paymentId: string, allocations: PaymentAllocation[]) {
  return allocations.filter((allocation) => allocation.paymentId === paymentId && allocation.status === 'active').reduce((total, allocation) => total + allocation.amount, 0);
}

export function AllocationActions({ invoices, invoiceItems, payments, allocations, role, actionLoading, onAllocatePayment, onVoidAllocation }: AllocationActionsProps) {
  const capabilities = getFinanceRoleCapabilities(role);
  const [paymentId, setPaymentId] = useState('');
  const [targetKind, setTargetKind] = useState<'invoice' | 'item'>('invoice');
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceItemId, setInvoiceItemId] = useState('');
  const [amount, setAmount] = useState('');
  const [voidAllocationId, setVoidAllocationId] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const isBusy = actionLoading !== null;

  const paymentsWithAvailableAmount = useMemo(() => payments.filter((payment) => {
    if (['voided', 'archived'].includes(payment.status)) return false;
    return payment.amount - allocatedAmount(payment.id, allocations) > 0;
  }), [allocations, payments]);

  const handleAllocate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const parsedAmount = Number(amount);
    if (!paymentId) { setFormError('Платёж не выбран.'); return; }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { setFormError('Сумма должна быть больше 0.'); return; }
    if (targetKind === 'invoice' && !invoiceId) { setFormError('Счёт не выбран.'); return; }
    if (targetKind === 'item' && !invoiceItemId) { setFormError('Нужно выбрать счёт или позицию счёта.'); return; }
    try {
      await onAllocatePayment({ paymentId, amount: parsedAmount, invoiceId: targetKind === 'invoice' ? invoiceId : null, invoiceItemId: targetKind === 'item' ? invoiceItemId : null });
      setPaymentId('');
      setInvoiceId('');
      setInvoiceItemId('');
      setAmount('');
      setTargetKind('invoice');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось выполнить финансовую операцию.');
    }
  };

  const handleVoid = async () => {
    setFormError(null);
    if (!voidAllocationId) { setFormError('Распределение платежа не выбрано.'); return; }
    if (!voidReason.trim()) { setFormError('Причина обязательна.'); return; }
    try {
      await onVoidAllocation(voidAllocationId, voidReason);
      setVoidAllocationId('');
      setVoidReason('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось выполнить финансовую операцию.');
    }
  };

  return (
    <section data-testid="finance-allocation-list" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Распределения оплат</h3>

      {capabilities.canAllocatePayment && (
        <form data-testid="finance-allocation-form" onSubmit={handleAllocate} className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-800">Распределить оплату</h4>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <select data-testid="finance-allocation-payment" value={paymentId} onChange={(event) => setPaymentId(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Оплата</option>
              {paymentsWithAvailableAmount.map((payment) => <option key={payment.id} value={payment.id}>{formatFinanceMoney(payment.amount - allocatedAmount(payment.id, allocations), payment.currency)} · {shortFinanceId(payment.id)}</option>)}
            </select>
            <select value={targetKind} onChange={(event) => setTargetKind(event.target.value as 'invoice' | 'item')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="invoice">На счёт</option>
              <option value="item">На позицию</option>
            </select>
            {targetKind === 'invoice' ? (
              <select data-testid="finance-allocation-invoice" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Счёт</option>
                {invoices.filter((invoice) => !['voided', 'archived', 'paid'].includes(invoice.status)).map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber || shortFinanceId(invoice.id)} · {formatFinanceMoney(invoice.balanceAmount, invoice.currency)}</option>)}
              </select>
            ) : (
              <select data-testid="finance-allocation-item" value={invoiceItemId} onChange={(event) => setInvoiceItemId(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Позиция</option>
                {invoiceItems.filter((item) => item.status === 'active').map((item) => <option key={item.id} value={item.id}>{item.serviceName} · {formatFinanceMoney(item.totalAmount)}</option>)}
              </select>
            )}
            <input data-testid="finance-allocation-amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Сумма" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          {formError && <p data-testid="finance-allocation-form-error" className="mt-3 text-sm font-medium text-rose-600">{formError}</p>}
          <button type="submit" data-testid="finance-allocation-submit" disabled={isBusy} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{actionLoading === 'allocatePayment' ? 'Распределяем...' : 'Распределить'}</button>
        </form>
      )}

      {capabilities.canVoid && allocations.length > 0 && (
        <div data-testid="finance-void-allocation-box" className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-4">
          <h4 className="text-sm font-semibold text-rose-800">Аннулировать распределение</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <select value={voidAllocationId} onChange={(event) => setVoidAllocationId(event.target.value)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm">
              <option value="">Выберите распределение</option>
              {allocations.filter((allocation) => allocation.status === 'active').map((allocation) => <option key={allocation.id} value={allocation.id}>{formatFinanceMoney(allocation.amount, allocation.currency)} · {shortFinanceId(allocation.id)}</option>)}
            </select>
            <input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Причина аннулирования" className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm" />
          </div>
          <button type="button" data-testid="finance-void-allocation-submit" disabled={isBusy || !voidAllocationId || !voidReason.trim()} onClick={() => { void handleVoid(); }} className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">Аннулировать распределение</button>
        </div>
      )}

      {allocations.length === 0 && <p data-testid="finance-allocations-empty" className="mt-4 text-sm text-slate-500">Распределений пока нет.</p>}
      <div className="mt-4 space-y-3">
        {allocations.map((allocation) => (
          <article key={allocation.id} data-testid={`finance-allocation-card-${allocation.id}`} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <FinanceStatusBadge kind="allocation" status={allocation.status} />
              <span className="text-sm font-semibold text-slate-900">{formatFinanceMoney(allocation.amount, allocation.currency)}</span>
              <span className="text-xs text-slate-400">{allocationStatusLabels[allocation.status]}</span>
            </div>
            <dl className="mt-4 grid gap-4 md:grid-cols-4 text-sm text-slate-700">
              <div><dt className="text-xs uppercase tracking-wide text-slate-400">Дата</dt><dd>{formatFinanceDateTime(allocation.allocatedAt)}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-slate-400">Оплата</dt><dd>{shortFinanceId(allocation.paymentId)}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-slate-400">Счёт</dt><dd>{shortFinanceId(allocation.invoiceId)}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-slate-400">Позиция</dt><dd>{shortFinanceId(allocation.invoiceItemId)}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
