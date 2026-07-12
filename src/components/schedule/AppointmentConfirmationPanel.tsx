import { useMemo, useState } from 'react';
import { CheckCircle2, PhoneCall } from 'lucide-react';
import type {
  Appointment,
  AppointmentConfirmationAttempt,
  AppointmentContactChannel,
  AppointmentContactOutcome,
} from '../../types';
import {
  canManageAppointmentConfirmation,
  canUseAppointmentConfirmationActions,
  confirmationStateClassName,
  confirmationStateLabel,
  CONTACT_CHANNEL_LABELS,
  CONTACT_OUTCOME_LABELS,
} from './appointmentConfirmation';

interface AppointmentConfirmationPanelProps {
  appointment: Appointment;
  role?: string;
  attempts: AppointmentConfirmationAttempt[];
  isLoadingAttempts?: boolean;
  attemptsError?: string | null;
  isRecordingAttempt: boolean;
  isConfirming: boolean;
  isReconciling: boolean;
  error?: string | null;
  onRecordAttempt?: (
    channel: AppointmentContactChannel,
    outcome: AppointmentContactOutcome,
    note: string,
  ) => Promise<Appointment | null>;
  onConfirm?: (channel: AppointmentContactChannel, note: string) => Promise<Appointment | null>;
}

type FormMode = 'attempt' | 'confirm' | null;

const formatDate = (value?: string) => value
  ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
  : 'Нет';

