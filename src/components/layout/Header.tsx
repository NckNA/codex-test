import { Search, Calendar, ChevronDown, Plus, UserCircle, LogOut } from 'lucide-react';
import { useScheduleContext } from '../../hooks/useScheduleContext';
import { clsx } from 'clsx';
import { useClinicDoctors } from '../../data/hooks/useClinicDoctors';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { getClinicRoleLabel } from '../../domain/roleLabels';

export function Header() {
  const {
    selectedDate, viewMode, setViewMode,
    doctorFilter, setDoctorFilter,
    statusFilter, setStatusFilter,
    sourceFilter, setSourceFilter
  } = useScheduleContext();

  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const sourceDropdownRef = useRef<HTMLDivElement>(null);

  const { doctors } = useClinicDoctors();
  const { user, authMode, signOut } = useAuth();
  const { activeTenant } = useTenant();
  const roleLabel = getClinicRoleLabel(activeTenant?.role);

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
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(event.target as Node)) {
        setIsSourceDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const statuses = [
    { value: 'new', label: 'Новая' },
    { value: 'confirmed', label: 'Подтвержден' },
    { value: 'arrived', label: 'Пришел' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'completed', label: 'Завершен' },
    { value: 'no_show', label: 'Не пришел' },
    { value: 'cancelled', label: 'Отменен' },
  ];

  const sources = [
    { value: 'phone', label: 'Телефон' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'walk_in', label: 'С улицы' },
    { value: 'repeat', label: 'Повторный' },
    { value: 'referral', label: 'По рекомендации' },
  ];

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

        {/* Source Filter */}
        <div className="relative" ref={sourceDropdownRef}>
          <button
            onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
            className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 px-2 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors focus:outline-none"
          >
            <span className="truncate max-w-[100px]">{sourceFilter ? sources.find(s => s.value === sourceFilter)?.label : 'Все источники'}</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {isSourceDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50">
              <button
                onClick={() => { setSourceFilter(null); setIsSourceDropdownOpen(false); }}
                className={clsx("w-full text-left px-4 py-2 text-sm hover:bg-slate-50", sourceFilter === null && "bg-blue-50 text-blue-700")}
              >
                Все источники
              </button>
              {sources.map(src => (
                <button
                  key={src.value}
                  onClick={() => { setSourceFilter(src.value); setIsSourceDropdownOpen(false); }}
                  className={clsx("w-full text-left px-4 py-2 text-sm hover:bg-slate-50", sourceFilter === src.value && "bg-blue-50 text-blue-700")}
                >
                  {src.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status Filter */}
        <div className="relative" ref={statusDropdownRef}>
          <button
            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
            className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 px-2 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors focus:outline-none"
          >
            <span className="truncate max-w-[100px]">{statusFilter ? statuses.find(s => s.value === statusFilter)?.label : 'Все статусы'}</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {isStatusDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50">
              <button
                onClick={() => { setStatusFilter(null); setIsStatusDropdownOpen(false); }}
                className={clsx("w-full text-left px-4 py-2 text-sm hover:bg-slate-50", statusFilter === null && "bg-blue-50 text-blue-700")}
              >
                Все статусы
              </button>
              {statuses.map(st => (
                <button
                  key={st.value}
                  onClick={() => { setStatusFilter(st.value); setIsStatusDropdownOpen(false); }}
                  className={clsx("w-full text-left px-4 py-2 text-sm hover:bg-slate-50", statusFilter === st.value && "bg-blue-50 text-blue-700")}
                >
                  {st.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Doctor Filter */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDoctorDropdownOpen(!isDoctorDropdownOpen)}
            className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 px-2 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors focus:outline-none"
          >
            <span className="truncate max-w-[100px]">{selectedDoctor ? selectedDoctor.fullName : 'Все врачи'}</span>
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
        <button 
          disabled
          title="Глобальное добавление пока недоступно в прототипе. Используйте расписание."
          className="flex items-center gap-1.5 bg-slate-300 text-slate-500 cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Записать пациента
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-4 pl-4 border-l border-slate-200 ml-2">
          <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-slate-900">
                {authMode === 'supabase-active' && user?.email ? user.email : 'Иван И.'}
              </div>
              <div className="text-xs text-slate-500" data-testid="current-role-label">{roleLabel}</div>
            </div>
            <UserCircle className="w-8 h-8 text-slate-400" />
          </button>
          
          {authMode === 'supabase-active' && user && (
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors"
              title="Выйти"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
