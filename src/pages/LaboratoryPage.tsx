import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FlaskConical,
  RefreshCw,
  Search,
  Tags,
  UserRound,
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { useLaboratoryWorkQueue } from '../data/hooks/useLaboratoryWorkQueue';
import { usePatientLaboratoryWorkReferences } from '../data/hooks/usePatientLaboratoryWorkReferences';
import type { LaboratoryWorkOrderRecord, LaboratoryWorkOrderStatus } from '../data/repositories/LaboratoryWorkRepository';
import { compareInstantToTenantDay, formatInstantInTenant, tenantNowDate } from '../domain/timezone';

type DueFilter = 'all' | 'overdue' | 'today' | 'upcoming' | 'unscheduled';

type DueBucket = Exclude<DueFilter, 'all'> | 'completed';

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

function dueBucket(order: LaboratoryWorkOrderRecord, timezone: string, nowMillis: number): DueBucket {
  if (order.status === 'completed') return 'completed';
  if (!order.plannedReadyAt) return 'unscheduled';
  if (Date.parse(order.plannedReadyAt) < nowMillis) return 'overdue';
  const today = tenantNowDate(timezone, new Date(nowMillis));
  return compareInstantToTenantDay(order.plannedReadyAt, today, timezone) === 0 ? 'today' : 'upcoming';
}

function orderPriority(order: LaboratoryWorkOrderRecord, timezone: string, nowMillis: number): number {
  switch (dueBucket(order, timezone, nowMillis)) {
    case 'overdue': return 0;
    case 'today': return 1;
    case 'upcoming': return 2;
    case 'unscheduled': return 3;
    case 'completed': return 4;
  }
}

function safeTimestamp(value: string | null, timezone: string): string | null {
  if (!value) return null;
  return formatInstantInTenant(value, timezone, { dateStyle: 'medium', timeStyle: 'short' });
}

