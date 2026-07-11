/* eslint-disable react-hooks/set-state-in-effect -- opening a dialog intentionally resets stale patient form values */
import { useEffect, useState, type FormEvent } from 'react';
import type { PatientFundReservation } from '../../data/repositories/FinanceRepository';
import type { ReleaseFundReservationValues } from '../../data/hooks/usePatientFundReservationFlow';
import { formatFinanceMoney } from './financeLabels';

interface ReleaseFundReservationDialogProps {
  open: boolean;
  reservation: PatientFundReservation | null;
  pending?: boolean;
  actionMessage?: string | null;
  onClose: () => void;
  onSubmit: (values: ReleaseFundReservationValues) => Promise<unknown> | unknown;
}

export function ReleaseFundReservationDialog({
  open,
  reservation,
  pending = false,
  actionMessage,
  onClose,
  onSubmit,
}: ReleaseFundReservationDialogProps) {
  const [reason, setReason] = useState('');
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
    setReason('');
    setValidationError(null);
  }, [open, reservation?.id]);

  if (!open || !reservation) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = reason.trim();
    if (!normalized) {
      setValidationError('Укажите причину освобождения резерва.');
      return;
    }
    setValidationError(null);
    await onSubmit({ reservationId: reservation.id, reason: normalized });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" data-testid="release-fund-reservation-dialog-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="release-fund-reservation-title" data-testid="release-fund-reservation-dialog" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h3 id="release-fund-reservation-title" className="text-lg font-semibold text-slate-900">Освободить резерв</h3>
        <p className="mt-2 text-sm text-slate-600">Оставшийся резерв: <strong>{formatFinanceMoney(reservation.remainingAmount, reservation.currency)}</strong>.</p>
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Освободить оставшийся резерв и вернуть сумму в доступный кредит? Это не возврат денег пациенту.</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="fund-reservation-release-reason">Причина
            <textarea id="fund-reservation-release-reason" data-testid="fund-reservation-release-reason" value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          {(validationError || actionMessage) && (
            <p data-testid="release-fund-reservation-message" aria-live="polite" className={`rounded-lg p-3 text-sm ${validationError ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-800'}`}>{validationError || actionMessage}</p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={pending} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-50">Отмена</button>
            <button type="submit" data-testid="fund-reservation-release-submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Проверяем…' : 'Освободить резерв'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
