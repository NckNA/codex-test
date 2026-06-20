import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  ClinicalEncounter,
  ClinicalEncounterType,
  EncounterVisitRepository,
} from '../../data/repositories/EncounterVisitRepository';
import type { EncounterVisitRpcClient } from '../../data/repositories/EncounterVisitRpcClient';
import { useClinicalEncounters } from '../../data/hooks/useClinicalEncounters';
import { useClinicalEncounterActions } from '../../data/hooks/useClinicalEncounterActions';
import { ClinicalEncounterActions } from './ClinicalEncounterActions';
import { ClinicalEncounterStatusBadge } from './ClinicalEncounterStatusBadge';
import { ENCOUNTER_TYPE_LABELS } from './encounterLabels';
import { getEncounterRoleCapabilities, type EncounterUserRole } from './encounterPermissions';

const ENCOUNTER_TYPE_OPTIONS = Object.keys(ENCOUNTER_TYPE_LABELS) as ClinicalEncounterType[];

interface ClinicalEncounterPanelProps {
  tenantId?: string | null;
  patientId?: string | null;
  role?: EncounterUserRole;
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

function safeMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('permission') || message.includes('denied') || message.includes('not allowed')) {
      return 'Недостаточно прав для клинического приёма.';
    }
    if (message.includes('status') || message.includes('transition') || message.includes('encounter')) {
      return 'Невозможно выполнить действие для текущего статуса приёма.';
    }
    if (message.includes('patient')) return 'Пациент не найден.';
    if (message.includes('clinic') || message.includes('tenant')) return 'Не выбрана клиника.';
  }
  return 'Не удалось обновить клинический приём. Попробуйте ещё раз.';
}

function getSortedEncounters(encounters: ClinicalEncounter[]) {
  return [...encounters].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt || left.startedAt || '');
    const rightTime = Date.parse(right.createdAt || right.startedAt || '');
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}

