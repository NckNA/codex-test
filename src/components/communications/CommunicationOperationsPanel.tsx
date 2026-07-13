import { useMemo, useState } from 'react';
import { AlertTriangle, FlaskConical, RefreshCw, Route as RouteIcon, ShieldCheck } from 'lucide-react';
import type { AppointmentReminderQueueItem } from '../../types';
import type {
  CommunicationChannel,
  CommunicationSimulationScenario,
} from '../../domain/communications/CommunicationCommand';
import type { CommunicationOperation } from '../../data/repositories/CommunicationOrchestrationRepository';
import { useCommunicationOperations } from '../../data/hooks/useCommunicationOperations';

const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  email: 'Email',
};

const STATE_LABELS: Record<CommunicationOperation['state'], string> = {
  prepared: 'Подготовлена',
  simulation_running: 'Симуляция выполняется',
  simulation_succeeded: 'Симуляция принята',
  simulation_failed: 'Симуляция завершилась ошибкой',
  simulation_uncertain: 'Результат не определён',
  cancelled: 'Отменена',
};

const SCENARIOS: Array<{ value: CommunicationSimulationScenario; label: string }> = [
  { value: 'success', label: 'Успех' },
  { value: 'rejected', label: 'Отклонено' },
  { value: 'temporary_failure', label: 'Временная ошибка' },
  { value: 'permanent_failure', label: 'Постоянная ошибка' },
  { value: 'timeout_before_acceptance', label: 'Тайм-аут до принятия' },
  { value: 'timeout_after_acceptance', label: 'Тайм-аут после возможного принятия' },
  { value: 'unknown', label: 'Неизвестный результат' },
];

const operationTone = (operation: CommunicationOperation): string => {
  if (operation.state === 'simulation_succeeded') return 'border-emerald-200 bg-emerald-50';
  if (operation.state === 'simulation_uncertain') return 'border-amber-300 bg-amber-50';
  if (operation.state === 'simulation_failed' || operation.state === 'cancelled') return 'border-red-200 bg-red-50';
  return 'border-slate-200 bg-white';
};

export interface CommunicationOperationsPanelProps {
  reminderItems: AppointmentReminderQueueItem[];
}

