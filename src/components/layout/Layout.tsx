import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ScheduleProvider } from '../../context/ScheduleProvider';
import { AlertTriangle } from 'lucide-react';

export function Layout() {
  return (
    <ScheduleProvider>
      <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <Header />
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-start gap-3 shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <span className="font-semibold">Режим прототипа:</span> данные сохраняются только в этом браузере. 
              Очистка localStorage, другой браузер или другое устройство могут скрыть или удалить эти данные. 
              Production backend/database ещё не подключены.
            </div>
          </div>
          <main className="flex-1 overflow-auto relative">
            <Outlet />
          </main>
        </div>
      </div>
    </ScheduleProvider>
  );
}
