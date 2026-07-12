import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BellRing,
  CalendarClock,
  ChevronRight,
  Clock3,
  History,
  PhoneCall,
  RefreshCw,
  Search,
  SkipForward,
  UserRound,
  X,
} from 'lucide-react';
import { useAppointmentReminderQueue } from '../data/hooks/useAppointmentReminderQueue';
import { useTenant } from '../contexts/TenantContext';
import {
  compareInstantToTenantDay,
  formatInstantInTenant,
  tenantDateTimeToInstant,
  tenantNowDate,
} from '../domain/timezone';
import type {
  AppointmentContactChannel,
  AppointmentContactOutcome,
  AppointmentReminderQueueItem,
  AppointmentReminderType,
} from '../types';

const TYPE_LABELS: Record<AppointmentReminderType, string> = {
  confirmation_request: 'Запрос подтверждения',
  day_before_reminder: 'Напоминание за день',
  control_call_task: 'Контрольный звонок',
  callback_task: 'Обратный звонок',
};

const OUTCOME_LABELS: Record<AppointmentContactOutcome, string> = {
  confirmed: 'Подтвердил запись',
  no_answer: 'Не ответил',
  unreachable: 'Недоступен',
  callback_requested: 'Просит перезвонить',
  declined: 'Отказался от записи',
  wrong_number: 'Неверный номер',
  message_sent: 'Сообщение отправлено вручную',
  other: 'Другой результат',
};

const CHANNEL_LABELS: Record<AppointmentContactChannel, string> = {
  phone: 'Телефонный звонок',
  whatsapp: 'WhatsApp вручную',
  sms: 'SMS вручную',
  email: 'Email вручную',
  in_person: 'Лично',
  other: 'Другой канал',
};

const CONFIRMATION_LABELS: Record<string, string> = {
  unconfirmed: 'Не подтверждена',
  contact_in_progress: 'Связь выполняется',
  callback_requested: 'Нужно перезвонить',
  confirmed: 'Подтверждена',
  unreachable: 'Недоступен',
};

type QueueBucket = 'all' | 'overdue' | 'today' | 'upcoming';
type PageTab = 'active' | 'history';

const bucketForItem = (
  item: AppointmentReminderQueueItem,
  timezone: string,
  nowMillis: number,
): Exclude<QueueBucket, 'all'> => {
  if (Date.parse(item.job.dueAt) < nowMillis) return 'overdue';
  const today = tenantNowDate(timezone, new Date(nowMillis));
  return compareInstantToTenantDay(item.job.dueAt, today, timezone) === 0 ? 'today' : 'upcoming';
};

const overdueLabel = (dueAt: string, nowMillis: number): string => {
  const differenceMinutes = Math.max(0, Math.floor((nowMillis - Date.parse(dueAt)) / 60000));
  if (differenceMinutes < 60) return `${differenceMinutes} мин.`;
  const hours = Math.floor(differenceMinutes / 60);
  if (hours < 24) return `${hours} ч. ${differenceMinutes % 60} мин.`;
  const days = Math.floor(hours / 24);
  return `${days} дн. ${hours % 24} ч.`;
};

const terminalMoment = (item: AppointmentReminderQueueItem): string => (
  item.job.completedAt
  ?? item.job.skippedAt
  ?? item.job.cancelledAt
  ?? item.job.supersededAt
  ?? item.job.updatedAt
);

const terminalLabel = (item: AppointmentReminderQueueItem): string => {
  switch (item.job.state) {
    case 'completed': return 'Завершена';
    case 'skipped': return 'Пропущена';
    case 'cancelled': return 'Отменена';
    case 'superseded': return 'Устарела';
    default: return item.job.state;
  }
};

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
      <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label={title}>
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Закрыть">
            <X className="h-5 w-5" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function ItemContext({ item, timezone }: { item: AppointmentReminderQueueItem; timezone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className="font-semibold text-slate-900">{item.patient.fullName}</div>
      <div className="mt-1 text-slate-600">{item.patient.phone || 'Телефон не указан'}</div>
      <div className="mt-2 grid gap-1 text-slate-600 sm:grid-cols-2">
        <span>Запись: {formatInstantInTenant(item.appointment.start, timezone)}</span>
        <span>Врач: {item.doctor.fullName}</span>
        <span>Задача: {TYPE_LABELS[item.job.reminderType]}</span>
        <span>Статус: {CONFIRMATION_LABELS[item.appointment.confirmationState ?? 'unconfirmed']}</span>
      </div>
      {item.lastAttempt && (
        <div className="mt-2 text-xs text-slate-500">
          Последняя попытка: {OUTCOME_LABELS[item.lastAttempt.outcome]} · {formatInstantInTenant(item.lastAttempt.attemptedAt, timezone)}
        </div>
      )}
    </div>
  );
}

