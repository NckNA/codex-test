import { Building2, LogOut, ShieldCheck } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function PlatformLayout() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b bg-slate-950 text-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"><div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-blue-400" /><div><p className="font-semibold">DentalFlow Platform</p><p className="text-xs text-slate-400">Управление жизненным циклом клиник</p></div></div><div className="flex items-center gap-4 text-sm"><span>{user?.email}</span><button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2"><LogOut className="h-4 w-4" />Выйти</button></div></div></header>
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        <aside className="w-60 shrink-0"><nav className="rounded-2xl border bg-white p-3"><NavLink to="/platform/tenants" className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}><Building2 className="h-4 w-4" />Клиники</NavLink></nav><p className="mt-3 px-2 text-xs text-slate-500">Платформенный доступ не предоставляет медицинские или финансовые данные клиник.</p></aside>
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>
    </div>
  );
}
