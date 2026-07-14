import { LogOut, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { lifecycleBlockedMessage } from '../domain/platform/TenantLifecycle';

export function TenantAccessBlockedPage() {
  const { signOut } = useAuth();
  const { activeTenant, availableTenants, setActiveTenant } = useTenant();
  if (!activeTenant) return null;
  const alternatives = availableTenants.filter((tenant) => tenant.tenantId !== activeTenant.tenantId && tenant.operationalAccessAllowed);
  return (
    <main className="min-h-screen bg-slate-100 p-6 flex items-center justify-center">
      <section className="w-full max-w-xl rounded-2xl border bg-white p-8 shadow-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100"><Building2 className="h-7 w-7 text-amber-700" /></div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-900">{activeTenant.tenantName}</h1>
        <p className="mt-3 text-slate-700">{lifecycleBlockedMessage(activeTenant.effectiveStatus ?? 'provisioning')}</p>
        {activeTenant.subscriptionExpiresAt && <p className="mt-2 text-sm text-slate-500">Подписка до: {new Date(activeTenant.subscriptionExpiresAt).toLocaleString('ru-RU')}</p>}
        <p className="mt-4 text-sm text-slate-500">Обратитесь к владельцу клиники или в поддержку DentalFlow. Медицинские и финансовые данные на этой странице не отображаются.</p>
        {alternatives.length > 0 && <label className="mt-6 block text-left text-sm font-medium text-slate-700">Перейти в другую доступную клинику<select aria-label="Переключить клинику" className="mt-2 w-full rounded-lg border p-2" defaultValue="" onChange={(e) => { if (e.target.value) setActiveTenant(e.target.value); }}><option value="" disabled>Выберите клинику</option>{alternatives.map((tenant) => <option key={tenant.tenantId} value={tenant.tenantId}>{tenant.tenantName}</option>)}</select></label>}
        <button type="button" onClick={() => void signOut()} className="mt-6 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-slate-700"><LogOut className="h-4 w-4" />Выйти</button>
      </section>
    </main>
  );
}
