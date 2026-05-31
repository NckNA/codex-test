import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CheckSquare, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useScheduleContext } from '../hooks/useScheduleContext';
import { storage } from '../utils/storage';
import { AppointmentModal } from '../components/schedule/AppointmentModal';
import type { Appointment, Doctor, AppointmentStatus } from '../types';

const timeSlots = Array.from({ length: 23 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9;
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minute}`;
});

const getStatusColor = (status: AppointmentStatus) => {
  switch (status) {
    case 'new': return 'bg-blue-100 border-blue-300 text-blue-800';
    case 'confirmed': return 'bg-indigo-100 border-indigo-300 text-indigo-800';
    case 'arrived': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    case 'in_progress': return 'bg-purple-100 border-purple-300 text-purple-800';
    case 'completed': return 'bg-emerald-100 border-emerald-300 text-emerald-800';
    case 'no_show': return 'bg-orange-100 border-orange-300 text-orange-800';
    case 'cancelled': return 'bg-slate-100 border-slate-300 text-slate-500 opacity-60';
    case 'blocked': return 'bg-slate-200 border-slate-400 text-slate-700 bg-[url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAiPjwvcmVjdD4KPHBhdGggZD0iTTAgMEw4IDhaTTEwIC0yTDEyIDBaTS0yIDEwTDAgMTJaIiBzdHJva2U9IiNjYmQ1ZTEiIHN0cm9rZS13aWR0aD0iMSI+PC9wYXRoPgo8L3N2Zz4=")]';
    default: return 'bg-slate-100 border-slate-300 text-slate-800';
  }
};

const getStatusLabel = (status: AppointmentStatus) => {
  switch (status) {
    case 'new': return 'Новая';
    case 'confirmed': return 'Подтвержден';
    case 'arrived': return 'Пришел';
    case 'in_progress': return 'В работе';
    case 'completed': return 'Завершен';
    case 'no_show': return 'Не пришел';
    case 'cancelled': return 'Отменен';
    case 'blocked': return 'Блок';
    default: return status;
  }
};

const getSourceLabel = (source?: string) => {
  switch (source) {
    case 'phone': return 'Телефон';
    case 'whatsapp': return 'WhatsApp';
    case 'instagram': return 'Instagram';
    case 'walk_in': return 'С улицы';
    case 'repeat': return 'Повторный';
    case 'referral': return 'По рекомендации';
    default: return source || '';
  }
};

export function SchedulePage() {
  const { selectedDate, setSelectedDate, viewMode, doctorFilter, statusFilter, sourceFilter } = useScheduleContext();
  const [appointments, setAppointments] = useState<Appointment[]>(storage.getAppointments());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Partial<Appointment> | undefined>();

  const doctors = useMemo(() => {
    let allDoctors = storage.getDoctors();
    if (doctorFilter) {
      allDoctors = allDoctors.filter(d => d.id === doctorFilter);
    }
    return allDoctors;
  }, [doctorFilter]);

  const patients = useMemo(() => storage.getPatients(), []);

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const selectedDateStr = selectedDate.toISOString().split('T')[0];

  const dailyAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (!a.start.startsWith(selectedDateStr)) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (sourceFilter && a.source !== sourceFilter) return false;
      return true;
    });
  }, [appointments, selectedDateStr, statusFilter, sourceFilter]);

  const handleOpenModal = (doctor?: Doctor, timeSlot?: string) => {
    let initialData: Partial<Appointment> = {};
    if (doctor && timeSlot) {
      initialData = {
        doctorId: doctor.id,
        cabinet: doctor.cabinet,
        start: `${selectedDateStr}T${timeSlot}:00`,
        end: `${selectedDateStr}T${String(parseInt(timeSlot.split(':')[0]) + 1).padStart(2, '0')}:${timeSlot.split(':')[1]}:00`,
      };
    }
    setEditingAppointment(initialData);
    setIsModalOpen(true);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsModalOpen(true);
  };

  const handleSaveAppointment = (saved: Appointment) => {
    if (editingAppointment?.id) {
      storage.updateAppointment(saved);
    } else {
      storage.addAppointment(saved);
    }
    setAppointments(storage.getAppointments());
    setIsModalOpen(false);
  };

  const handleDeleteAppointment = (id: string) => {
    storage.deleteAppointment(id);
    setAppointments(storage.getAppointments());
    setIsModalOpen(false);
  };

  if (viewMode !== 'day') {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center text-slate-500">
          <h2 className="text-xl font-medium mb-2">Вид будет реализован позже</h2>
          <p>Сейчас доступен только дневной режим.</p>
        </div>
      </div>
    );
  }

  // Helpers for grid positioning
  const startHour = 9;
  const slotHeight = 48; // px per 30 mins
  const hourHeight = slotHeight * 2; // 96px per hour

  const getCardStyle = (startStr: string, endStr: string) => {
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const startMins = (startDate.getHours() - startHour) * 60 + startDate.getMinutes();
    const durationMins = (endDate.getTime() - startDate.getTime()) / 60000;

    const top = (startMins / 60) * hourHeight;
    const height = (durationMins / 60) * hourHeight;

    return { top: `${top}px`, height: `${height - 4}px` };
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden relative">
      {/* Левая панель */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-800 capitalize">
              {selectedDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-1">
              <button onClick={() => changeDate(-1)} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => changeDate(1)} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex justify-center mb-2">
            <input
              type="date"
              value={selectedDateStr}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="text-sm p-1 border border-slate-200 rounded text-slate-700"
            />
          </div>
        </div>

        <div className="flex-1 p-4 flex flex-col overflow-hidden">
          <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-500" />
            Задачи на сегодня
          </h3>
          <div className="space-y-2 overflow-y-auto pr-2">
            {[
              'Позвонить Петрову (перенос)',
              'Заказать материалы',
              'Подтвердить записи на завтра',
            ].map((task, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span>{task}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Основная область: Сетка */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10 shadow-sm">
          <div className="w-20 shrink-0 border-r border-slate-200 bg-slate-50"></div>
          {doctors.map((doctor) => (
            <div key={doctor.id} className="flex-1 p-3 text-center border-r border-slate-200 min-w-[200px] relative group">
               <div className="font-medium text-slate-800">{doctor.fullName}</div>
               <div className="text-xs text-slate-500">{doctor.specialization}</div>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto relative">
          <div className="flex min-w-max">
            {/* Шкала времени */}
            <div className="w-20 shrink-0 flex flex-col border-r border-slate-200 bg-white sticky left-0 z-10">
              {timeSlots.map((time, i) => (
                <div key={time} className={clsx(
                  "border-b border-slate-100 p-1 text-xs font-medium text-slate-400 text-right pr-4",
                  i % 2 === 0 ? "h-12 border-slate-200" : "h-12 border-dashed"
                )}>
                  {i % 2 === 0 ? time : ''}
                </div>
              ))}
            </div>

            {/* Колонки врачей */}
            {doctors.map((doctor) => (
              <div key={doctor.id} className="flex-1 min-w-[200px] border-r border-slate-200 relative bg-slate-50/30">
                {/* Сетка кликов */}
                {timeSlots.map((time, i) => (
                  <div
                    key={time}
                    onClick={() => handleOpenModal(doctor, time)}
                    className={clsx(
                      "group border-b border-slate-100 cursor-pointer hover:bg-blue-50/50 transition-colors flex items-center justify-center",
                      i % 2 === 0 ? "h-12 border-slate-200" : "h-12 border-dashed"
                    )}
                  >
                     <Plus className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100" />
                  </div>
                ))}

                {/* Карточки записей */}
                {dailyAppointments
                  .filter((apt) => apt.doctorId === doctor.id)
                  .map((apt) => {
                    const patient = apt.patientId ? patients.find(p => p.id === apt.patientId) : null;
                    const style = getCardStyle(apt.start, apt.end);

                    return (
                      <div
                        key={apt.id}
                        onClick={() => handleEditAppointment(apt)}
                        className={clsx(
                          "absolute left-1 right-1 rounded-lg border p-1.5 text-xs shadow-sm transition-transform hover:-translate-y-0.5 cursor-pointer overflow-hidden flex flex-col",
                          getStatusColor(apt.status)
                        )}
                        style={style}
                      >
                        <div className="font-medium truncate mb-0.5 flex justify-between">
                          <span>{apt.start.split('T')[1].slice(0,5)} {patient?.fullName || apt.service}</span>
                          <span className="opacity-75 text-[10px]">{getStatusLabel(apt.status)}</span>
                        </div>
                        {apt.status !== 'blocked' && (
                          <>
                            <div className="truncate opacity-90">{apt.service}</div>
                            <div className="mt-auto flex justify-between items-end">
                              {apt.price ? <span className="font-medium">{apt.price} ₸</span> : <span />}
                              {apt.source ? <span className="opacity-75 text-[10px]">{getSourceLabel(apt.source)}</span> : null}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAppointment}
        onDelete={handleDeleteAppointment}
        initialData={editingAppointment}
      />
    </div>
  );
}
