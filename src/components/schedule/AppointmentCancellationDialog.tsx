import { useState, type FormEvent } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { formatInstantInTenant } from '../../domain/timezone';
import type { Appointment, CancellationSource } from '../../types';
import { CANCELLATION_SOURCE_LABELS } from './appointmentLifecycle';

interface AppointmentCancellationDialogProps {
  appointment: Appointment;
  timezone: string;
  patientName: string;
  doctorName: string;
  isSaving: boolean;
  isReconciling: boolean;
  error: Error | null;
  onConfirm: (source: CancellationSource, reason: string) => Promise<Appointment | null>;
  onClose: () => void;
}

export function AppointmentCancellationDialog({
  appointment,
  timezone,
  patientName,
  doctorName,
  isSaving,
  isReconciling,
  error,
  onConfirm,
  onClose,
}: AppointmentCancellationDialogProps) {
  const [source, setSource] = useState<CancellationSource | ''>('');
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (!source) {
      setValidationError('Укажите, кто отменил запись.');
      return;
    }
    if (!normalizedReason) {
      setValidationError('Укажите причину.');
      return;
    }
    setValidationError(null);
    try {
      const result = await onConfirm(source, normalizedReason);
      if (result) setSucceeded(true);
    } catch {
      // The hook exposes the safe error. Keep the form open for correction/retry.
    }
  };

  const displayedError = validationError || error?.message;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4" data-testid="appointment-cancellation-dialog">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" role="dialog" aria-modal="true" aria-labelledby="appointment-cancellation-title">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="appointment-cancellation-title" className="text-lg font-semibold text-slate-900">Отменить запись</h2>
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-50" aria-label="Закрыть">
            <X className="h-5 w-5" />
          </button>
        </div>

        {succeeded ? (
          <div className="space-y-4 p-5">
            <p className="rounded-lg bg-emerald-50 p-3 font-medium text-emerald-700" data-testid="appointment-cancellation-success">Запись отменена.</p>
            <button type="button" data-testid="appointment-cancellation-success-close" onClick={onClose} className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white">Закрыть</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 rounded-lg bg-slate-50 p-3 text-sm">
              <dt className="text-slate-500">Пациент</dt><dd className="font-medium text-slate-800">{patientName}</dd>
              <dt className="text-slate-500">Врач</dt><dd className="font-medium text-slate-800">{doctorName}</dd>
              <dt className="text-slate-500">Дата и время</dt><dd className="font-medium text-slate-800">{formatInstantInTenant(appointment.start, timezone, { dateStyle: 'short', timeStyle: 'short' })}</dd>
              <dt className="text-slate-500">Текущий статус</dt><dd className="font-medium text-slate-800">{appointment.status}</dd>
            </dl>

            <div>
              <label htmlFor="cancellation-source" className="mb-1 block text-sm font-medium text-slate-700">Кто отменил запись</label>
              <select
                id="cancellation-source"
                data-testid="appointment-cancellation-source"
                value={source}
                onChange={(event) => setSource(event.target.value as CancellationSource | '')}
                disabled={isSaving}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Выберите источник</option>
                {Object.entries(CANCELLATION_SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="cancellation-reason" className="mb-1 block text-sm font-medium text-slate-700">Причина отмены</label>
              <textarea
                id="cancellation-reason"
                data-testid="appointment-cancellation-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={isSaving}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Запись останется в истории, а время врача станет доступно для новой записи.
            </p>

            {displayedError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{displayedError}</p>}
            {isReconciling && <p className="text-sm font-medium text-indigo-700">Проверяем, была ли запись отменена…</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} disabled={isSaving} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-50">Назад</button>
              <button type="submit" disabled={isSaving} data-testid="appointment-cancellation-submit" className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white disabled:opacity-50">
                {isSaving ? (isReconciling ? 'Проверяем…' : 'Отменяем запись…') : 'Отменить запись'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
