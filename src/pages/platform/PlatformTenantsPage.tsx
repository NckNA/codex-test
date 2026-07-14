import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { CreateTenantDialog } from '../../components/platform/CreateTenantDialog';
import { usePlatformTenants } from '../../data/hooks/usePlatformTenants';

const format = (value?: string) => value ? new Date(value).toLocaleString('ru-RU') : '—';

export function PlatformTenantsPage() {
  const model = usePlatformTenants();
  const [createOpen, setCreateOpen] = useState(false);

  if (model.loading && !model.adminStatus) return <div className="rounded-2xl border bg-white p-8">Загрузка платформенных данных…</div>;
  if (model.adminStatus && !model.adminStatus.isPlatformSuperadmin) return <div className="rounded-2xl border border-red-200 bg-white p-8 text-red-700">Недостаточно прав для управления платформой.</div>;

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold text-slate-900">Клиники DentalFlow</h1><p className="mt-1 text-sm text-slate-500">Только lifecycle, владельцы и подписка. Клинические и финансовые данные не загружаются.</p></div><div className="flex gap-2"><button type="button" onClick={() => void model.refresh()} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2"><RefreshCw className="h-4 w-4" />Обновить</button><button type="button" data-testid="open-create-tenant" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white"><Plus className="h-4 w-4" />Создать клинику</button></div></div>
      <div className="mt-6 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_220px]"><input aria-label="Поиск клиник" value={model.filters.search ?? ''} onChange={(e) => model.setSearch(e.target.value)} placeholder="Название клиники" className="rounded-lg border p-2" /><select aria-label="Фильтр статуса" value={model.filters.status ?? ''} onChange={(e) => model.setStatus(e.target.value as never)} className="rounded-lg border p-2"><option value="">Все статусы</option><option value="provisioning">provisioning</option><option value="active">active</option><option value="suspended">suspended</option><option value="expired">expired</option><option value="archived">archived</option></select></div>
      {model.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{model.error.message}</p>}
      <div className="mt-5 overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Клиника</th><th className="p-3">Статус</th><th className="p-3">Владельцы</th><th className="p-3">Подписка</th><th className="p-3">Grace</th><th className="p-3">Приостановка</th><th className="p-3">Обновлено</th></tr></thead><tbody>{model.tenants.map((tenant) => <tr key={tenant.tenantId} className="border-t"><td className="p-3"><Link to={`/platform/tenants/${tenant.tenantId}`} className="font-medium text-blue-700 hover:underline">{tenant.tenantName}</Link><div className="text-xs text-slate-400">{tenant.tenantId}</div></td><td className="p-3"><div>{tenant.effectiveStatus}</div><div className="text-xs text-slate-400">stored: {tenant.storedStatus}</div></td><td className="p-3">{tenant.ownerCount}</td><td className="p-3">{format(tenant.subscriptionStartedAt)}<br />{format(tenant.subscriptionExpiresAt)}</td><td className="p-3">{format(tenant.graceExpiresAt)}</td><td className="p-3">{format(tenant.suspendedUntil)}</td><td className="p-3">{format(tenant.updatedAt)}</td></tr>)}</tbody></table>{!model.loading && model.tenants.length === 0 && <p className="p-8 text-center text-slate-500">Клиники не найдены.</p>}</div>
      <CreateTenantDialog open={createOpen} pending={model.actionPending} onCancel={() => setCreateOpen(false)} onCreate={model.createTenant} />
    </section>
  );
}
