import { useMemo, useState } from 'react';
import { AlertTriangle, Clock3, FileSearch, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  DEFAULT_AUDIT_ACTIVITY_LIMIT,
  type ActivityEvent,
  type ActivityEventCategory,
  type ActivityEventVisibility,
  type AuditEvent,
  type AuditEventCategory,
  type AuditEventSeverity,
} from '../../data/repositories/AuditActivityRepository';
import {
  type AuditActivityViewerFilters,
  type AuditActivityViewerTab,
  useAuditActivityEvents,
} from '../../data/hooks/useAuditActivityEvents';

interface AdminAuditViewerProps {
  tenantId: string;
  role: string;
  backendAvailable?: boolean;
}

const ACTIVITY_CATEGORY_LABELS: Record<ActivityEventCategory, string> = {
  patient: 'Пациент',
  complaint: 'Жалоба',
  dental_chart: 'Зубная карта',
  finding: 'Находка',
  treatment_plan: 'План лечения',
  appointment: 'Приём',
  visit: 'Визит',
  encounter: 'Осмотр',
  completed_service: 'Выполненная услуга',
  file: 'Файл',
  document: 'Документ',
  payment: 'Оплата',
  stock: 'Склад',
  audit: 'Аудит',
  system: 'Система',
};

const AUDIT_CATEGORY_LABELS: Record<AuditEventCategory, string> = {
  auth: 'Авторизация',
  tenant: 'Клиника',
  role_membership: 'Роли',
  patient: 'Пациент',
  appointment: 'Приём',
  visit: 'Визит',
  encounter: 'Осмотр',
  finding: 'Находка',
  treatment_plan: 'План лечения',
  completed_service: 'Выполненная услуга',
  file: 'Файл',
  document: 'Документ',
  payment: 'Оплата',
  stock: 'Склад',
  dictionary: 'Справочник',
  billing_subscription: 'Подписка',
  system: 'Система',
  support_access: 'Доступ поддержки',
};

const SEVERITY_LABELS: Record<AuditEventSeverity, string> = {
  debug: 'Debug',
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
};

const VISIBILITY_LABELS: Record<ActivityEventVisibility, string> = {
  clinical: 'Клиническая',
  admin: 'Административная',
  financial: 'Финансовая',
  system: 'Системная',
};

const ACTIVITY_CATEGORY_OPTIONS = Object.keys(ACTIVITY_CATEGORY_LABELS) as ActivityEventCategory[];
const AUDIT_CATEGORY_OPTIONS = Object.keys(AUDIT_CATEGORY_LABELS) as AuditEventCategory[];
const SEVERITY_OPTIONS = Object.keys(SEVERITY_LABELS) as AuditEventSeverity[];
const VISIBILITY_OPTIONS = Object.keys(VISIBILITY_LABELS) as ActivityEventVisibility[];
const LIMIT_OPTIONS = [25, DEFAULT_AUDIT_ACTIVITY_LIMIT, 100, 200];

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Дата не указана';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата не указана';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function optionalValue(value: string | null | undefined) {
  return value?.trim() ? value : '—';
}

function updateTextFilter(value: string): string | undefined {
  return value.trim() ? value : undefined;
}

