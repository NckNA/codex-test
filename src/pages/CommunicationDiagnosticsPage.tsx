import { AlertCircle, Beaker, ShieldCheck } from 'lucide-react';
import { CommunicationOperationsPanel } from '../components/communications/CommunicationOperationsPanel';
import { useAppointmentReminderQueue } from '../data/hooks/useAppointmentReminderQueue';

export function CommunicationDiagnosticsPage() {
  const { jobs, loading, error, canAccess, refresh } = useAppointmentReminderQueue();

  if (!canAccess) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-600" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Диагностика коммуникаций недоступна</h1>
          <p className="mt-2 text-sm text-slate-600">Недостаточно прав для просмотра коммуникационных операций.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-700">
              <Beaker className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">Provider-neutral foundation</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Диагностика коммуникационных операций</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Здесь подготавливаются и симулируются только тестовые операции. Напоминание не завершается,
              запись не подтверждается, пациенту ничего не отправляется.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <ShieldCheck className="h-5 w-5" />
            Внешние провайдеры отключены
          </div>
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Готовность задач напоминания</h2>
            <p className="mt-1 text-sm text-slate-500">Статус eligibility остаётся источником решения перед подготовкой операции.</p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Обновить задачи
          </button>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-slate-500">Загрузка задач…</div>
        ) : jobs.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Активных задач напоминания нет.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Пациент</th>
                  <th className="px-3 py-2">Тип задачи</th>
                  <th className="px-3 py-2">Готовность</th>
                  <th className="px-3 py-2">Причины блокировки</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.slice(0, 50).map((item) => (
                  <tr key={item.job.id}>
                    <td className="px-3 py-3 font-medium text-slate-900">{item.patient.fullName}</td>
                    <td className="px-3 py-3 text-slate-600">{item.job.reminderType}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.communicationEligibility?.status === 'available'
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.communicationEligibility?.status === 'manual_only'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.communicationEligibility?.status ?? 'blocked'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {item.communicationEligibility?.blockedReasons.join(', ') || 'нет'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CommunicationOperationsPanel reminderItems={jobs} />
    </div>
  );
}
