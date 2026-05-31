import { ChevronLeft, ChevronRight, CheckSquare } from 'lucide-react';
import { clsx } from 'clsx';

// Моковые данные для расписания
const doctors = [
  { id: '1', name: 'Смирнов А.В.', specialty: 'Терапевт' },
  { id: '2', name: 'Иванова Е.С.', specialty: 'Хирург-имплантолог' },
  { id: '3', name: 'Петров Д.Н.', specialty: 'Ортодонт' },
  { id: '4', name: 'Сидорова О.П.', specialty: 'Гигиенист' },
];

const timeSlots = Array.from({ length: 12 }, (_, i) => `${i + 9}:00`);

const demoAppointments = [
  {
    id: '1',
    doctorId: '1',
    patient: 'Анна К.',
    service: 'Первичный осмотр',
    time: '09:00',
    duration: 1, // в часах
    status: 'scheduled',
    color: 'bg-blue-100 border-blue-300 text-blue-800',
  },
  {
    id: '2',
    doctorId: '2',
    patient: 'Михаил В.',
    service: 'Консультация по имплантации',
    time: '10:00',
    duration: 2,
    status: 'in-progress',
    color: 'bg-indigo-100 border-indigo-300 text-indigo-800',
  },
  {
    id: '3',
    doctorId: '3',
    patient: 'Елена П.',
    service: 'Снятие брекетов',
    time: '14:00',
    duration: 1.5,
    status: 'completed',
    color: 'bg-emerald-100 border-emerald-300 text-emerald-800',
  },
  {
    id: '4',
    doctorId: '4',
    patient: 'Дмитрий С.',
    service: 'Проф. гигиена',
    time: '11:00',
    duration: 1,
    status: 'scheduled',
    color: 'bg-purple-100 border-purple-300 text-purple-800',
  },
];

export function SchedulePage() {
  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* Левая панель: Мини-календарь и Задачи */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        {/* Мини-календарь (заглушка) */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-800">Октябрь 2023</h3>
            <div className="flex gap-1">
              <button className="p-1 hover:bg-slate-100 rounded text-slate-500">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="p-1 hover:bg-slate-100 rounded text-slate-500">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-slate-400 font-medium">
            <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div className="text-red-400">Сб</div><div className="text-red-400">Вс</div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {Array.from({ length: 31 }, (_, i) => (
              <div
                key={i}
                className={clsx(
                  "p-1.5 rounded-full cursor-pointer hover:bg-slate-100 text-slate-700",
                  i === 14 && "bg-blue-600 text-white hover:bg-blue-700", // Текущий день
                  (i + 1) % 7 === 6 || (i + 1) % 7 === 0 ? "text-red-500" : "" // Выходные
                )}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Задачи */}
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

      {/* Основная область: Сетка расписания */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Заголовки колонок (Врачи) */}
        <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10 shadow-sm">
          <div className="w-20 shrink-0 border-r border-slate-200 bg-slate-50"></div>
          {doctors.map((doctor) => (
            <div key={doctor.id} className="flex-1 p-3 text-center border-r border-slate-200 min-w-[200px]">
              <div className="font-medium text-slate-800">{doctor.name}</div>
              <div className="text-xs text-slate-500">{doctor.specialty}</div>
            </div>
          ))}
        </div>

        {/* Сетка времени */}
        <div className="flex-1 overflow-auto relative">
          <div className="flex min-w-max">
            {/* Шкала времени */}
            <div className="w-20 shrink-0 flex flex-col border-r border-slate-200 bg-white sticky left-0 z-10">
              {timeSlots.map((time) => (
                <div key={time} className="h-24 border-b border-slate-100 p-2 text-xs font-medium text-slate-400 text-right pr-4">
                  {time}
                </div>
              ))}
            </div>

            {/* Колонки врачей */}
            {doctors.map((doctor) => (
              <div key={doctor.id} className="flex-1 min-w-[200px] border-r border-slate-200 relative bg-slate-50/30">
                {/* Горизонтальные линии сетки */}
                {timeSlots.map((_, i) => (
                  <div key={i} className="h-24 border-b border-slate-100 border-dashed"></div>
                ))}

                {/* Демо-карточки записей */}
                {demoAppointments
                  .filter((apt) => apt.doctorId === doctor.id)
                  .map((apt) => {
                    const startHour = parseInt(apt.time.split(':')[0], 10);
                    const top = (startHour - 9) * 96; // 96px = h-24
                    const height = apt.duration * 96;

                    return (
                      <div
                        key={apt.id}
                        className={clsx(
                          "absolute left-2 right-2 rounded-lg border p-2 text-sm shadow-sm transition-transform hover:-translate-y-0.5 cursor-pointer",
                          apt.color
                        )}
                        style={{ top: `${top}px`, height: `${height - 4}px` }} // -4px for visual gap
                      >
                        <div className="font-medium truncate">{apt.time} - {apt.patient}</div>
                        <div className="text-xs mt-1 opacity-90 truncate">{apt.service}</div>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
