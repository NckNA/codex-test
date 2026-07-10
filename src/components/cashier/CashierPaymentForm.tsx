import { useState, type FormEvent } from 'react';
import type { PaymentMethod } from '../../data/repositories/FinanceRepository';
import { CASHIER_PAYMENT_METHODS, cashierPaymentMethodLabels } from './cashierLabels';

interface Props {
  disabled?: boolean;
  loading?: boolean;
  onSubmit: (input: { amount: number; paymentMethod: PaymentMethod; receivedAt?: string | null; externalReference?: string | null; payerName?: string | null; notes?: string | null }) => Promise<void>;
}

export function CashierPaymentForm({ disabled = false, loading = false, onSubmit }: Props) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [receivedAt, setReceivedAt] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [payerName, setPayerName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Сумма должна быть больше 0.'); return; }
    if (!paymentMethod) { setError('Способ оплаты обязателен.'); return; }
    try {
      await onSubmit({ amount: numericAmount, paymentMethod, receivedAt: receivedAt || null, externalReference: externalReference || null, payerName: payerName || null, notes: notes || null });
      setAmount(''); setReceivedAt(''); setExternalReference(''); setPayerName(''); setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить оплату.');
    }
  };

  return (
    <section data-testid="cashier-payment-form-section" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Оплата</h2>
      <form data-testid="cashier-payment-form" onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Сумма<input data-testid="cashier-payment-amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="text-sm font-medium text-slate-700">Способ оплаты<select data-testid="cashier-payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">{CASHIER_PAYMENT_METHODS.map((method) => <option key={method} value={method}>{cashierPaymentMethodLabels[method]}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Дата оплаты<input data-testid="cashier-payment-received-at" type="datetime-local" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="text-sm font-medium text-slate-700">Внешняя ссылка<input data-testid="cashier-payment-external-reference" value={externalReference} onChange={(event) => setExternalReference(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="text-sm font-medium text-slate-700">Плательщик<input data-testid="cashier-payment-payer-name" value={payerName} onChange={(event) => setPayerName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="text-sm font-medium text-slate-700">Примечание<input data-testid="cashier-payment-notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        {error && <p data-testid="cashier-payment-form-error" className="md:col-span-2 text-sm font-medium text-rose-600">{error}</p>}
        <button type="submit" data-testid="cashier-payment-submit" disabled={disabled || loading} className="md:col-span-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{loading ? 'Сохраняем оплату...' : 'Записать и распределить оплату'}</button>
      </form>
    </section>
  );
}
