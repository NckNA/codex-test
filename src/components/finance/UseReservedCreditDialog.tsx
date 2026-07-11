/* eslint-disable react-hooks/set-state-in-effect -- opening a dialog intentionally resets stale patient form values */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Invoice, PatientFundReservation } from '../../data/repositories/FinanceRepository';
import type { UseReservedCreditValues } from '../../data/hooks/usePatientFundReservationFlow';
import { formatFinanceMoney } from './financeLabels';
import { getPatientFundReservationPurposeLabel } from './fundReservationLabels';

interface UseReservedCreditDialogProps {
  open: boolean;
  reservation: PatientFundReservation | null;
  invoices: Invoice[];
  pending?: boolean;
  actionMessage?: string | null;
  onClose: () => void;
  onSubmit: (values: UseReservedCreditValues) => Promise<unknown> | unknown;
}

function parseAmount(value: string) {
  const amount = Number(value.replace(',', '.'));
  return Number.isFinite(amount) ? amount : Number.NaN;
}

export function UseReservedCreditDialog({
  open,
  reservation,
  invoices,
  pending = false,
  actionMessage,
  onClose,
  onSubmit,
}: UseReservedCreditDialogProps) {
  const eligibleInvoices = useMemo(() => {
    if (!reservation) return [];
    return invoices.filter((invoice) => (
      invoice.tenantId === reservation.tenantId
      && invoice.patientId === reservation.patientId
      && invoice.currency === reservation.currency
      && ['issued', 'partially_paid'].includes(invoice.status)
      && invoice.balanceAmount > 0
    ));
  }, [invoices, reservation]);
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open, pending]);

  useEffect(() => {
    if (!open) return;
    setInvoiceId(eligibleInvoices[0]?.id ?? '');
    setAmount('');
    setValidationError(null);
  }, [eligibleInvoices, open, reservation?.id]);

  if (!open || !reservation) return null;
  const invoice = eligibleInvoices.find((candidate) => candidate.id === invoiceId) ?? null;
  const parsedAmount = parseAmount(amount);
  const remainingAfter = Number.isFinite(parsedAmount)
    ? Math.max(0, reservation.remainingAmount - parsedAmount)
    : reservation.remainingAmount;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    if (!invoice) {
      setValidationError('Выбранный счёт недоступен для использования депозита.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setValidationError('Сумма должна быть больше 0.');
      return;
    }
    if (parsedAmount > reservation.remainingAmount || parsedAmount > invoice.balanceAmount) {
      setValidationError('Сумма превышает доступный остаток депозита или долг по счёту.');
      return;
    }
    await onSubmit({ reservationId: reservation.id, invoiceId: invoice.id, amount: parsedAmount });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" data-testid="use-reserved-credit-dialog-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="use-reserved-credit-title" data-testid="use-reserved-credit-dialog" className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <h3 id="use-reserved-credit-title" className="text-lg font-semibold text-slate-900">Использовать депозит</h3>
        <p className="mt-1 text-sm text-slate-500">Распределяется ранее полученный кредит. Новая оплата не принимается.</p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p><span className="text-slate-500">Назначение:</span> <strong>{getPatientFundReservationPurposeLabel(reservation.purposeType, reservation.purposeLabel)}</strong></p>
          <p className="mt-1"><span className="text-slate-500">Остаток:</span> <strong>{formatFinanceMoney(reservation.remainingAmount, reservation.currency)}</strong></p>
        </div>

        {eligibleInvoices.length === 0 ? (
          <p data-testid="use-reserved-credit-no-invoices" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Нет доступных счетов с задолженностью в валюте депозита.</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-slate-700" htmlFor="use-reserved-credit-invoice">Счёт
              <select id="use-reserved-credit-invoice" data-testid="use-reserved-credit-invoice" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} disabled={pending} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {eligibleInvoices.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.invoiceNumber || candidate.id.slice(0, 8)} · долг {formatFinanceMoney(candidate.balanceAmount, candidate.currency)}</option>
                ))}
              </select>
            </label>
            {invoice && (
              <p data-testid="use-reserved-credit-invoice-balance" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Долг по счёту: <strong>{formatFinanceMoney(invoice.balanceAmount, invoice.currency)}</strong></p>
            )}
            <label className="block text-sm font-medium text-slate-700" htmlFor="use-reserved-credit-amount">Сумма
              <input id="use-reserved-credit-amount" data-testid="use-reserved-credit-amount" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={pending} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <p data-testid="use-reserved-credit-remaining" className="text-sm text-slate-600">Останется в резерве: <strong>{formatFinanceMoney(remainingAfter, reservation.currency)}</strong></p>
            {(validationError || actionMessage) && (
              <p data-testid="use-reserved-credit-message" aria-live="polite" className={`rounded-lg p-3 text-sm ${validationError ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-800'}`}>{validationError || actionMessage}</p>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} disabled={pending} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-50">Отмена</button>
              <button type="submit" data-testid="use-reserved-credit-submit" disabled={pending || eligibleInvoices.length === 0} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Проверяем…' : 'Использовать депозит'}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
