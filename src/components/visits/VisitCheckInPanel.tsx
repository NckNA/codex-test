import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  EncounterVisitRepository,
  PatientVisit,
  PatientVisitType,
} from '../../data/repositories/EncounterVisitRepository';
import type { EncounterVisitRpcClient } from '../../data/repositories/EncounterVisitRpcClient';
import { usePatientVisits } from '../../data/hooks/usePatientVisits';
import { useVisitLifecycleActions } from '../../data/hooks/useVisitLifecycleActions';
import { VisitLifecycleActions } from './VisitLifecycleActions';
import { getVisitRoleCapabilities, type VisitUserRole } from './visitPermissions';
import { VisitStatusBadge } from './VisitStatusBadge';
import { VISIT_TYPE_LABELS } from './visitLabels';

const VISIT_TYPE_OPTIONS = Object.keys(VISIT_TYPE_LABELS) as PatientVisitType[];

interface VisitCheckInPanelProps {
  tenantId?: string | null;
  patientId?: string | null;
  role?: VisitUserRole;
  appointmentId?: string | null;
  repository?: EncounterVisitRepository;
  rpcClient?: EncounterVisitRpcClient;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLatestActiveVisit(visits: PatientVisit[]): PatientVisit | null {
  return visits.find((visit) => ['checked_in', 'in_progress'].includes(visit.status)) ?? null;
}

export function VisitCheckInPanel({
  tenantId,
  patientId,
  role,
  appointmentId,
  repository,
  rpcClient,
}: VisitCheckInPanelProps) {
  const [visitType, setVisitType] = useState<PatientVisitType>('regular');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    visits,
    isLoading,
    isError,
    error,
    refresh,
  } = usePatientVisits({ tenantId, patientId, repository });

  const {
    actionLoading,
    error: actionError,
    checkInVisit,
    startVisit,
    completeVisit,
    cancelVisit,
    clearError,
  } = useVisitLifecycleActions({ tenantId, patientId, refresh, rpcClient });

  const capabilities = useMemo(() => getVisitRoleCapabilities(role), [role]);
  const latestActiveVisit = useMemo(() => getLatestActiveVisit(visits), [visits]);
  const canCheckIn = Boolean(tenantId && patientId && capabilities.canCheckIn && !latestActiveVisit);

  if (!tenantId) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <h2 className="text-lg font-semibold mb-2">Визиты</h2>
        <p>Не выбрана клиника.</p>
      </section>
    );
  }

  if (!patientId) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Визиты</h2>
        <p>Пациент не найден.</p>
      </section>
    );
  }

  const handleCheckIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setFormError(null);

    if (!capabilities.canCheckIn) {
      setFormError('Недостаточно прав для действия.');
      return;
    }

    try {
      await checkInVisit({
        visitType,
        notes,
        appointmentId,
      });
      setNotes('');
      setVisitType('regular');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Не удалось обновить визит. Попробуйте ещё раз.');
    }
  };

  const safeAction = async (action: () => Promise<void>) => {
    setFormError(null);
    clearError();
    try {
      await action();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Не удалось обновить визит. Попробуйте ещё раз.');
    }
  };

  return (
    <section className="space-y-5" aria-label="Визиты пациента">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Визиты</h2>
            <p className="mt-1 text-sm text-slate-500">
              Фиксация фактического прихода пациента и статуса визита. Клинические записи, услуги и оплаты здесь не создаются.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            disabled={isLoading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Обновить
          </button>
        </div>

        {(formError || actionError) && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError || actionError?.message || 'Не удалось обновить визит. Попробуйте ещё раз.'}
          </div>
        )}

        {canCheckIn && (
          <form onSubmit={handleCheckIn} className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-end">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-blue-800" htmlFor="visit-type">
                  Тип визита
                </label>
                <select
                  id="visit-type"
                  value={visitType}
                  onChange={(event) => setVisitType(event.target.value as PatientVisitType)}
                  className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                >
                  {VISIT_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>{VISIT_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-blue-800" htmlFor="visit-notes">
                  Заметка
                </label>
                <input
                  id="visit-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                  placeholder="Необязательно"
                />
              </div>
              <button
                type="submit"
                disabled={actionLoading !== null}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading === 'check_in' ? 'Отмечаем...' : 'Отметить приход'}
              </button>
            </div>
          </form>
        )}

        {!capabilities.canCheckIn && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Для вашей роли действия с визитами недоступны. Данные отображаются только для чтения, если доступ разрешён политиками клиники.
          </div>
        )}

        {latestActiveVisit && capabilities.canCheckIn && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            У пациента уже есть активный визит. Новый приход можно отметить после завершения или отмены текущего визита.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {isLoading && (
          <div className="py-10 text-center text-slate-500">Визиты загружаются...</div>
        )}

        {isError && !isLoading && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error?.message || 'Не удалось загрузить визиты.'}
          </div>
        )}

        {!isLoading && !isError && visits.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-slate-500">
            Визитов пока нет.
          </div>
        )}

        {!isLoading && !isError && visits.length > 0 && (
          <div className="space-y-4">
            {visits.map((visit) => (
              <article key={visit.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <VisitStatusBadge status={visit.status} />
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {VISIT_TYPE_LABELS[visit.visitType]}
                      </span>
                    </div>
                    {visit.notes && <p className="text-sm text-slate-600">{visit.notes}</p>}
                  </div>
                  <div className="text-xs text-slate-400">ID: {visit.id.slice(0, 8)}</div>
                </div>

                <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <div><dt className="text-xs font-semibold text-slate-400">Пришёл</dt><dd className="text-slate-700">{formatDateTime(visit.arrivedAt)}</dd></div>
                  <div><dt className="text-xs font-semibold text-slate-400">Отмечен</dt><dd className="text-slate-700">{formatDateTime(visit.checkedInAt)}</dd></div>
                  <div><dt className="text-xs font-semibold text-slate-400">Начат</dt><dd className="text-slate-700">{formatDateTime(visit.startedAt)}</dd></div>
                  <div><dt className="text-xs font-semibold text-slate-400">Завершён</dt><dd className="text-slate-700">{formatDateTime(visit.completedAt)}</dd></div>
                  <div><dt className="text-xs font-semibold text-slate-400">Отменён</dt><dd className="text-slate-700">{formatDateTime(visit.cancelledAt)}</dd></div>
                  <div><dt className="text-xs font-semibold text-slate-400">Обновлён</dt><dd className="text-slate-700">{formatDateTime(visit.updatedAt)}</dd></div>
                </dl>

                <VisitLifecycleActions
                  visit={visit}
                  role={role}
                  actionLoading={actionLoading}
                  onStart={(visitId) => safeAction(() => startVisit(visitId))}
                  onComplete={(visitId) => safeAction(() => completeVisit(visitId))}
                  onCancel={(visitId, reason) => safeAction(() => cancelVisit({ visitId, reason }))}
                />
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
