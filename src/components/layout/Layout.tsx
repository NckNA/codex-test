import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ScheduleProvider } from '../../context/ScheduleContext';

export function Layout() {
  return (
    <ScheduleProvider>
      <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <Header />
          <main className="flex-1 overflow-auto relative">
            <Outlet />
          </main>
        </div>
      </div>
    </ScheduleProvider>
  );
}
