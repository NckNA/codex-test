import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { TenantLifecyclePanel } from '../../components/platform/TenantLifecyclePanel';
import { TenantOwnerPanel } from '../../components/platform/TenantOwnerPanel';
import { usePlatformTenants } from '../../data/hooks/usePlatformTenants';

const key = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
const format = (value?: string) => value ? new Date(value).toLocaleString('ru-RU') : '—';

export function PlatformTenantDetailsPage() {
  const { tenantId = '' } = useParams();
  const model = usePlatformTenants({ autoLoad: false });
  const { openTenant } = model;
  useEffect(() => { if (tenantId) void openTenant(tenantId); }, [tenantId, openTenant]);
  const details = model.selectedTenant;

  if (model.detailsLoading || !details) return <div className="rounded-2xl border bg-white p-8">Загрузка жизненного цикла клиники…</div>;
  return (
    <section>
      <Link to="/platform/tenants" className="inline-flex items-center gap-2 text-sm text-blue-700"><ArrowLeft className="h-4 w-4" />К списку клиник</Link>
      <div className="mt-4"><h1 className="text-2xl font-semibold">{details.tenant.tenantName}</h1><p className="text-sm text-slate-500">{details.tenant.tenantId} · {details.tenant.timezone}</p></div>
      {model.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{model.error.message}</p>}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <TenantLifecyclePanel lifecycle={details.tenant} pending={model.actionPending}
          onExtend={(expiresAt, graceExpiresAt) => model.extendSubscription({ tenantId, newExpiresAt: expiresAt, newGraceExpiresAt: graceExpiresAt, reasonCode: 'platform_extension', operationKey: key('extend') })}
          onShorten={(expiresAt, graceExpiresAt, immediateExpiration) => model.shortenSubscription({ tenantId, newExpiresAt: expiresAt, newGraceExpiresAt: graceExpiresAt, reasonCode: 'platform_shortening', confirmation: true, immediateExpiration, operationKey: key('shorten') })}
          onSuspend={(reasonCode, suspensionNote, suspendedUntil) => model.suspendTenant({ tenantId, reasonCode, suspensionNote, suspendedUntil, operationKey: key('suspend') })}
          onResume={() => model.resumeTenant({ tenantId, reasonCode: 'platform_resume', operationKey: key('resume') })}
          onArchive={(reasonCode) => model.archiveTenant({ tenantId, reasonCode, confirmation: true, operationKey: key('archive') })} />
        <TenantOwnerPanel tenantId={tenantId} owners={details.owners} pending={model.actionPending}
          onAdd={(ownerUserId) => model.addOwner({ tenantId, ownerUserId, operationKey: key('owner-add') })}
          onReplace={(currentOwnerUserId, ownerUserId) => model.replaceOwner({ tenantId, currentOwnerUserId, ownerUserId, confirmation: true, operationKey: key('owner-replace') })}
          onRemove={(ownerUserId) => model.removeOwner({ tenantId, ownerUserId, operationKey: key('owner-remove') })} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">История подписки</h2><div className="mt-4 space-y-3">{details.subscriptionHistory.map((period) => <article key={period.id} className="rounded-xl border p-3 text-sm"><div className="font-medium">{period.status} · {period.reasonCode || 'без кода причины'}</div><div className="mt-1 text-slate-600">{format(period.startsAt)} → {format(period.expiresAt)}</div><div className="text-slate-500">Grace: {format(period.graceExpiresAt)}</div></article>)}</div></section>
        <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">История жизненного цикла</h2><div className="mt-4 space-y-3">{details.lifecycleHistory.map((event) => <article key={event.id} className="rounded-xl border p-3 text-sm"><div className="font-medium">{event.action}</div><div className="text-slate-500">{format(event.createdAt)} · {event.reasonCode || 'без кода причины'}</div><div className="mt-1 text-xs text-slate-400">Актор: {event.actorUserId || 'система'}</div></article>)}</div></section>
      </div>
    </section>
  );
}