export function AppointmentConfirmationPanel({
  appointment,
  role,
  attempts,
  isLoadingAttempts = false,
  attemptsError = null,
  isRecordingAttempt,
  isConfirming,
  isReconciling,
  error = null,
  onRecordAttempt,
  onConfirm,
}: AppointmentConfirmationPanelProps) {
  const [mode, setMode] = useState<FormMode>(null);
  const [channel, setChannel] = useState<AppointmentContactChannel | ''>('');
  const [outcome, setOutcome] = useState<AppointmentContactOutcome | ''>('');
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isBusy = isRecordingAttempt || isConfirming;
  const canManage = canManageAppointmentConfirmation(role);
  const canAct = canUseAppointmentConfirmationActions(appointment)
    && (appointment.confirmationState || 'unconfirmed') !== 'confirmed';
  const latestAttempt = attempts[0];
  const displayedError = validationError || error || attemptsError;

  const sortedAttempts = useMemo(() => [...attempts].sort((left, right) => {
    const byTime = new Date(right.attemptedAt).getTime() - new Date(left.attemptedAt).getTime();
    return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
  }), [attempts]);

  const resetForm = () => {
    if (isBusy) return;
    setMode(null);
    setChannel('');
    setOutcome('');
    setNote('');
    setValidationError(null);
    setSuccessMessage(null);
  };

  const openMode = (nextMode: Exclude<FormMode, null>) => {
    setMode(nextMode);
    setChannel('');
    setOutcome(nextMode === 'confirm' ? 'confirmed' : '');
    setNote('');
    setValidationError(null);
    setSuccessMessage(null);
  };

  const submit = async () => {
    if (isBusy) return;
    if (!channel) {
      setValidationError('Выберите способ связи.');
      return;
    }
    if (mode === 'attempt' && !outcome) {
      setValidationError('Выберите результат связи.');
      return;
    }
    setValidationError(null);
    const normalizedNote = note.trim();
    try {
      const result = mode === 'confirm'
        ? await onConfirm?.(channel, normalizedNote)
        : await onRecordAttempt?.(channel, outcome as AppointmentContactOutcome, normalizedNote);
      if (result) {
        setSuccessMessage(mode === 'confirm' ? 'Запись подтверждена.' : 'Попытка связи сохранена.');
      }
    } catch {
      // Safe error is supplied by the scheduling hook. Keep the form open.
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" data-testid="appointment-confirmation-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Подтверждение записи</h3>
          <p className="mt-1 text-xs text-slate-500">Подтверждение не означает приход пациента или выполненное лечение.</p>
        </div>
        <span
          data-testid="appointment-confirmation-state"
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confirmationStateClassName(appointment.confirmationState)}`}
        >
          {confirmationStateLabel(appointment.confirmationState)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">Попыток связи</dt>
        <dd className="font-medium text-slate-800" data-testid="appointment-confirmation-attempt-count">{appointment.confirmationAttemptCount || 0}</dd>
        <dt className="text-slate-500">Последняя попытка</dt>
        <dd className="font-medium text-slate-800">{formatDate(appointment.lastConfirmationAttemptAt)}</dd>
        <dt className="text-slate-500">Последний результат</dt>
        <dd className="font-medium text-slate-800">{appointment.lastConfirmationOutcome ? CONTACT_OUTCOME_LABELS[appointment.lastConfirmationOutcome] : 'Нет'}</dd>
        <dt className="text-slate-500">Подтверждена</dt>
        <dd className="font-medium text-slate-800">{formatDate(appointment.confirmedAt)}</dd>
        <dt className="text-slate-500">Канал подтверждения</dt>
        <dd className="font-medium text-slate-800">{appointment.confirmationChannel ? CONTACT_CHANNEL_LABELS[appointment.confirmationChannel] : 'Нет'}</dd>
      </dl>

      {latestAttempt && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700" data-testid="appointment-confirmation-latest-attempt">
          <div className="font-medium">Последняя попытка: {CONTACT_OUTCOME_LABELS[latestAttempt.outcome]}</div>
          <div>{CONTACT_CHANNEL_LABELS[latestAttempt.channel]} · {formatDate(latestAttempt.attemptedAt)}</div>
          {latestAttempt.note && <div className="mt-1 text-slate-600">{latestAttempt.note}</div>}
        </div>
      )}

      {isLoadingAttempts && <p className="mt-3 text-sm text-slate-500">Загрузка истории связи…</p>}
      {!isLoadingAttempts && sortedAttempts.length > 0 && (
        <details className="mt-3 text-sm" data-testid="appointment-confirmation-history">
          <summary className="cursor-pointer font-medium text-blue-700">История попыток связи ({sortedAttempts.length})</summary>
          <div className="mt-2 space-y-2">
            {sortedAttempts.map((attempt) => (
              <div key={attempt.id} className="rounded-lg border border-slate-200 p-2">
                <div className="font-medium text-slate-800">{CONTACT_OUTCOME_LABELS[attempt.outcome]}</div>
                <div className="text-xs text-slate-500">{CONTACT_CHANNEL_LABELS[attempt.channel]} · {formatDate(attempt.attemptedAt)}</div>
                {attempt.note && <div className="mt-1 text-xs text-slate-600">{attempt.note}</div>}
              </div>
            ))}
          </div>
        </details>
      )}

      {canManage && canAct && !mode && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="appointment-record-confirmation-attempt-action"
            onClick={() => openMode('attempt')}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800"
          >
            <PhoneCall className="h-4 w-4" /> Зафиксировать попытку связи
          </button>
          <button
            type="button"
            data-testid="appointment-confirm-action"
            onClick={() => openMode('confirm')}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
          >
            <CheckCircle2 className="h-4 w-4" /> Подтвердить запись
          </button>
        </div>
      )}

      {mode && !successMessage && (
        <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid={`appointment-confirmation-${mode}-form`}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Способ связи</label>
            <select
              data-testid="appointment-confirmation-channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value as AppointmentContactChannel | '')}
              disabled={isBusy}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Выберите способ связи</option>
              {Object.entries(CONTACT_CHANNEL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {mode === 'attempt' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Результат связи</label>
              <select
                data-testid="appointment-confirmation-outcome"
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as AppointmentContactOutcome | '')}
                disabled={isBusy}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Выберите результат связи</option>
                {Object.entries(CONTACT_OUTCOME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Примечание</label>
            <textarea
              data-testid="appointment-confirmation-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={isBusy}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          {displayedError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{displayedError}</p>}
          {isReconciling && <p className="text-sm font-medium text-indigo-700">Проверяем, была ли операция сохранена…</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} disabled={isBusy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Назад</button>
            <button
              type="button"
              onClick={submit}
              disabled={isBusy}
              data-testid="appointment-confirmation-submit"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isBusy
                ? (isReconciling ? 'Проверяем…' : mode === 'confirm' ? 'Подтверждаем запись…' : 'Сохраняем попытку связи…')
                : mode === 'confirm' ? 'Подтвердить запись' : 'Сохранить попытку'}
            </button>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700" data-testid="appointment-confirmation-success">
          {successMessage}
          <button type="button" onClick={resetForm} className="ml-3 underline">Закрыть</button>
        </div>
      )}
    </section>
  );
}
