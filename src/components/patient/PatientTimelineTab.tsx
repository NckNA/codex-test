import { CalendarDays, Clock3, History, Filter } from 'lucide-react';
import {
  canRoleSeePatientTimelineEvent,
  filterPatientTimelineEvents,
  sortPatientTimelineEvents,
  type PatientTimelineEvent,
  type PatientTimelineEventCategory,
} from '../../data/aggregators/PatientTimelineAggregator';

interface PatientTimelineTabProps {
  events: PatientTimelineEvent[];
  isLoading?: boolean;
  error?: Error | null;
  role?: string | null;
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean) => void;
  selectedCategory: PatientTimelineEventCategory | 'all';
  onSelectedCategoryChange: (value: PatientTimelineEventCategory | 'all') => void;
}

const CATEGORY_LABELS: Record<PatientTimelineEventCategory, string> = {
  patient: 'Пациент',
  complaint: 'Жалоба',
  dental_chart: 'Зубная карта',
  finding: 'Находка',
  treatment_plan: 'План лечения',
  appointment: 'Приём',
  file: 'Файл',
  payment: 'Оплата',
  stock: 'Склад',
  audit: 'Активность',
};

const CATEGORY_FILTERS: Array<{ value: PatientTimelineEventCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'patient', label: 'Пациент' },
  { value: 'complaint', label: 'Жалобы' },
  { value: 'finding', label: 'Находки' },
  { value: 'treatment_plan', label: 'Планы лечения' },
  { value: 'appointment', label: 'Приёмы' },
  { value: 'file', label: 'Файлы' },
  { value: 'payment', label: 'Оплаты' },
  { value: 'stock', label: 'Склад' },
  { value: 'audit', label: 'Активность' },
];

const STATUS_LABELS: Record<string, string> = {
  active: 'Активный',
  archived: 'Архив',
  discovered: 'Обнаружено',
  planned: 'Запланировано',
  in_treatment: 'В лечении',
  completed: 'Завершено',
  declined_by_patient: 'Отказ пациента',
  monitoring: 'Наблюдение',
  draft: 'Черновик',
  approved: 'Утверждён',
  in_progress: 'В работе',
  cancelled: 'Отменён',
  confirmed: 'Подтверждён',
  no_show: 'Не пришёл',
  dental_photo: 'Фото зубов',
  xray: 'Снимок',
  scan: 'Скан',
  document: 'Документ',
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата не указана';

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getStatusLabel(status?: string) {
  if (!status) return null;
  return STATUS_LABELS[status] ?? status;
}

export function PatientTimelineTab({
  events,
  isLoading = false,
  error = null,
  role,
  includeArchived,
  onIncludeArchivedChange,
  selectedCategory,
  onSelectedCategoryChange,
}: PatientTimelineTabProps) {
  if (!role) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-500">
        <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>История пациента недоступна без активной клиники.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-8 text-center text-red-600">
        <p>Не удалось загрузить историю пациента.</p>
        <p className="mt-2 text-xs text-red-500">{error.message}</p>
      </div>
    );
  }

  const visibleByRole = events.filter((event) => canRoleSeePatientTimelineEvent(role, event));
  const filteredEvents = filterPatientTimelineEvents(visibleByRole, {
    categories: selectedCategory === 'all' ? undefined : [selectedCategory],
    includeArchived,
  });
  const sortedEvents = sortPatientTimelineEvents(filteredEvents);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" /> История пациента
          </h3>
          <p className="text-xs text-slate-500 mt-1">Единая read-only лента событий пациента.</p>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => onIncludeArchivedChange(event.target.checked)}
            className="rounded border-slate-300"
          />
          Показать архивные события
        </label>
      </div>

      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Фильтр:
        </span>
        {CATEGORY_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => onSelectedCategoryChange(filter.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selectedCategory === filter.value
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-slate-500">
          <Clock3 className="w-12 h-12 mx-auto mb-3 text-slate-300 animate-pulse" />
          <p>Загрузка истории пациента...</p>
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="p-8 text-center text-slate-500">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>История пациента пока пуста.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {sortedEvents.map((event) => {
            const statusLabel = getStatusLabel(event.sourceStatus);
            return (
              <article key={event.id} className={`p-4 flex gap-3 ${event.isArchived ? 'bg-slate-50 text-slate-500' : ''}`}>
                <div className="mt-1 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-blue-50 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {CATEGORY_LABELS[event.category]}
                    </span>
                    {statusLabel && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {statusLabel}
                      </span>
                    )}
                    {event.isArchived && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600">
                        Архив
                      </span>
                    )}
                  </div>
                  <h4 className="font-medium text-slate-800">{event.title}</h4>
                  {event.description && <p className="mt-1 text-sm text-slate-600">{event.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>{formatDateTime(event.occurredAt)}</span>
                    {event.toothId && <span>Зуб: {event.toothId}</span>}
                    {event.sourceType && <span>Источник: {CATEGORY_LABELS[event.category]}</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
