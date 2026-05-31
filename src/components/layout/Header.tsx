import { Search, Calendar, ChevronDown, Plus, UserCircle } from 'lucide-react';
import { useScheduleContext } from '../../context/ScheduleContext';
import { clsx } from 'clsx';
import { storage } from '../../utils/storage';
import { useState, useRef, useEffect } from 'react';

export function Header() {
  const { selectedDate, viewMode, setViewMode, doctorFilter, setDoctorFilter } = useScheduleContext();
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const doctors = storage.getDoctors();

  const formattedDate = selectedDate.toLocaleDateString('ru-RU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const selectedDoctor = doctors.find(d => d.id === doctorFilter);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDoctorDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-10 relative">
      <div className="flex items-center gap-6">
        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск пациента (демо)..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Date */}
        <div className="flex items-center gap-2 text-slate-600 text-sm bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="capitalize">{formattedDate}</span>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-2"></div>

        {/* View Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('day')}
            className={clsx(
              "px-3 py-1 text-sm font-medium rounded-md shadow-sm transition-colors",
              viewMode === 'day' ? "bg-white text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            )}
          >
            День
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={clsx(
              "px-3 py-1 text-sm font-medium rounded-md shadow-sm transition-colors",
              viewMode === 'week' ? "bg-white text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            )}
          >
            Неделя
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={clsx(
              "px-3 py-1 text-sm font-medium rounded-md shadow-sm transition-colors",
              viewMode === 'month' ? "bg-white text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            )}
          >
            Месяц
          </button>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-2"></div>

        {/* Doctor Filter */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDoctorDropdownOpen(!isDoctorDropdownOpen)}
            className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors focus:outline-none"
          >
            <span className="truncate max-w-[120px]">{selectedDoctor ? selectedDoctor.fullName : 'Все врачи'}</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {isDoctorDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50">
              <button
                onClick={() => { setDoctorFilter(null); setIsDoctorDropdownOpen(false); }}
                className={clsx("w-full text-left px-4 py-2 text-sm hover:bg-slate-50", doctorFilter === null && "bg-blue-50 text-blue-700")}
              >
                Все врачи
              </button>
              {doctors.map(doctor => (
                <button
                  key={doctor.id}
                  onClick={() => { setDoctorFilter(doctor.id); setIsDoctorDropdownOpen(false); }}
                  className={clsx("w-full text-left px-4 py-2 text-sm hover:bg-slate-50", doctorFilter === doctor.id && "bg-blue-50 text-blue-700")}
                >
                  {doctor.fullName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add Button */}
        <button className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-blue-600/20">
          <Plus className="w-4 h-4" />
          Записать пациента
        </button>

        {/* User Profile */}
        <button className="flex items-center gap-2 pl-4 border-l border-slate-200 ml-2 hover:opacity-80 transition-opacity">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-slate-900">Иван И.</div>
            <div className="text-xs text-slate-500">Администратор</div>
          </div>
          <UserCircle className="w-8 h-8 text-slate-400" />
        </button>
      </div>
    </header>
  );
}
