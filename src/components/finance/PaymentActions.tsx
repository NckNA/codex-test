import { useState, type FormEvent } from 'react';
import type { Payment, PaymentMethod } from '../../data/repositories/FinanceRepository';
import type { FinanceActionName, RecordPaymentActionInput } from '../../data/hooks/useFinanceActions';
import { paymentMethodLabels } from './financeLabels';
import { getFinanceRoleCapabilities, type FinanceUserRole } from './financePermissions';

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'kaspi', 'halyk_terminal', 'card', 'bank_transfer', 'insurance', 'osms', 'mixed', 'other'];

interface PaymentActionsProps {
  payments: Payment[];
  role: FinanceUserRole;
  actionLoading: FinanceActionName | null;
  onRecordPayment: (input: RecordPaymentActionInput) => Promise<void>;
  onVoidPayment: (paymentId: string, reason: string) => Promise<void>;
}

export function PaymentActions({ payments, role, actionLoading, onRecordPayment, onVoidPayment }: PaymentActionsProps) {
  const capabilities = getFinanceRoleCapabilities(role);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [currency, setCurrency] = useState('KZT');
  const [receivedAt, setReceivedAt] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [payerName, setPayerName] = useState('');
  const [notes, setNotes] = useState('');
  const [voidPaymentId, setVoidPaymentId] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const isBusy = actionLoading !== null;

  const resetPaymentForm = () => {
    setAmount('');
    setPaymentMethod('cash');
    setCurrency('KZT');
    setReceivedAt('');
    setExternalReference('');
    setPayerName('');
    setNotes('');
  };

  const handleRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Сумма должна быть больше 0.');
      return;
    }
    if (!paymentMethod) {
      setFormError('Способ оплаты обязателен.');
      return;
    }
    try {
      await onRecordPayment({
        amount: parsedAmount,
        paymentMethod,
        currency: currency.trim() || 'KZT',
        receivedAt: receivedAt || null,
        externalReference,
        payerName,
        notes,
      });
      resetPaymentForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось выполнить финансовую операцию.');
    }
  };

  const handleVoid = async () => {
    setFormError(null);
    if (!voidPaymentId) {
      setFormError('Платёж не выбран.');
      return;
    }
    if (!voidReason.trim()) {
      setFormError('Причина обязательна.');
      return;
    }
    try {
      await onVoidPayment(voidPaymentId, voidReason);
      setVoidPaymentId('');
      setVoidReason('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось выполнить финансовую операцию.');
    }
  };

  if (!capabilities.canRecordPayment && !capabilities.canVoid) return null;

  return (
    <div className="mt-5 space-y-4">
      {capabilities.canRecordPayment && (
        <form data-testid="finance-record-payment-form" onSubmit={handleRecord} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-800">Принять оплату</h4>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Сумма<input data-testid="finance-payment-amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-medium text-slate-700">Способ оплаты<select data-testid="finance-payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{paymentMethodLabels[method]}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Валюта<input value={currency} onChange={(event) => setCurrency(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-medium text-slate-700">Дата оплаты<input type="datetime-local" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-medium text-slate-700">Внешняя ссылка<input data-testid="finance-payment-external-reference" value={externalReference} onChange={(event) => setExternalReference(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-medium text-slate-700">Плательщик<input value={payerName} onChange={(event) => setPayerName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-medium text-slate-700 md:col-span-3">Примечание<input value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          </div>
          {formError && <p data-testid="finance-payment-form-error" className="mt-3 text-sm font-medium text-rose-600">{formError}</p>}
          <button type="submit" data-testid="finance-record-payment-submit" disabled={isBusy} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{actionLoading === 'recordPayment' ? 'Сохраняем...' : 'Сохранить оплату'}</button>
        </form>
      )}

      {capabilities.canVoid && payments.length > 0 && (
        <div data-testid="finance-void-payment-box" className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
          <h4 className="text-sm font-semibold text-rose-800">Аннулировать оплату</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <select data-testid="finance-void-payment-select" value={voidPaymentId} onChange={(event) => setVoidPaymentId(event.target.value)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm">
              <option value="">Выберите оплату</option>
              {payments.filter((payment) => !['voided', 'archived'].includes(payment.status)).map((payment) => <option key={payment.id} value={payment.id}>{paymentMethodLabels[payment.paymentMethod]} · {payment.amount} {payment.currency}</option>)}
            </select>
            <input data-testid="finance-void-payment-reason" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Причина аннулирования" className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm" />
          </div>
          <button type="button" data-testid="finance-void-payment-submit" disabled={isBusy || !voidPaymentId || !voidReason.trim()} onClick={() => { void handleVoid(); }} className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">Аннулировать оплату</button>
        </div>
      )}
    </div>
  );
}
