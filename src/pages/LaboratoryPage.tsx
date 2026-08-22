import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FlaskConical,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Tags,
  UserRound,
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { useLaboratoryWorkPagedQueue } from '../data/hooks/useLaboratoryWorkPagedQueue';
import { useLaboratoryWorkMutations } from '../data/hooks/useLaboratoryWorkMutations';
import { useLaboratoryWorkRepository } from '../data/hooks/useLaboratoryWorkRepository';
import type { LaboratoryWorkQueueDueFilter } from '../data/repositories/LaboratoryWorkQueueReadClient';
import type { LaboratoryWorkOrderRecord, LaboratoryWorkOrderStatus } from '../data/repositories/LaboratoryWorkRepository';
import type { PatientLookupRecord } from '../data/repositories/PatientRepository';
import { LaboratoryPatientPicker } from '../components/laboratory/LaboratoryPatientPicker';
import { LaboratoryWorkOrderDialog, type LaboratoryWorkOrderDialogSubmit } from '../components/patients/patient-card/LaboratoryWorkOrderDialog';
import { LaboratoryWorkCompleteDialog, LaboratoryWorkReopenDialog } from '../components/patients/patient-card/LaboratoryWorkLifecycleDialogs';
import { getLaboratoryWorkRoleCapabilities } from '../components/patients/patient-card/laboratoryWorkPermissions';
import { compareInstantToTenantDay, formatInstantInTenant, tenantNowDate } from '../domain/timezone';

type DueBucket = Exclude<LaboratoryWorkQueueDueFilter, 'all'> | 'completed';

const STATUS_LABELS: Record<LaboratoryWorkOrderStatus, string> = {
  in_progress: 'В работе',
  completed: 'Завершена',
};

const STATUS_CLASSES: Record<LaboratoryWorkOrderStatus, string> = {
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-700',
};

const DUE_LABELS: Record<Exclude<DueBucket, 'completed'>, string> = {
  overdue: 'Просрочено',
  today: 'Готовность сегодня',
  upcoming: 'Предстоящая готовность',
  unscheduled: 'Дата не указана',
};

const DUE_CLASSES: Record<Exclude<DueBucket, 'completed'>, string> = {
  overdue: 'bg-red-100 text-red-700',
  today: 'bg-blue-100 text-blue-700',
  upcoming: 'bg-slate-100 text-slate-700',
  unscheduled: 'bg-slate-100 text-slate-500',
};

const PAGE_SIZES = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

function dueBucket(order: LaboratoryWorkOrderRecord, timezone: string, nowMillis: number): DueBucket {
  if (order.status === 'completed') return 'completed';
  if (!order.plannedReadyAt) return 'unscheduled';
  if (Date.parse(order.plannedReadyAt) < nowMillis) return 'overdue';
  const today = tenantNowDate(timezone, new Date(nowMillis));
  return compareInstantToTenantDay(order.plannedReadyAt, today, timezone) === 0 ? 'today' : 'upcoming';
}

function safeTimestamp(value: string | null, timezone: string): string | null {
  if (!value) return null;
  return formatInstantInTenant(value, timezone, { dateStyle: 'medium', timeStyle: 'short' });
}

function hasValidVersion(order: LaboratoryWorkOrderRecord) {
  return Number.isInteger(order.mutationVersion) && (order.mutationVersion ?? 0) > 0;
}

type QueueMutationDialog =
  | { type: 'patient-picker' }
  | { type: 'create'; patient: PatientLookupRecord }
  | { type: 'edit' | 'complete' | 'reopen'; order: LaboratoryWorkOrderRecord }
  | null;

export function LaboratoryPage() {
  const { activeTenant } = useTenant();
  const capabilities = getLaboratoryWorkRoleCapabilities(activeTenant?.role);

  if (!capabilities.canView) {
    return (
      <div className="min-h-screen bg-slate-50 p-8" data-testid="laboratory-page-no-access">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">Недостаточно прав для лабораторных работ.</div>
      </div>
    );
  }

  return <LaboratoryQueuePage />;
}

