import { Search, Calendar, ChevronDown, Plus, UserCircle } from 'lucide-react';

export function Header() {
  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-10 relative">
      <div className="flex items-center gap-6">
        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск пациента..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Date */}
        <div className="flex items-center gap-2 text-slate-600 text-sm bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="capitalize">{today}</span>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-2"></div>

        {/* View Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button className="px-3 py-1 text-sm font-medium rounded-md bg-white text-slate-900 shadow-sm">
            День
          </button>
          <button className="px-3 py-1 text-sm font-medium rounded-md text-slate-600 hover:text-slate-900">
            Неделя
          </button>
          <button className="px-3 py-1 text-sm font-medium rounded-md text-slate-600 hover:text-slate-900">
            Месяц
          </button>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-2"></div>

        {/* Doctor Filter */}
        <button className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
          <span>Все врачи</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>

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
