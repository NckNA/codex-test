import { Stethoscope, ClipboardList } from 'lucide-react';


import { useClinicDoctors } from '../../../data/hooks/useClinicDoctors';
import { usePatientAppointments } from '../../../data/hooks/usePatientAppointments';
import { cancellationSourceLabel } from '../../schedule/appointmentLifecycle';

interface PatientHistoryTabProps {
  patientId: string;
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'new': return 'Новая';
    case 'confirmed': return 'Подтвержден';
    case 'arrived': return 'Пришел';
    case 'in_progress': return 'В работе';
    case 'completed': return 'Завершен';
    case 'no_show': return 'Не пришел';
    case 'cancelled': return 'Отменен';
    default: return status;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-700';
    case 'confirmed': return 'bg-indigo-100 text-indigo-700';
    case 'arrived': return 'bg-emerald-100 text-emerald-700';
    case 'in_progress': return 'bg-amber-100 text-amber-700';
    case 'completed': return 'bg-slate-100 text-slate-700';
    case 'no_show': return 'bg-rose-100 text-rose-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    default: return 'bg-slate-100 text-slate-700';
  }
};

export function PatientHistoryTab({ patientId }: PatientHistoryTabProps) {
  const { appointments, isLoading: isAppointmentsLoading, isError: isAppointmentsError } = usePatientAppointments(patientId);
  const { doctors, isLoading: isDoctorsLoading, isError: isDoctorsError } = useClinicDoctors();

  const isLoading = isAppointmentsLoading || isDoctorsLoading;
  const isError = isAppointmentsError || isDoctorsError;

  if (isError) {
    return (
      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-8 text-center text-red-500">
        <p>Не удалось загрузить записи пациента.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-slate-400" /> История приёмов
        </h3>
        <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded-full">
          Всего: {appointments.length}
        </span>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-slate-500">
          <p>Загрузка истории приёмов...</p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="p-8 text-center text-slate-500">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>У пациента еще не было приёмов.</p>
        </div>
      ) : (
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="py-3 px-4 font-semibold text-slate-600">Дата и Время</th>
              <th className="py-3 px-4 font-semibold text-slate-600">Врач</th>
              <th className="py-3 px-4 font-semibold text-slate-600">Услуга</th>
              <th className="py-3 px-4 font-semibold text-slate-600">Кабинет</th>
              <th className="py-3 px-4 font-semibold text-slate-600">Статус</th>
              <th className="py-3 px-4 font-semibold text-slate-600">Цена</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {appointments.map(appt => {
              const doctor = doctors.find(d => d.id === appt.doctorId);
              const apptDate = new Date(appt.start);
              return (
                <tr key={appt.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">{apptDate.toLocaleDateString('ru-RU')}</div>
                    <div className="text-xs text-slate-500">{apptDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{doctor ? doctor.fullName : '-'}</td>
                  <td className="py-3 px-4">
                    <div className="text-slate-800 font-medium">{appt.service || 'Без названия'}</div>
                    {appt.comment && <div className="text-xs text-slate-500 truncate max-w-[200px] mt-0.5">{appt.comment}</div>}
                    {appt.status === 'cancelled' && (
                      <div className="mt-2 max-w-sm rounded bg-red-50 p-2 text-xs text-red-800" data-testid={`history-cancellation-${appt.id}`}>
                        <div>Отменено: {appt.cancelledAt ? new Date(appt.cancelledAt).toLocaleString('ru-RU') : 'историческая запись'}</div>
                        <div>Источник: {cancellationSourceLabel(appt.cancellationSource)}</div>
                        <div>Причина: {appt.cancellationReason || 'Не была сохранена в прежней версии системы'}</div>
                        <div>Сотрудник: {appt.cancelledBy ? 'Сотрудник клиники' : 'Не указан'}</div>
                      </div>
                    )}
                    {appt.status === 'no_show' && (
                      <div className="mt-2 max-w-sm rounded bg-rose-50 p-2 text-xs text-rose-800" data-testid={`history-no-show-${appt.id}`}>
                        <div>Неявка: {appt.noShowAt ? new Date(appt.noShowAt).toLocaleString('ru-RU') : 'историческая запись'}</div>
                        <div>Причина: {appt.noShowReason || 'Не была сохранена в прежней версии системы'}</div>
                        <div>Сотрудник: {appt.noShowBy ? 'Сотрудник клиники' : 'Не указан'}</div>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{appt.cabinet}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appt.status)}`}>
                      {getStatusLabel(appt.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700">{appt.price ? `${appt.price} ₸` : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