export function ClinicalEncounterPanel({
  tenantId,
  patientId,
  role,
  repository,
  rpcClient,
}: ClinicalEncounterPanelProps) {
  const [encounterType, setEncounterType] = useState<ClinicalEncounterType>('consultation');
  const [chiefComplaintSnapshot, setChiefComplaintSnapshot] = useState('');
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const capabilities = useMemo(() => getEncounterRoleCapabilities(role), [role]);

  const {
    encounters,
    isLoading,
    isError,
    error,
    refresh,
  } = useClinicalEncounters({ tenantId, patientId, repository });

  const {
    actionLoading,
    error: actionError,
    createEncounter,
    startEncounter,
    completeEncounter,
    clearError,
  } = useClinicalEncounterActions({ tenantId, patientId, refresh, rpcClient });

  const sortedEncounters = useMemo(() => getSortedEncounters(encounters), [encounters]);

  if (!tenantId) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800" data-testid="clinical-encounter-no-tenant">
        <h2 className="mb-2 text-lg font-semibold">Приёмы</h2>
        <p>Не выбрана клиника.</p>
      </section>
    );
  }

  if (!patientId) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600" data-testid="clinical-encounter-no-patient">
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Приёмы</h2>
        <p>Пациент не найден.</p>
      </section>
    );
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setFormError(null);

    if (!capabilities.canCreate) {
      setFormError('Недостаточно прав для клинического приёма.');
      return;
    }

    if (!chiefComplaintSnapshot.trim()) {
      setFormError('Укажите жалобу или причину приёма.');
      return;
    }

    try {
      await createEncounter({
        encounterType,
        chiefComplaintSnapshot,
        clinicalSummary,
      });
      setEncounterType('consultation');
      setChiefComplaintSnapshot('');
      setClinicalSummary('');
    } catch (err) {
      setFormError(safeMessage(err));
    }
  };

  const runSafeAction = async (action: () => Promise<void>) => {
    clearError();
    setFormError(null);
    try {
      await action();
    } catch (err) {
      setFormError(safeMessage(err));
    }
  };

  return (
    <section className="space-y-5" aria-label="Клинические приёмы пациента" data-testid="clinical-encounter-panel">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Приёмы</h2>
            <p className="mt-1 text-sm text-slate-500">
              Клинический приём фиксирует врачебную документацию. Он не создаёт выполненные услуги, оплату, складские списания или документы.
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
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="clinical-encounter-error">
            {formError || actionError?.message || 'Не удалось обновить клинический приём. Попробуйте ещё раз.'}
          </div>
        )}

        {capabilities.canCreate ? (
          <form onSubmit={handleCreate} className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4" data-testid="clinical-encounter-create-form">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-blue-800" htmlFor="encounter-type">
                  Тип приёма
                </label>
                <select
                  id="encounter-type"
                  value={encounterType}
                  onChange={(event) => setEncounterType(event.target.value as ClinicalEncounterType)}
                  className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                >
                  {ENCOUNTER_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>{ENCOUNTER_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-blue-800" htmlFor="encounter-chief-complaint">
                  Жалоба / причина
                </label>
                <input
                  id="encounter-chief-complaint"
                  data-testid="clinical-encounter-chief-complaint"
                  value={chiefComplaintSnapshot}
                  onChange={(event) => setChiefComplaintSnapshot(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                  placeholder="Например: боль, консультация, контроль"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-blue-800" htmlFor="encounter-summary-draft">
                Первичное описание
              </label>
              <textarea
                id="encounter-summary-draft"
                value={clinicalSummary}
                onChange={(event) => setClinicalSummary(event.target.value)}
                className="mt-2 min-h-20 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                placeholder="Необязательно: краткое клиническое описание"
              />
            </div>
            <button
              type="submit"
              data-testid="clinical-encounter-create-submit"
              disabled={actionLoading !== null}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading === 'create' ? 'Создаём...' : 'Создать приём'}
            </button>
          </form>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600" data-testid="clinical-encounter-readonly">
            Клинические действия доступны только владельцу, администратору или врачу. Завершённые услуги, оплата, склад и документы в этом разделе не создаются.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {isLoading && <p className="text-sm text-slate-500">Загружаем клинические приёмы...</p>}
        {isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {safeMessage(error)}
          </div>
        )}
        {!isLoading && !isError && sortedEncounters.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500" data-testid="clinical-encounter-empty">
            Клинических приёмов пока нет.
          </div>
        )}
        <div className="space-y-4">
          {sortedEncounters.map((encounter) => (
            <article key={encounter.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid={`clinical-encounter-row-${encounter.id}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <ClinicalEncounterStatusBadge status={encounter.status} />
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                      {ENCOUNTER_TYPE_LABELS[encounter.encounterType]}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    {encounter.chiefComplaintSnapshot || 'Клинический приём'}
                  </h3>
                  {encounter.clinicalSummary && (
                    <p className="mt-2 text-sm text-slate-600" data-testid={`clinical-encounter-summary-${encounter.id}`}>
                      {encounter.clinicalSummary}
                    </p>
                  )}
                </div>
                <div className="text-xs text-slate-500 md:text-right">
                  <p>Создан: {formatDateTime(encounter.createdAt)}</p>
                  <p>Начат: {formatDateTime(encounter.startedAt)}</p>
                  <p>Завершён: {formatDateTime(encounter.completedAt)}</p>
                  {encounter.visitId && <p>Визит: {encounter.visitId}</p>}
                  {encounter.doctorUserId && <p>Врач: {encounter.doctorUserId}</p>}
                </div>
              </div>
              <ClinicalEncounterActions
                encounter={encounter}
                role={role}
                actionLoading={actionLoading}
                onStart={(encounterId) => runSafeAction(() => startEncounter(encounterId))}
                onComplete={(encounterId, summary) => runSafeAction(() => completeEncounter({ encounterId, clinicalSummary: summary }))}
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