export function AdminAuditViewer({ tenantId, role, backendAvailable = true }: AdminAuditViewerProps) {
  const [activeTab, setActiveTab] = useState<AuditActivityViewerTab>('activity');
  const [category, setCategory] = useState<string>('all');
  const [severity, setSeverity] = useState<AuditEventSeverity | 'all'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [visibility, setVisibility] = useState<ActivityEventVisibility | 'all'>('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [targetType, setTargetType] = useState('');
  const [patientId, setPatientId] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [limit, setLimit] = useState(DEFAULT_AUDIT_ACTIVITY_LIMIT);
  const [offset, setOffset] = useState(0);

  const filters = useMemo<AuditActivityViewerFilters>(() => ({
    category: category === 'all' ? undefined : category,
    severity,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    visibility,
    includeArchived,
    targetType: updateTextFilter(targetType),
    patientId: updateTextFilter(patientId),
    actorUserId: updateTextFilter(actorUserId),
    limit,
    offset,
  }), [actorUserId, category, dateFrom, dateTo, includeArchived, limit, offset, patientId, severity, targetType, visibility]);

  const { activityEvents, auditEvents, isLoading, error, refresh, isEnabled } = useAuditActivityEvents({
    tenantId,
    role,
    activeTab,
    filters,
    backendAvailable,
  });

  const rowsCount = activeTab === 'activity' ? activityEvents.length : auditEvents.length;
  const canGoBack = offset > 0;
  const canGoNext = rowsCount >= limit;

  const changeTab = (tab: AuditActivityViewerTab) => {
    setActiveTab(tab);
    setCategory('all');
    setOffset(0);
  };

  const resetOffset = () => setOffset(0);

  if (!isEnabled) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-semibold">Журнал недоступен</h2>
            <p className="mt-1 text-sm">Для просмотра нужен активный Supabase backend и роль администратора клиники.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4" data-testid="admin-audit-viewer">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <ShieldCheck className="h-6 w-6 text-blue-600" /> Журнал действий
            </h1>
            <p className="mt-1 text-sm text-slate-500">Аудит и активность клиники. Только чтение.</p>
          </div>
          <button
            type="button"
            onClick={() => { void refresh(); }}
            className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Обновить
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => changeTab('activity')}
            className={`px-4 py-3 text-sm font-medium ${activeTab === 'activity' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Активность
          </button>
          <button
            type="button"
            onClick={() => changeTab('audit')}
            className={`px-4 py-3 text-sm font-medium ${activeTab === 'audit' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Аудит
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-medium text-slate-600">
            Категория
            <select
              value={category}
              onChange={(event) => { setCategory(event.target.value); resetOffset(); }}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="all">Все</option>
              {(activeTab === 'activity' ? ACTIVITY_CATEGORY_OPTIONS : AUDIT_CATEGORY_OPTIONS).map((value) => (
                <option key={value} value={value}>
                  {activeTab === 'activity'
                    ? ACTIVITY_CATEGORY_LABELS[value as ActivityEventCategory]
                    : AUDIT_CATEGORY_LABELS[value as AuditEventCategory]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-600">
            Важность
            <select
              value={severity}
              onChange={(event) => { setSeverity(event.target.value as AuditEventSeverity | 'all'); resetOffset(); }}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="all">Все</option>
              {SEVERITY_OPTIONS.map((value) => <option key={value} value={value}>{SEVERITY_LABELS[value]}</option>)}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-600">
            С даты
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => { setDateFrom(event.target.value); resetOffset(); }}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            />
          </label>

          <label className="text-xs font-medium text-slate-600">
            По дату
            <input
              type="date"
              value={dateTo}
              onChange={(event) => { setDateTo(event.target.value); resetOffset(); }}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            />
          </label>

          {activeTab === 'activity' ? (
            <>
              <label className="text-xs font-medium text-slate-600">
                Видимость
                <select
                  value={visibility}
                  onChange={(event) => { setVisibility(event.target.value as ActivityEventVisibility | 'all'); resetOffset(); }}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  <option value="all">Все</option>
                  {VISIBILITY_OPTIONS.map((value) => <option key={value} value={value}>{VISIBILITY_LABELS[value]}</option>)}
                </select>
              </label>
              <label className="mt-6 flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(event) => { setIncludeArchived(event.target.checked); resetOffset(); }}
                  className="rounded border-slate-300"
                />
                Показать архивные
              </label>
            </>
          ) : (
            <>
              <label className="text-xs font-medium text-slate-600">
                Target type
                <input
                  value={targetType}
                  onChange={(event) => { setTargetType(event.target.value); resetOffset(); }}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  placeholder="patient, file..."
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Patient ID
                <input
                  value={patientId}
                  onChange={(event) => { setPatientId(event.target.value); resetOffset(); }}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  placeholder="UUID пациента"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Actor user ID
                <input
                  value={actorUserId}
                  onChange={(event) => { setActorUserId(event.target.value); resetOffset(); }}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  placeholder="UUID пользователя"
                />
              </label>
            </>
          )}

          <label className="text-xs font-medium text-slate-600">
            Лимит
            <select
              value={limit}
              onChange={(event) => { setLimit(Number(event.target.value)); resetOffset(); }}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {LIMIT_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>

        {error ? (
          <div className="p-8 text-center text-red-600">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-300" />
            <p className="font-medium">Не удалось загрузить журнал.</p>
            <p className="mt-2 text-xs text-red-500">{error.message}</p>
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-slate-500">
            <Clock3 className="mx-auto mb-3 h-10 w-10 animate-pulse text-slate-300" />
            <p>Загрузка журнала...</p>
          </div>
        ) : activeTab === 'activity' ? (
          <ActivityList events={activityEvents} />
        ) : (
          <AuditList events={auditEvents} />
        )}

        <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm text-slate-600">
          <span>Показано: {rowsCount}. Смещение: {offset}.</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canGoBack}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="rounded border border-slate-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Назад
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setOffset(offset + limit)}
              className="rounded border border-slate-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Далее
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="p-8 text-center text-slate-500">
      <FileSearch className="mx-auto mb-3 h-10 w-10 text-slate-300" />
      <p>Событий по выбранным фильтрам нет.</p>
    </div>
  );
}

function ActivityList({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) return <EmptyState />;

  return (
    <div className="divide-y divide-slate-100">
      {events.map((event) => (
        <article key={event.id} className="p-4" data-testid="activity-event-row">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">{ACTIVITY_CATEGORY_LABELS[event.category]}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{event.type}</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{VISIBILITY_LABELS[event.visibility]}</span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">{SEVERITY_LABELS[event.severity]}</span>
                {event.isArchived && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700">Архив</span>}
              </div>
              <h2 className="mt-2 font-semibold text-slate-900">{event.title}</h2>
              {event.description && <p className="mt-1 text-sm text-slate-600">{event.description}</p>}
            </div>
            <time className="shrink-0 text-sm text-slate-500">{formatDateTime(event.occurredAt)}</time>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 md:grid-cols-3">
            <div><dt className="font-medium text-slate-600">Actor</dt><dd>{optionalValue(event.actorUserId)}</dd></div>
            <div><dt className="font-medium text-slate-600">Patient</dt><dd>{optionalValue(event.patientId)}</dd></div>
            <div><dt className="font-medium text-slate-600">Source</dt><dd>{event.sourceType} / {event.sourceId}</dd></div>
            <div><dt className="font-medium text-slate-600">Status</dt><dd>{optionalValue(event.sourceStatus)}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function AuditList({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) return <EmptyState />;

  return (
    <div className="divide-y divide-slate-100">
      {events.map((event) => (
        <article key={event.id} className="p-4" data-testid="audit-event-row">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-700">{AUDIT_CATEGORY_LABELS[event.category]}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{event.action}</span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">{SEVERITY_LABELS[event.severity]}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{event.redactionLevel}</span>
              </div>
              <h2 className="mt-2 font-semibold text-slate-900">{event.targetType}: {event.targetId}</h2>
              {event.reason && <p className="mt-1 text-sm text-slate-600">Причина: {event.reason}</p>}
            </div>
            <time className="shrink-0 text-sm text-slate-500">{formatDateTime(event.createdAt)}</time>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 md:grid-cols-3">
            <div><dt className="font-medium text-slate-600">Actor</dt><dd>{optionalValue(event.actorDisplayName ?? event.actorUserId)}</dd></div>
            <div><dt className="font-medium text-slate-600">Role</dt><dd>{optionalValue(event.actorTenantRole ?? event.actorRole)}</dd></div>
            <div><dt className="font-medium text-slate-600">Patient</dt><dd>{optionalValue(event.patientId)}</dd></div>
            <div><dt className="font-medium text-slate-600">Target</dt><dd>{event.targetType} / {event.targetId}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}