export function ReminderOperationsPage() {
  const { activeTenant } = useTenant();
  const timezone = activeTenant?.timezone ?? 'Asia/Almaty';
  const {
    jobs,
    history,
    loading,
    error,
    completingJobId,
    deferringJobId,
    skippingJobId,
    reconcilingOperation,
    canAccess,
    refresh,
    completeJob,
    deferJob,
    skipJob,
    clearError,
  } = useAppointmentReminderQueue();

  const [tab, setTab] = useState<PageTab>('active');
  const [bucket, setBucket] = useState<QueueBucket>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | AppointmentReminderType>('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [confirmationFilter, setConfirmationFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [completeItem, setCompleteItem] = useState<AppointmentReminderQueueItem | null>(null);
  const [deferItem, setDeferItem] = useState<AppointmentReminderQueueItem | null>(null);
  const [skipItem, setSkipItem] = useState<AppointmentReminderQueueItem | null>(null);
  const [channel, setChannel] = useState<AppointmentContactChannel>('phone');
  const [outcome, setOutcome] = useState<AppointmentContactOutcome | ''>('');
  const [note, setNote] = useState('');
  const [deferLocalTime, setDeferLocalTime] = useState('');
  const [deferReason, setDeferReason] = useState('');
  const [skipReason, setSkipReason] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nowMillis] = useState(() => Date.now());

  const doctors = useMemo(() => (
    [...new Map(jobs.map((item) => [item.doctor.id, item.doctor])).values()]
      .sort((left, right) => left.fullName.localeCompare(right.fullName, 'ru'))
  ), [jobs]);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('ru');
    return jobs.filter((item) => {
      const itemBucket = bucketForItem(item, timezone, nowMillis);
      if (bucket !== 'all' && itemBucket !== bucket) return false;
      if (typeFilter !== 'all' && item.job.reminderType !== typeFilter) return false;
      if (doctorFilter !== 'all' && item.doctor.id !== doctorFilter) return false;
      if (confirmationFilter !== 'all' && (item.appointment.confirmationState ?? 'unconfirmed') !== confirmationFilter) return false;
      if (normalizedSearch && !`${item.patient.fullName} ${item.patient.phone}`.toLocaleLowerCase('ru').includes(normalizedSearch)) return false;
      return true;
    });
  }, [bucket, confirmationFilter, doctorFilter, jobs, nowMillis, search, timezone, typeFilter]);

  const groups = useMemo(() => ({
    overdue: filteredJobs.filter((item) => bucketForItem(item, timezone, nowMillis) === 'overdue'),
    today: filteredJobs.filter((item) => bucketForItem(item, timezone, nowMillis) === 'today'),
    upcoming: filteredJobs.filter((item) => bucketForItem(item, timezone, nowMillis) === 'upcoming'),
  }), [filteredJobs, nowMillis, timezone]);

  const resetDialog = () => {
    setCompleteItem(null);
    setDeferItem(null);
    setSkipItem(null);
    setChannel('phone');
    setOutcome('');
    setNote('');
    setDeferLocalTime('');
    setDeferReason('');
    setSkipReason('');
    setDialogError(null);
  };

  const submitCompletion = async () => {
    if (!completeItem) return;
    if (!channel || !outcome) {
      setDialogError(!channel ? 'Выберите способ связи.' : 'Выберите результат связи.');
      return;
    }
    setDialogError(null);
    try {
      await completeJob({ item: completeItem, channel, outcome, note });
      resetDialog();
      setSuccess('Задача завершена.');
    } catch (cause) {
      setDialogError(cause instanceof Error ? cause.message : 'Не удалось сохранить действие. Обновите очередь и проверьте результат.');
    }
  };

  const submitDefer = async () => {
    if (!deferItem) return;
    if (!deferReason.trim()) {
      setDialogError('Укажите причину.');
      return;
    }
    try {
      const newDueAt = tenantDateTimeToInstant(deferLocalTime, timezone);
      const newDueMillis = Date.parse(newDueAt);
      if (
        !deferLocalTime
        || newDueMillis <= Date.now()
        || newDueMillis >= Date.parse(deferItem.appointment.start)
        || newDueMillis === Date.parse(deferItem.job.dueAt)
      ) {
        setDialogError('Новое время должно быть позже текущего момента и раньше записи.');
        return;
      }
      setDialogError(null);
      await deferJob({ item: deferItem, newDueAt, reason: deferReason });
      resetDialog();
      setSuccess('Задача отложена.');
    } catch (cause) {
      setDialogError(cause instanceof Error ? cause.message : 'Новое время должно быть позже текущего момента и раньше записи.');
    }
  };

  const submitSkip = async () => {
    if (!skipItem) return;
    if (!skipReason.trim()) {
      setDialogError('Укажите причину.');
      return;
    }
    setDialogError(null);
    try {
      await skipJob({ item: skipItem, reason: skipReason });
      resetDialog();
      setSuccess('Задача пропущена.');
    } catch (cause) {
      setDialogError(cause instanceof Error ? cause.message : 'Не удалось сохранить действие. Обновите очередь и проверьте результат.');
    }
  };

  if (!canAccess) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-600" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Очередь напоминаний недоступна</h1>
          <p className="mt-2 text-sm text-slate-600">Недостаточно прав для работы с очередью напоминаний.</p>
        </div>
      </div>
    );
  }

  const renderCard = (item: AppointmentReminderQueueItem) => {
    const itemBucket = bucketForItem(item, timezone, nowMillis);
    const busy = [completingJobId, deferringJobId, skippingJobId].includes(item.job.id);
    return (
      <article key={item.job.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid={`reminder-job-${item.job.id}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                itemBucket === 'overdue' ? 'bg-red-100 text-red-700'
                  : itemBucket === 'today' ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-700'
              }`}>
                {itemBucket === 'overdue' ? `Просрочено на ${overdueLabel(item.job.dueAt, nowMillis)}` : itemBucket === 'today' ? 'Сегодня' : 'Предстоит'}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {TYPE_LABELS[item.job.reminderType]}
              </span>
              {item.job.deferredAt && (
                <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">Отложена вручную</span>
              )}
            </div>
            <h3 className="mt-3 truncate text-lg font-semibold text-slate-900">{item.patient.fullName}</h3>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
              <span className="flex items-center gap-1.5"><PhoneCall className="h-4 w-4" />{item.patient.phone || 'Телефон не указан'}</span>
              <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4" />{formatInstantInTenant(item.appointment.start, timezone)}</span>
              <span className="flex items-center gap-1.5"><UserRound className="h-4 w-4" />{item.doctor.fullName}</span>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
              <div><span className="text-slate-400">Выполнить:</span> {formatInstantInTenant(item.job.dueAt, timezone)}</div>
              <div><span className="text-slate-400">Подтверждение:</span> {CONFIRMATION_LABELS[item.appointment.confirmationState ?? 'unconfirmed']}</div>
              <div><span className="text-slate-400">Попыток:</span> {item.attemptCount}</div>
              <div><span className="text-slate-400">Состояние:</span> {item.job.operationalState === 'ready' ? 'Готова к работе' : 'Запланирована'}</div>
            </div>
            {item.lastAttempt && (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Последняя попытка: {OUTCOME_LABELS[item.lastAttempt.outcome]} · {formatInstantInTenant(item.lastAttempt.attemptedAt, timezone)}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-sm lg:justify-end">
            <button
              type="button"
              data-testid={`complete-${item.job.id}`}
              disabled={busy || item.job.operationalState !== 'ready'}
              onClick={() => { clearError(); setSuccess(null); setDialogError(null); setCompleteItem(item); }}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Зафиксировать результат
            </button>
            <button
              type="button"
              data-testid={`defer-${item.job.id}`}
              disabled={busy}
              onClick={() => { clearError(); setSuccess(null); setDialogError(null); setDeferItem(item); setDeferLocalTime(''); }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Отложить
            </button>
            <button
              type="button"
              data-testid={`skip-${item.job.id}`}
              disabled={busy}
              onClick={() => { clearError(); setSuccess(null); setDialogError(null); setSkipItem(item); }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Пропустить
            </button>
            <Link to="/" className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
              Открыть запись <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-700"><BellRing className="h-6 w-6" /><span className="text-sm font-semibold uppercase tracking-wide">Ручные операции</span></div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Напоминания</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Очередь показывает работу для сотрудников. Фиксация канала не отправляет SMS, WhatsApp или email автоматически.
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Обновить
          </button>
        </header>

        {(error || success || reconcilingOperation) && (
          <div className="mt-5 space-y-2">
            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
            {reconcilingOperation && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">Проверяем, была ли задача завершена…</div>}
          </div>
        )}

        <div className="mt-6 flex gap-2 border-b border-slate-200">
          <button type="button" data-testid="reminder-tab-active" onClick={() => setTab('active')} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${tab === 'active' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
            <Clock3 className="h-4 w-4" /> Активные ({jobs.length})
          </button>
          <button type="button" data-testid="reminder-tab-history" onClick={() => setTab('history')} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${tab === 'history' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
            <History className="h-4 w-4" /> История ({history.length})
          </button>
        </div>

        {tab === 'active' ? (
          <>
            <section className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5" aria-label="Фильтры очереди">
              <label className="relative md:col-span-2 xl:col-span-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Пациент или телефон" className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
              </label>
              <select value={bucket} onChange={(event) => setBucket(event.target.value as QueueBucket)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
                <option value="all">Все активные</option><option value="overdue">Просроченные</option><option value="today">Сегодня</option><option value="upcoming">Предстоящие</option>
              </select>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | AppointmentReminderType)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
                <option value="all">Все типы</option>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
                <option value="all">Все врачи</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}
              </select>
              <select value={confirmationFilter} onChange={(event) => setConfirmationFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
                <option value="all">Все подтверждения</option>{Object.entries(CONFIRMATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </section>

            {loading ? (
              <div className="mt-10 text-center text-sm text-slate-500">Загружаем очередь…</div>
            ) : filteredJobs.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">Активных задач по выбранным фильтрам нет.</div>
            ) : (
              <div className="mt-6 space-y-8">
                {([
                  ['overdue', 'Просрочено', groups.overdue, 'text-red-700'],
                  ['today', 'Сегодня', groups.today, 'text-amber-700'],
                  ['upcoming', 'Предстоящее', groups.upcoming, 'text-blue-700'],
                ] as const).map(([key, label, items, color]) => items.length > 0 && (
                  <section key={key} aria-label={label}>
                    <h2 className={`mb-3 flex items-center gap-2 text-lg font-semibold ${color}`}><Clock3 className="h-5 w-5" />{label} <span className="text-sm font-normal text-slate-400">{items.length}</span></h2>
                    <div className="space-y-3">{items.map(renderCard)}</div>
                  </section>
                ))}
              </div>
            )}
          </>
        ) : (
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="История напоминаний">
            {history.length === 0 ? (
              <div className="p-12 text-center text-slate-500">История пока пуста.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {history.map((item) => (
                  <article key={item.job.id} className="grid gap-3 p-5 md:grid-cols-[1.4fr_1fr_1fr]">
                    <div>
                      <div className="font-semibold text-slate-900">{item.patient.fullName}</div>
                      <div className="mt-1 text-sm text-slate-500">{TYPE_LABELS[item.job.reminderType]} · исходно {formatInstantInTenant(item.job.originalDueAt, timezone)}</div>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium text-slate-800">{terminalLabel(item)}</div>
                      <div className="mt-1 text-slate-500">{formatInstantInTenant(terminalMoment(item), timezone)}</div>
                    </div>
                    <div className="text-sm text-slate-600">
                      {item.job.completionOutcome && <div>Результат: {OUTCOME_LABELS[item.job.completionOutcome]}</div>}
                      {(item.job.completionNote || item.job.deferReason || item.job.terminalReason) && <div className="mt-1">Причина/заметка: {item.job.completionNote ?? item.job.deferReason ?? item.job.terminalReason}</div>}
                      {(item.job.completedBy || item.job.skippedBy || item.job.deferredBy) && <div className="mt-1 text-xs text-slate-400">Сотрудник: {item.job.completedBy ?? item.job.skippedBy ?? item.job.deferredBy}</div>}
                      {item.job.confirmationAttemptId && <div className="mt-1 text-xs text-slate-400">Попытка связи: {item.job.confirmationAttemptId}</div>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {completeItem && (
        <ModalShell title="Зафиксировать результат" onClose={resetDialog}>
          <div className="space-y-4 p-6">
            <ItemContext item={completeItem} timezone={timezone} />
            <label className="block text-sm font-medium text-slate-700">Канал ручного контакта
              <select data-testid="complete-channel" value={channel} onChange={(event) => setChannel(event.target.value as AppointmentContactChannel)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
                {Object.entries(CHANNEL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">Результат
              <select data-testid="complete-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value as AppointmentContactOutcome)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
                <option value="">Выберите результат</option>{Object.entries(OUTCOME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">Заметка
              <textarea data-testid="complete-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Необязательно" />
            </label>
            {outcome === 'message_sent' && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">«Сообщение отправлено» фиксируется сотрудником и не подтверждает запись.</div>}
            {outcome === 'declined' && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Отказ не отменяет запись автоматически. Отмена выполняется отдельным действием.</div>}
            {outcome === 'callback_requested' && <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Запрос обратного звонка требует отдельной задачи с явным временем. Система не придумывает его автоматически.</div>}
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Выбор SMS, WhatsApp или email здесь только записывает ручной способ контакта. Автоматической отправки нет.</div>
            {dialogError && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{dialogError}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetDialog} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Отмена</button>
              <button type="button" data-testid="complete-submit" onClick={() => void submitCompletion()} disabled={completingJobId === completeItem.job.id || reconcilingOperation} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {reconcilingOperation ? 'Проверяем, была ли задача завершена…' : completingJobId === completeItem.job.id ? 'Сохраняем результат…' : 'Сохранить результат'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {deferItem && (
        <ModalShell title="Отложить задачу" onClose={resetDialog}>
          <div className="space-y-4 p-6">
            <ItemContext item={deferItem} timezone={timezone} />
            <label className="block text-sm font-medium text-slate-700">Новое время клиники ({timezone})
              <input data-testid="defer-time" type="datetime-local" value={deferLocalTime} onChange={(event) => setDeferLocalTime(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Причина
              <textarea data-testid="defer-reason" value={deferReason} onChange={(event) => setDeferReason(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            </label>
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Укажите точное время. Значение «через час» автоматически не подставляется.</div>
            {dialogError && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{dialogError}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetDialog} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Отмена</button>
              <button type="button" data-testid="defer-submit" onClick={() => void submitDefer()} disabled={deferringJobId === deferItem.job.id || reconcilingOperation} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {deferringJobId === deferItem.job.id ? 'Переносим задачу…' : 'Отложить'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {skipItem && (
        <ModalShell title="Пропустить задачу" onClose={resetDialog}>
          <div className="space-y-4 p-6">
            <ItemContext item={skipItem} timezone={timezone} />
            <label className="block text-sm font-medium text-slate-700">Причина
              <textarea data-testid="skip-reason" value={skipReason} onChange={(event) => setSkipReason(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            </label>
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Задача останется в истории и не будет выполнена автоматически.</div>
            {dialogError && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{dialogError}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetDialog} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Отмена</button>
              <button type="button" data-testid="skip-submit" onClick={() => void submitSkip()} disabled={skippingJobId === skipItem.job.id || reconcilingOperation} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                <SkipForward className="h-4 w-4" />{skippingJobId === skipItem.job.id ? 'Пропускаем задачу…' : 'Пропустить'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

export default ReminderOperationsPage;