function LaboratoryQueuePage() {
  const { activeTenant } = useTenant();
  const repositorySelection = useLaboratoryWorkRepository();
  const timezone = activeTenant?.timezone ?? 'Asia/Almaty';
  const capabilities = getLaboratoryWorkRoleCapabilities(activeTenant?.role);
  const [dialog, setDialog] = useState<QueueMutationDialog>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | LaboratoryWorkOrderStatus>('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [laboratoryFilter, setLaboratoryFilter] = useState('all');
  const [dueFilter, setDueFilter] = useState<LaboratoryWorkQueueDueFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const [nowMillis] = useState(() => Date.now());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setOffset(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const {
    orders,
    totalFiltered,
    limit,
    patientNamesById,
    referencesByOrderId,
    filterOptions,
    summary,
    isLoading,
    isError,
    error,
    refetch,
    isSummaryLoading,
    isSummaryError,
    refetchSummary,
    arePatientNamesLoading,
    arePatientNamesError,
    refetchPatientNames,
    areReferencesLoading,
    areReferencesError,
    refetchReferences,
    areFilterOptionsLoading,
    areFilterOptionsError,
    refetchFilterOptions,
  } = useLaboratoryWorkPagedQueue({
    status: statusFilter === 'all' ? undefined : statusFilter,
    responsibleDoctorId: doctorFilter === 'all' ? undefined : doctorFilter,
    laboratoryId: laboratoryFilter === 'all' ? undefined : laboratoryFilter,
    dueFilter,
    search: debouncedSearch || undefined,
    limit: pageSize,
    offset,
  });

  const refreshAfterMutation = useCallback(async () => {
    await refetchSummary();
    if (offset !== 0) {
      setOffset(0);
      return;
    }
    await refetch();
  }, [offset, refetch, refetchSummary]);

  const mutations = useLaboratoryWorkMutations({ refresh: refreshAfterMutation });

  const handleFormSubmit = async (submission: LaboratoryWorkOrderDialogSubmit) => {
    try {
      if (submission.mode === 'create') await mutations.createOrder(submission.input);
      else await mutations.updateOrder(submission.input);
      setDialog(null);
    } catch {
      // Hook exposes the bounded error and refresh/retry state.
    }
  };

  const handleComplete = async (order: LaboratoryWorkOrderRecord) => {
    if (!hasValidVersion(order)) return;
    try {
      await mutations.completeOrder({ orderId: order.id, expectedVersion: order.mutationVersion! });
      setDialog(null);
    } catch {
      // Hook exposes the bounded error and canonical refresh state.
    }
  };

  const handleReopen = async (order: LaboratoryWorkOrderRecord, reason: string) => {
    if (!hasValidVersion(order)) return;
    try {
      await mutations.reopenOrder({ orderId: order.id, expectedVersion: order.mutationVersion!, reason });
      setDialog(null);
    } catch {
      // Hook exposes the bounded error and canonical refresh state.
    }
  };

  const refreshAll = useCallback(async () => {
    if (offset !== 0) {
      setOffset(0);
      await Promise.all([refetchSummary(), refetchFilterOptions()]);
      return;
    }
    await Promise.all([
      refetch(),
      refetchSummary(),
      refetchPatientNames(),
      refetchReferences(),
      refetchFilterOptions(),
    ]);
  }, [offset, refetch, refetchFilterOptions, refetchPatientNames, refetchReferences, refetchSummary]);

  const hasActiveQuery = statusFilter !== 'all'
    || doctorFilter !== 'all'
    || laboratoryFilter !== 'all'
    || dueFilter !== 'all'
    || debouncedSearch.length > 0;
  const currentPage = totalFiltered > 0 ? Math.floor(offset / limit) + 1 : 1;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
  const rangeStart = totalFiltered > 0 ? offset + 1 : 0;
  const rangeEnd = Math.min(offset + orders.length, totalFiltered);
  const canGoPrevious = offset > 0 && !isLoading;
  const canGoNext = offset + limit < totalFiltered && !isLoading;

  if (repositorySelection.backend !== 'supabase') {
    return (
      <div className="min-h-screen bg-slate-50 p-8" data-testid="laboratory-page-server-required">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-900">
          Серверная лабораторная очередь доступна в режиме активной клиники. Локальный прототип не имитирует серверную пагинацию и поиск.
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-50 p-8" data-testid="laboratory-page-error">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center" data-testid="laboratory-queue-error">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-600" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Не удалось загрузить лабораторную очередь</h1>
          <p className="mt-2 text-sm text-red-700">{error?.message ?? 'Повторите загрузку.'}</p>
          <button type="button" onClick={() => void refetch()} className="mt-5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white">
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8" data-testid="laboratory-page">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-700">
              <FlaskConical className="h-6 w-6" />
              <span className="text-sm font-semibold uppercase tracking-wide">Операционная очередь</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Лаборатория</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Общая операционная очередь лабораторных работ клиники. Фильтры, поиск и порядок применяются сервером до границы страницы.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {capabilities.canCreate && mutations.available && (
              <button type="button" data-testid="laboratory-queue-create" onClick={() => setDialog({ type: 'patient-picker' })} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                <Plus className="h-4 w-4" /> Новая работа
              </button>
            )}
            <button type="button" data-testid="laboratory-refresh" onClick={() => void refreshAll()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" /> Обновить
            </button>
          </div>
        </header>

        {capabilities.canCreate && !mutations.available && <div data-testid="laboratory-queue-mutations-unavailable" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Изменения доступны только в активной клинике с серверным подключением.</div>}
        {mutations.error && <div data-testid="laboratory-queue-mutation-error" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mutations.error.message}</div>}
        {mutations.refreshWarning && <div data-testid="laboratory-queue-refresh-warning" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{mutations.refreshWarning}</div>}
        {mutations.pendingRetryAction && <div data-testid="laboratory-queue-uncertain-warning" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900"><span><strong>Результат операции пока не подтверждён.</strong> Не создавайте новую операцию.</span><button type="button" data-testid="laboratory-queue-retry-pending" disabled={mutations.loading} onClick={() => void mutations.retryPendingMutation().catch(() => undefined)} className="rounded-lg border border-orange-300 bg-white px-3 py-1.5 font-medium">Повторить ту же операцию</button></div>}

        <section className={`mt-6 grid gap-3 sm:grid-cols-3 ${isSummaryLoading ? 'opacity-70' : ''}`} aria-label="Сводка лабораторной очереди" data-testid="laboratory-summary">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-sm text-amber-800">В работе</div><div className="mt-1 text-2xl font-bold text-amber-900">{summary.inProgress}</div></div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4"><div className="text-sm text-red-700">Просрочено</div><div className="mt-1 text-2xl font-bold text-red-900">{summary.overdue}</div></div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-sm text-emerald-700">Завершено</div><div className="mt-1 text-2xl font-bold text-emerald-900">{summary.completed}</div></div>
        </section>
        {isSummaryError && <div data-testid="laboratory-summary-error" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Сводку не удалось обновить. Страница заказов остаётся доступной. <button type="button" onClick={() => void refetchSummary()} className="font-semibold underline">Повторить</button></div>}

        {(arePatientNamesLoading || areReferencesLoading || arePatientNamesError || areReferencesError || areFilterOptionsError) && (
          <div className="mt-5 space-y-2">
            {(arePatientNamesLoading || areReferencesLoading) && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700" data-testid="laboratory-secondary-loading">
                Подгружаются имена пациентов и справочные данные текущей страницы…
              </div>
            )}
            {(arePatientNamesError || areReferencesError || areFilterOptionsError) && (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="laboratory-queue-reference-error">
                <div>Заказы загружены, но часть справочных названий временно недоступна.</div>
                {arePatientNamesError && (
                  <div className="flex flex-wrap items-center justify-between gap-3" data-testid="laboratory-patient-names-error">
                    <span>Имена части пациентов недоступны.</span>
                    <button type="button" onClick={() => void refetchPatientNames()} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium">Повторить имена пациентов</button>
                  </div>
                )}
                {areReferencesError && (
                  <div className="flex flex-wrap items-center justify-between gap-3" data-testid="laboratory-references-error">
                    <span>Врач, лаборатория или виды работ могут быть временно без названий.</span>
                    <button type="button" onClick={() => void refetchReferences()} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium">Повторить справочники страницы</button>
                  </div>
                )}
                {areFilterOptionsError && (
                  <div className="flex flex-wrap items-center justify-between gap-3" data-testid="laboratory-filter-options-error">
                    <span>Справочники фильтров временно недоступны.</span>
                    <button type="button" onClick={() => void refetchFilterOptions()} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium">Повторить фильтры</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <section className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5" aria-label="Фильтры лабораторной очереди">
          <label className="relative md:col-span-2 xl:col-span-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input aria-label="Поиск по лабораторной очереди" data-testid="laboratory-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Пациент, работа, номер" className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
          </label>
          <select aria-label="Статус лабораторной работы" data-testid="laboratory-status-filter" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as 'all' | LaboratoryWorkOrderStatus); setOffset(0); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
            <option value="all">Все статусы</option><option value="in_progress">В работе</option><option value="completed">Завершённые</option>
          </select>
          <select aria-label="Срок лабораторной работы" data-testid="laboratory-due-filter" value={dueFilter} onChange={(event) => { setDueFilter(event.target.value as LaboratoryWorkQueueDueFilter); setOffset(0); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
            <option value="all">Все сроки</option><option value="overdue">Просроченные</option><option value="today">Готовность сегодня</option><option value="upcoming">Предстоящие</option><option value="unscheduled">Без даты</option>
          </select>
          <select aria-label="Ответственный врач" data-testid="laboratory-doctor-filter" value={doctorFilter} disabled={areFilterOptionsLoading} onChange={(event) => { setDoctorFilter(event.target.value); setOffset(0); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100">
            <option value="all">Все врачи</option>{filterOptions.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.label}</option>)}
          </select>
          <select aria-label="Лаборатория" data-testid="laboratory-lab-filter" value={laboratoryFilter} disabled={areFilterOptionsLoading} onChange={(event) => { setLaboratoryFilter(event.target.value); setOffset(0); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100">
            <option value="all">Все лаборатории</option>{filterOptions.laboratories.map((laboratory) => <option key={laboratory.id} value={laboratory.id}>{laboratory.label}</option>)}
          </select>
        </section>

        {isLoading ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500" data-testid="laboratory-page-loading">Загружаем страницу лабораторной очереди…</div>
        ) : totalFiltered === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500" data-testid={hasActiveQuery ? 'laboratory-page-filtered-empty' : 'laboratory-page-empty'}>
            {hasActiveQuery ? 'По выбранным фильтрам работ нет.' : 'Лабораторных работ пока нет.'}
          </div>
        ) : (
          <div className="mt-6 space-y-3" data-testid="laboratory-order-list">
            {orders.map((order) => {
              const references = referencesByOrderId[order.id];
              const patientName = patientNamesById[order.patientId] ?? null;
              const bucket = dueBucket(order, timezone, nowMillis);
              const plannedReady = safeTimestamp(order.plannedReadyAt, timezone);
              const validVersion = hasValidVersion(order);
              const canEdit = mutations.available && capabilities.canEdit && order.status === 'in_progress' && validVersion;
              const canComplete = mutations.available && capabilities.canComplete && order.status === 'in_progress' && validVersion;
              const canReopen = mutations.available && capabilities.canReopen && order.status === 'completed' && validVersion;
              return (
                <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid={`laboratory-queue-order-${order.id}`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[order.status]}`}>{STATUS_LABELS[order.status]}</span>
                        {bucket !== 'completed' && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${DUE_CLASSES[bucket]}`}>{DUE_LABELS[bucket]}</span>}
                        {order.orderNumber && <span className="text-xs font-medium text-slate-500">№ {order.orderNumber}</span>}
                      </div>
                      <h2 className="mt-3 text-lg font-semibold text-slate-900">{order.title}</h2>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                        <span className="flex items-center gap-1.5"><UserRound className="h-4 w-4" />{patientName ?? 'Имя пациента недоступно'}</span>
                        <span className="flex items-center gap-1.5"><UserRound className="h-4 w-4" />{references?.responsibleDoctorName ?? 'Врач не указан'}</span>
                        <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" />{references?.laboratoryName ?? 'Лаборатория не указана'}</span>
                      </div>
                      {references && references.workTypeNames.length > 0 && (
                        <div className="mt-3 flex items-start gap-2 text-sm text-slate-600"><Tags className="mt-0.5 h-4 w-4 shrink-0" /><span>{references.workTypeNames.join(', ')}</span></div>
                      )}
                      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                        <div><span className="text-slate-400">Плановая готовность:</span> <span className="text-slate-700">{plannedReady ?? 'не указана'}</span></div>
                        <div><span className="text-slate-400">Отправлено:</span> <span className="text-slate-700">{safeTimestamp(order.sentToLabAt, timezone) ?? 'не указано'}</span></div>
                        <div><span className="text-slate-400">Примерка:</span> <span className="text-slate-700">{safeTimestamp(order.tryInAt, timezone) ?? 'не указана'}</span></div>
                        <div><span className="text-slate-400">Обновлено:</span> <span className="text-slate-700">{formatInstantInTenant(order.updatedAt, timezone, { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
                      </div>
                      {(order.shade || order.selectedTeeth.length > 0) && (
                        <div className="mt-3 text-xs text-slate-500">
                          {order.shade && <span>Оттенок: {order.shade}</span>}{order.shade && order.selectedTeeth.length > 0 && <span> · </span>}{order.selectedTeeth.length > 0 && <span>Зубы: {order.selectedTeeth.join(', ')}</span>}
                        </div>
                      )}
                      {order.comment && <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{order.comment}</div>}
                      {!validVersion && (capabilities.canEdit || capabilities.canComplete || capabilities.canReopen) && <div data-testid={`laboratory-queue-version-warning-${order.id}`} className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Обновите текущие данные перед изменением этой лабораторной работы.</div>}
                      {(canEdit || canComplete || canReopen) && (
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                          {canEdit && <button type="button" data-testid={`laboratory-queue-edit-${order.id}`} onClick={() => setDialog({ type: 'edit', order })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium"><Pencil className="h-4 w-4" />Изменить</button>}
                          {canComplete && <button type="button" data-testid={`laboratory-queue-complete-${order.id}`} onClick={() => setDialog({ type: 'complete', order })} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" />Завершить работу</button>}
                          {canReopen && <button type="button" data-testid={`laboratory-queue-reopen-${order.id}`} onClick={() => setDialog({ type: 'reopen', order })} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800"><RotateCcw className="h-4 w-4" />Вернуть в работу</button>}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-sm text-slate-500">
                      {bucket === 'overdue' ? <span className="inline-flex items-center gap-1.5 font-medium text-red-700"><AlertTriangle className="h-4 w-4" />Требует внимания</span>
                        : order.status === 'completed' ? <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" />Работа завершена</span>
                          : plannedReady ? <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4" />{plannedReady}</span>
                            : <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />Без плановой даты</span>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between" aria-label="Пагинация лабораторной очереди" data-testid="laboratory-pagination">
          <div data-testid="laboratory-pagination-range">
            {totalFiltered > 0 ? `Показано ${rangeStart}–${rangeEnd} из ${totalFiltered}` : '0 работ'} · Страница {currentPage} из {totalPages}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span>На странице</span>
              <select aria-label="Размер страницы лабораторной очереди" data-testid="laboratory-page-size" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setOffset(0); }} className="rounded-lg border border-slate-300 px-2 py-1.5">
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <button type="button" data-testid="laboratory-page-previous" disabled={!canGoPrevious} onClick={() => setOffset((current) => Math.max(0, current - limit))} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40">Назад</button>
            <button type="button" data-testid="laboratory-page-next" disabled={!canGoNext} onClick={() => setOffset((current) => current + limit)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40">Далее</button>
          </div>
        </section>

        {dialog?.type === 'patient-picker' && <LaboratoryPatientPicker onClose={() => setDialog(null)} onSelect={(patient) => setDialog({ type: 'create', patient })} />}
        {dialog?.type === 'create' && <LaboratoryWorkOrderDialog key={`queue-create-${dialog.patient.id}`} patientId={dialog.patient.id} patientLabel={`${dialog.patient.fullName}${dialog.patient.phone ? ` · ${dialog.patient.phone}` : ''}`} timezone={timezone} submitting={mutations.loading} onClose={() => setDialog(null)} onSubmit={handleFormSubmit} />}
        {dialog?.type === 'edit' && <LaboratoryWorkOrderDialog key={`queue-edit-${dialog.order.id}-${dialog.order.mutationVersion ?? 'missing'}`} patientId={dialog.order.patientId} patientLabel={patientNamesById[dialog.order.patientId] ?? 'Имя пациента недоступно'} timezone={timezone} order={dialog.order} submitting={mutations.loading} onClose={() => setDialog(null)} onSubmit={handleFormSubmit} />}
        {dialog?.type === 'complete' && <LaboratoryWorkCompleteDialog order={dialog.order} submitting={mutations.loading} onClose={() => setDialog(null)} onConfirm={() => handleComplete(dialog.order)} />}
        {dialog?.type === 'reopen' && <LaboratoryWorkReopenDialog order={dialog.order} submitting={mutations.loading} onClose={() => setDialog(null)} onConfirm={(reason) => handleReopen(dialog.order, reason)} />}
      </div>
    </div>
  );
}

export default LaboratoryPage;