export function CommunicationOperationsPanel({
  reminderItems,
}: CommunicationOperationsPanelProps) {
  const {
    routes,
    operations,
    loading,
    preparing,
    simulating,
    recovering,
    error,
    canRead,
    canManage,
    refresh,
    prepare,
    simulate,
    recover,
    upsertRoute,
    disableRoute,
    clearError,
  } = useCommunicationOperations();

  const [selectedJobId, setSelectedJobId] = useState('');
  const [channel, setChannel] = useState<CommunicationChannel>('sms');
  const [scenarioByOperation, setScenarioByOperation] = useState<Record<string, CommunicationSimulationScenario>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => reminderItems.find((item) => item.job.id === selectedJobId),
    [reminderItems, selectedJobId],
  );
  const routeByChannel = useMemo(
    () => new Map(routes.filter((route) => route.enabled).map((route) => [route.channel, route])),
    [routes],
  );

  if (!canRead) return null;

  const run = async (action: () => Promise<unknown>, success: string) => {
    clearError();
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch {
      // The hook exposes a redacted domain-safe message.
    }
  };

  return (
    <section
      className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm"
      aria-label="Тестовые коммуникационные операции"
      data-testid="communication-operations-panel"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-indigo-700">
            <FlaskConical className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Диагностика коммуникаций</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Тестовый контур подготовки и симуляции</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Это тестовая операция. Сообщение пациенту не отправляется.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить диагностику
        </button>
      </div>

      {(error || notice) && (
        <div className="mt-4 space-y-2">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <RouteIcon className="h-4 w-4 text-slate-500" />
              Тестовые маршруты
            </div>
            <div className="mt-3 space-y-2">
              {(['sms', 'whatsapp', 'email'] as CommunicationChannel[]).map((routeChannel) => {
                const activeRoute = routeByChannel.get(routeChannel);
                return (
                  <div key={routeChannel} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium text-slate-800">{CHANNEL_LABELS[routeChannel]}</div>
                      <div className="text-xs text-slate-500">
                        {activeRoute
                          ? `${activeRoute.adapterCode} · версия ${activeRoute.configurationVersion}`
                          : 'Маршрут не настроен'}
                      </div>
                    </div>
                    {canManage && (
                      activeRoute ? (
                        <button
                          type="button"
                          data-testid={`disable-route-${routeChannel}`}
                          onClick={() => void run(
                            () => disableRoute(activeRoute),
                            `Тестовый маршрут ${CHANNEL_LABELS[routeChannel]} отключён.`,
                          )}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Отключить
                        </button>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            data-testid={`create-noop-route-${routeChannel}`}
                            onClick={() => void run(
                              () => upsertRoute(routeChannel, 'noop'),
                              `Создан noop-маршрут для ${CHANNEL_LABELS[routeChannel]}.`,
                            )}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            noop
                          </button>
                          <button
                            type="button"
                            data-testid={`create-mock-route-${routeChannel}`}
                            onClick={() => void run(
                              () => upsertRoute(routeChannel, 'mock'),
                              `Создан mock-маршрут для ${CHANNEL_LABELS[routeChannel]}.`,
                            )}
                            className="rounded-md bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                          >
                            mock
                          </button>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {canManage ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
                Подготовить тестовую операцию
              </div>
              <div className="mt-3 space-y-3">
                <select
                  value={selectedJobId}
                  onChange={(event) => setSelectedJobId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  aria-label="Задача напоминания"
                >
                  <option value="">Выберите задачу напоминания</option>
                  {reminderItems.map((item) => (
                    <option key={item.job.id} value={item.job.id}>
                      {item.patient.fullName} · {item.job.reminderType}
                    </option>
                  ))}
                </select>
                <select
                  value={channel}
                  onChange={(event) => setChannel(event.target.value as CommunicationChannel)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  aria-label="Тестовый канал"
                >
                  {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  data-testid="prepare-communication-operation"
                  disabled={!selectedItem || preparing === selectedJobId}
                  onClick={() => selectedItem && void run(
                    () => prepare(selectedItem, channel),
                    'Тестовая коммуникационная операция подготовлена.',
                  )}
                  className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Подготовить тестовую операцию
                </button>
                {!routeByChannel.has(channel) && (
                  <p className="text-xs text-amber-700">Для выбранного канала требуется активный тестовый маршрут.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              Регистратор видит готовность и состояния, но не может подготавливать или запускать симуляции.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="font-semibold text-slate-900">Операции</div>
          {loading ? (
            <div className="mt-4 text-sm text-slate-500">Загружаем операции…</div>
          ) : operations.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              Тестовые операции ещё не подготовлены.
            </div>
          ) : (
            <div className="mt-3 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
              {operations.map((operation) => {
                const scenario = scenarioByOperation[operation.id] ?? 'success';
                const busy = simulating === operation.id || recovering === operation.id;
                return (
                  <article
                    key={operation.id}
                    className={`rounded-xl border p-4 ${operationTone(operation)}`}
                    data-testid={`communication-operation-${operation.id}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-slate-900">
                        {CHANNEL_LABELS[operation.channel]} · {STATE_LABELS[operation.state]}
                      </div>
                      <span className="rounded-full bg-white/80 px-2 py-1 text-xs text-slate-600">
                        {operation.adapterCode}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                      <span>Назначение: {operation.purposeCode}</span>
                      <span>Адресат: {operation.contactSnapshot.maskedDestination ?? '***'}</span>
                      <span>Маршрут: v{operation.routeVersion}</span>
                      <span>Шаблон: {operation.templateVersionNumber ? `v${operation.templateVersionNumber}` : 'legacy'}</span>
                      <span>Результат: {operation.adapterResultCode ?? 'не запускался'}</span>
                      <span>Fingerprint: {operation.renderedContentFingerprint?.slice(0, 12) ?? '—'}</span>
                    </div>
                    {operation.renderedBody && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white/70 p-3" data-testid={`rendered-template-${operation.id}`}>
                        {operation.renderedSubject && <div className="text-sm font-medium text-slate-900">{operation.renderedSubject}</div>}
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{operation.renderedBody}</p>
                        <p className="mt-2 text-xs text-slate-500">Символов: {operation.renderedCharacterCount ?? 0}</p>
                      </div>
                    )}
                    {operation.uncertain && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs text-amber-900">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        Неопределённый результат сохраняется. Автоматический повтор запрещён.
                      </div>
                    )}
                    {canManage && operation.state === 'prepared' && (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <select
                          value={scenario}
                          onChange={(event) => setScenarioByOperation((current) => ({
                            ...current,
                            [operation.id]: event.target.value as CommunicationSimulationScenario,
                          }))}
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          aria-label={`Сценарий ${operation.id}`}
                        >
                          {SCENARIOS.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          data-testid={`simulate-${operation.id}`}
                          disabled={busy}
                          onClick={() => void run(
                            () => simulate(operation, scenario),
                            'Симуляция завершена. Реальное сообщение не создавалось.',
                          )}
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Запустить симуляцию
                        </button>
                      </div>
                    )}
                    {canManage && operation.state === 'simulation_uncertain' && (
                      <button
                        type="button"
                        data-testid={`recover-${operation.id}`}
                        disabled={busy}
                        onClick={() => void run(
                          () => recover(operation),
                          'Сохранённый результат проверен без повторного выполнения.',
                        )}
                        className="mt-3 rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                      >
                        Проверить результат
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
