import { useRef, useState, type FormEvent } from 'react';
import type { CashierOperationStatus, CashierPaymentInput } from '../../data/hooks/useCashierPaymentFlow';
import type { PaymentMethod } from '../../data/repositories/FinanceRepository';
import { CASHIER_PAYMENT_METHODS, cashierPaymentMethodLabels } from './cashierLabels';

interface Props {
  disabled?: boolean;
  loading?: boolean;
  operationStatus?: CashierOperationStatus;
  onSubmit: (input: CashierPaymentInput) => Promise<unknown>;
  onRetry?: () => Promise<unknown>;
  onReconcile?: () => Promise<unknown>;
}

export function CashierPaymentForm({
  disabled = false,
  loading = false,
  operationStatus = 'idle',
  onSubmit,
  onRetry,
  onReconcile,
}: Props) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [receivedAt, setReceivedAt] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [payerName, setPayerName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submitGuardRef = useRef(false);

  const clearAfterSuccess = () => {
    setAmount('');
    setReceivedAt('');
    setExternalReference('');
    setPayerName('');
    setNotes('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitGuardRef.current || loading) return;
    setError(null);
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Сумма должна быть больше 0.');
      return;
    }
    if (!paymentMethod) {
      setError('Способ оплаты обязателен.');
      return;
    }

    submitGuardRef.current = true;
    try {
      await onSubmit({
        amount: numericAmount,
        paymentMethod,
        receivedAt: receivedAt || null,
        externalReference: externalReference || null,
        payerName: payerName || null,
        notes: notes || null,
      });
      clearAfterSuccess();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Оплата не была создана.');
    } finally {
      submitGuardRef.current = false;
    }
  };

  const runRecovery = async (action?: () => Promise<unknown>) => {
    if (!action || submitGuardRef.current || loading) return;
    submitGuardRef.current = true;
    setError(null);
    try {
      await action();
      clearAfterSuccess();
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : 'Не удалось проверить результат операции.');
    } finally {
      submitGuardRef.current = false;
    }
  };

  const isReconciling = operationStatus === 'reconciling';
  const isUncertain = operationStatus === 'uncertain';
  const isSubmitting = operationStatus === 'submitting';

  return (
    <section data-testid="cashier-payment-form-section" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Оплата</h2>
      <form data-testid="cashier-payment-form" onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Сумма
          <input data-testid="cashier-payment-amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={loading} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Способ оплаты
          <select data-testid="cashier-payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} disabled={loading} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100">
            {CASHIER_PAYMENT_METHODS.map((method) => <option key={method} value={method}>{cashierPaymentMethodLabels[method]}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Дата оплаты<input data-testid="cashier-payment-received-at" type="datetime-local" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} disabled={loading} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" /></label>
        <label className="text-sm font-medium text-slate-700">Внешняя ссылка<input data-testid="cashier-payment-external-reference" value={externalReference} onChange={(event) => setExternalReference(event.target.value)} disabled={loading} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" /></label>
        <label className="text-sm font-medium text-slate-700">Плательщик<input data-testid="cashier-payment-payer-name" value={payerName} onChange={(event) => setPayerName(event.target.value)} disabled={loading} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" /></label>
        <label className="text-sm font-medium text-slate-700">Примечание<input data-testid="cashier-payment-notes" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={loading} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" /></label>

        {error && <p data-testid="cashier-payment-form-error" className="md:col-span-2 text-sm font-medium text-rose-600">{error}</p>}

        {isUncertain ? (
          <div data-testid="cashier-payment-recovery-actions" className="md:col-span-2 grid gap-2 md:grid-cols-2">
            <button type="button" data-testid="cashier-payment-reconcile" disabled={loading} onClick={() => void runRecovery(onReconcile)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Проверить результат</button>
            <button type="button" data-testid="cashier-payment-retry" disabled={loading} onClick={() => void runRecovery(onRetry)} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-60">Повторить безопасно</button>
          </div>
        ) : (
          <button type="submit" data-testid="cashier-payment-submit" disabled={disabled || loading} className="md:col-span-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {isReconciling ? 'Проверяем результат...' : isSubmitting ? 'Сохраняем оплату...' : 'Принять оплату'}
          </button>
        )}
      </form>
    </section>
  );
}
