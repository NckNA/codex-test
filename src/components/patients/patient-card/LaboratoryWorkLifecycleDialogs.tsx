import { useState, type FormEvent } from 'react';
import type { LaboratoryWorkOrderRecord } from '../../../data/repositories/LaboratoryWorkRepository';

interface CompleteProps {
  order: LaboratoryWorkOrderRecord;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function LaboratoryWorkCompleteDialog({ order, submitting = false, onClose, onConfirm }: CompleteProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" data-testid="laboratory-complete-dialog">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900">Завершить работу?</h3>
        <p className="mt-2 text-sm text-slate-600">«{order.title}» будет отмечена как завершённая. Это отдельное действие, не редактирование статуса.</p>
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Отмена</button><button type="button" data-testid="laboratory-complete-confirm" disabled={submitting} onClick={() => void onConfirm()} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Завершаем…' : 'Завершить работу'}</button></div>
      </div>
    </div>
  );
}

interface ReopenProps {
  order: LaboratoryWorkOrderRecord;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export function LaboratoryWorkReopenDialog({ order, submitting = false, onClose, onConfirm }: ReopenProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = reason.trim();
    if (!value) {
      setError('Укажите причину возврата работы.');
      return;
    }
    setError(null);
    await onConfirm(value);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" data-testid="laboratory-reopen-dialog">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900">Вернуть работу в работу</h3>
        <p className="mt-2 text-sm text-slate-600">«{order.title}». Причина попадёт в audit события и не заменит обычный комментарий заказа.</p>
        <label className="mt-4 block text-sm font-medium text-slate-700">Причина<textarea data-testid="laboratory-reopen-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        {error && <div data-testid="laboratory-reopen-error" className="mt-3 text-sm font-medium text-red-700">{error}</div>}
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Отмена</button><button type="submit" data-testid="laboratory-reopen-confirm" disabled={submitting} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Возвращаем…' : 'Вернуть в работу'}</button></div>
      </form>
    </div>
  );
}