export function LaboratoryPage() {
  const { activeTenant } = useTenant();
  const timezone = activeTenant?.timezone ?? 'Asia/Almaty';
  const [statusFilter, setStatusFilter] = useState<'all' | LaboratoryWorkOrderStatus>('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [laboratoryFilter, setLaboratoryFilter] = useState('all');
  const [dueFilter, setDueFilter] = useState<DueFilter>('all');
  const [search, setSearch] = useState('');
  const [nowMillis] = useState(() => Date.now());

  const {
    orders,
    patientNamesById,
    isLoading,
    isError,
    error,
    refetch,
    arePatientNamesLoading,
    arePatientNamesError,
    refetchPatientNames,
  } = useLaboratoryWorkQueue();
  const {
    referencesByOrderId,
    isLoading: areReferencesLoading,
    isError: areReferencesError,
    refetch: refetchReferences,
  } = usePatientLaboratoryWorkReferences(orders);

  const doctors = useMemo(() => {
    const map = new Map<string, string>();
    for (const order of orders) {
      const name = referencesByOrderId[order.id]?.responsibleDoctorName;
      if (order.responsibleDoctorId && name) map.set(order.responsibleDoctorId, name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
  }, [orders, referencesByOrderId]);

  const laboratories = useMemo(() => {
    const map = new Map<string, string>();
    for (const order of orders) {
      const name = referencesByOrderId[order.id]?.laboratoryName;
      if (order.laboratoryId && name) map.set(order.laboratoryId, name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
  }, [orders, referencesByOrderId]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('ru');
    return orders
      .filter((order) => {
        if (statusFilter !== 'all' && order.status !== statusFilter) return false;
        if (doctorFilter !== 'all' && order.responsibleDoctorId !== doctorFilter) return false;
        if (laboratoryFilter !== 'all' && order.laboratoryId !== laboratoryFilter) return false;
        const bucket = dueBucket(order, timezone, nowMillis);
        if (dueFilter !== 'all' && bucket !== dueFilter) return false;
        if (!normalizedSearch) return true;
        const references = referencesByOrderId[order.id];
        const patientName = patientNamesById[order.patientId] ?? '';
        const searchable = [
          order.title,
          order.orderNumber ?? '',
          patientName,
          references?.responsibleDoctorName ?? '',
          references?.laboratoryName ?? '',
          ...(references?.workTypeNames ?? []),
        ].join(' ').toLocaleLowerCase('ru');
        return searchable.includes(normalizedSearch);
      })
      .sort((left, right) => {
        const priority = orderPriority(left, timezone, nowMillis) - orderPriority(right, timezone, nowMillis);
        if (priority !== 0) return priority;
        const leftReady = left.plannedReadyAt ? Date.parse(left.plannedReadyAt) : Number.MAX_SAFE_INTEGER;
        const rightReady = right.plannedReadyAt ? Date.parse(right.plannedReadyAt) : Number.MAX_SAFE_INTEGER;
        if (leftReady !== rightReady) return leftReady - rightReady;
        return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      });
  }, [doctorFilter, dueFilter, laboratoryFilter, nowMillis, orders, patientNamesById, referencesByOrderId, search, statusFilter, timezone]);

  const summary = useMemo(() => ({
    inProgress: orders.filter((order) => order.status === 'in_progress').length,
    overdue: orders.filter((order) => dueBucket(order, timezone, nowMillis) === 'overdue').length,
    completed: orders.filter((order) => order.status === 'completed').length,
  }), [nowMillis, orders, timezone]);

  const refreshAll = async () => {
    await refetch();
    await Promise.all([refetchPatientNames(), refetchReferences()]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8" data-testid="laboratory-page-loading">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          Загружаем лабораторную очередь…
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
              Общая read-only очередь лабораторных работ клиники. Изменение заказов и статусов на этом экране недоступно.
            </p>
          </div>
          <button type="button" onClick={() => void refreshAll()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Обновить
          </button>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Сводка лабораторной очереди">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-sm text-amber-800">В работе</div><div className="mt-1 text-2xl font-bold text-amber-900">{summary.inProgress}</div></div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4"><div className="text-sm text-red-700">Просрочено</div><div className="mt-1 text-2xl font-bold text-red-900">{summary.overdue}</div></div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-sm text-emerald-700">Завершено</div><div className="mt-1 text-2xl font-bold text-emerald-900">{summary.completed}</div></div>
        </section>

        {(arePatientNamesLoading || areReferencesLoading || arePatientNamesError || areReferencesError) && (
          <div className="mt-5 space-y-2">
            {(arePatientNamesLoading || areReferencesLoading) && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700" data-testid="laboratory-secondary-loading">
                Подгружаются имена пациентов и справочные данные…
              </div>
            )}
            {(arePatientNamesError || areReferencesError) && (
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
                    <button type="button" onClick={() => void refetchReferences()} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium">Повторить справочники</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <section className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5" aria-label="Фильтры лабораторной очереди">
          <label className="relative md:col-span-2 xl:col-span-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input aria-label="Поиск по лабораторной очереди" data-testid="laboratory-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Пациент, работа, номер" className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
          </label>
          <select aria-label="Статус лабораторной работы" data-testid="laboratory-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | LaboratoryWorkOrderStatus)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
            <option value="all">Все статусы</option><option value="in_progress">В работе</option><option value="completed">Завершённые</option>
          </select>
          <select data-testid="laboratory-due-filter" value={dueFilter} onChange={(event) => setDueFilter(event.target.value as DueFilter)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
            <option value="all">Все сроки</option><option value="overdue">Просроченные</option><option value="today">Готовность сегодня</option><option value="upcoming">Предстоящие</option><option value="unscheduled">Без даты</option>
          </select>
          <select aria-label="Ответственный врач" data-testid="laboratory-doctor-filter" value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
            <option value="all">Все врачи</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
          </select>
          <select aria-label="Лаборатория" data-testid="laboratory-lab-filter" value={laboratoryFilter} onChange={(event) => setLaboratoryFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
            <option value="all">Все лаборатории</option>{laboratories.map((laboratory) => <option key={laboratory.id} value={laboratory.id}>{laboratory.name}</option>)}
          </select>
        </section>

        {orders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500" data-testid="laboratory-page-empty">
            Лабораторных работ пока нет.
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500" data-testid="laboratory-page-filtered-empty">
            По выбранным фильтрам работ нет.
          </div>
        ) : (
          <div className="mt-6 space-y-3" data-testid="laboratory-order-list">
            {filteredOrders.map((order) => {
              const references = referencesByOrderId[order.id];
              const patientName = patientNamesById[order.patientId] ?? null;
              const bucket = dueBucket(order, timezone, nowMillis);
              const plannedReady = safeTimestamp(order.plannedReadyAt, timezone);
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
      </div>
    </div>
  );
}

export default LaboratoryPage;
