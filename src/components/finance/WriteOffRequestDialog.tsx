import { useState, type FormEvent } from 'react';
import { formatFinanceMoney } from './financeLabels';

interface WriteOffRequestDialogProps {
  open: boolean;
  maxAmount: number;
  currency: string;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (values: { amount: number; reason: string }) => Promise<boolean>;
}

export function WriteOffRequestDialog({ open, maxAmount, currency, loading, onCancel, onSubmit }: WriteOffRequestDialogProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setAmount('');
    setReason('');
    setError(null);
    onCancel();
  };

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) { setError('Сумма должна быть больше 0.'); return; }
    if (parsed > maxAmount) { setError('Сумма превышает доступную.'); return; }
    if (!reason.trim()) { setError('Укажите причину списания.'); return; }
    if (reason.trim().length > 1000) { setError('Причина списания слишком длинная.'); return; }
    const succeeded = await onSubmit({ amount: parsed, reason: reason.trim() });
    if (succeeded) close();
  };

  return (
    <div data-testid="writeoff-request-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h4 className="text-lg font-semibold text-slate-900">Создать заявку на списание</h4>
        <p className="mt-1 text-sm text-slate-500">Доступно: {formatFinanceMoney(maxAmount, currency)}. Заявка резервирует сумму, но не уменьшает долг до одобрения.</p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">Сумма<input data-testid="writeoff-request-amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          <label className="block text-sm font-medium text-slate-700">Причина<textarea data-testid="writeoff-request-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
        </div>
        {error && <p data-testid="writeoff-request-error" className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={close} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Отмена</button>
          <button data-testid="writeoff-request-submit" type="submit" disabled={loading} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{loading ? 'Создаём...' : 'Создать заявку'}</button>
        </div>
      </form>
    </div>
  );
}
