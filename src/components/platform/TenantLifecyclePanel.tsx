import { useState } from 'react';
import type { TenantLifecycle } from '../../domain/platform/TenantLifecycle';

interface Props {
  lifecycle: TenantLifecycle;
  pending?: boolean;
  onExtend: (expiresAt: string, graceExpiresAt?: string) => Promise<boolean> | boolean;
  onShorten: (expiresAt: string, graceExpiresAt: string | undefined, immediateExpiration: boolean) => Promise<boolean> | boolean;
  onSuspend: (reasonCode: string, note?: string, suspendedUntil?: string) => Promise<boolean> | boolean;
  onResume: () => Promise<boolean> | boolean;
  onArchive: (reasonCode: string) => Promise<boolean> | boolean;
}

const format = (value?: string) => value ? new Date(value).toLocaleString('ru-RU') : 'Не задано';

export function TenantLifecyclePanel({ lifecycle, pending = false, onExtend, onShorten, onSuspend, onResume, onArchive }: Props) {
  const [expiresAt, setExpiresAt] = useState('');
  const [graceAt, setGraceAt] = useState('');
  const [reason, setReason] = useState('administrative');
  const [note, setNote] = useState('');
  const [suspendedUntil, setSuspendedUntil] = useState('');
  const [shorteningConfirmed, setShorteningConfirmed] = useState(false);
  const [archiveConfirmed, setArchiveConfirmed] = useState(false);
  const archived = lifecycle.effectiveStatus === 'archived';
  const nextExpiryTime = expiresAt ? Date.parse(new Date(expiresAt).toISOString()) : Number.NaN;
  const shortening = Boolean(lifecycle.subscriptionExpiresAt && Number.isFinite(nextExpiryTime) && nextExpiryTime < Date.parse(lifecycle.subscriptionExpiresAt));

  return (
    <section className="rounded-2xl border bg-white p-5" aria-label="Жизненный цикл клиники">
      <h2 className="text-lg font-semibold">Жизненный цикл</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div><dt className="text-xs uppercase text-slate-500">Сохранённый статус</dt><dd className="font-medium">{lifecycle.storedStatus}</dd></div>
        <div><dt className="text-xs uppercase text-slate-500">Эффективный статус</dt><dd className="font-medium">{lifecycle.effectiveStatus}</dd></div>
        <div><dt className="text-xs uppercase text-slate-500">Начало подписки</dt><dd>{format(lifecycle.subscriptionStartedAt)}</dd></div>
        <div><dt className="text-xs uppercase text-slate-500">Окончание подписки</dt><dd>{format(lifecycle.subscriptionExpiresAt)}</dd></div>
        <div><dt className="text-xs uppercase text-slate-500">Льготный срок</dt><dd>{format(lifecycle.graceExpiresAt)}</dd></div>
        <div><dt className="text-xs uppercase text-slate-500">Приостановка до</dt><dd>{format(lifecycle.suspendedUntil)}</dd></div>
      </dl>

      {!archived && <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4"><h3 className="font-medium">Изменить подписку</h3><div className="mt-3 grid gap-2"><input aria-label="Новая дата окончания" type="datetime-local" value={expiresAt} onChange={(e) => { setExpiresAt(e.target.value); setShorteningConfirmed(false); }} className="rounded-lg border p-2" /><input aria-label="Новый льготный срок" type="datetime-local" value={graceAt} onChange={(e) => setGraceAt(e.target.value)} className="rounded-lg border p-2" />{shortening && <label className="flex items-start gap-2 text-sm text-amber-800"><input aria-label="Подтверждение сокращения подписки" type="checkbox" checked={shorteningConfirmed} onChange={(e) => setShorteningConfirmed(e.target.checked)} /><span>Подтверждаю сокращение срока подписки. Это может немедленно остановить работу клиники.</span></label>}<button type="button" data-testid="extend-subscription" disabled={pending || !expiresAt || (shortening && !shorteningConfirmed)} onClick={() => { const nextExpiry = new Date(expiresAt).toISOString(); const nextGrace = graceAt ? new Date(graceAt).toISOString() : undefined; if (shortening) { void onShorten(nextExpiry, nextGrace, Date.parse(nextExpiry) <= Date.now()); } else { void onExtend(nextExpiry, nextGrace); } }} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-40">{shortening ? 'Сократить подписку' : 'Продлить подписку'}</button></div></div>
        <div className="rounded-xl bg-slate-50 p-4"><h3 className="font-medium">Приостановить работу</h3><div className="mt-3 grid gap-2"><select aria-label="Причина приостановки" value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-lg border p-2"><option value="subscription_nonpayment">Неоплата подписки</option><option value="contract_pause">Пауза договора</option><option value="compliance_review">Проверка соответствия</option><option value="customer_request">Запрос клиента</option><option value="security_incident">Инцидент безопасности</option><option value="administrative">Административная</option><option value="other">Другая</option></select><input aria-label="Безопасная заметка" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Без медицинских данных" className="rounded-lg border p-2" /><input aria-label="Приостановить до" type="datetime-local" value={suspendedUntil} onChange={(e) => setSuspendedUntil(e.target.value)} className="rounded-lg border p-2" /><button type="button" data-testid="suspend-tenant" disabled={pending} onClick={() => { const indefinite = !suspendedUntil; if (!indefinite || window.confirm('Подтвердите бессрочную приостановку клиники.')) void onSuspend(reason, note || undefined, suspendedUntil ? new Date(suspendedUntil).toISOString() : undefined); }} className="rounded-lg bg-amber-600 px-4 py-2 text-white disabled:opacity-40">Приостановить</button></div></div>
      </div>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {lifecycle.effectiveStatus === 'suspended' && <button type="button" data-testid="resume-tenant" disabled={pending} onClick={() => void onResume()} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-40">Возобновить работу</button>}
        {!archived && <><label className="flex items-center gap-2 text-sm text-red-700"><input aria-label="Подтверждение архивирования" type="checkbox" checked={archiveConfirmed} onChange={(e) => setArchiveConfirmed(e.target.checked)} />Архивирование отключит работу клиники, но не удалит данные.</label><button type="button" data-testid="archive-tenant" disabled={pending || !archiveConfirmed} onClick={() => void onArchive('administrative_archive')} className="rounded-lg border border-red-300 px-4 py-2 text-red-700 disabled:opacity-40">Архивировать клинику</button></>}
      </div>
      <p className="mt-4 text-xs text-slate-500">Физическое удаление клиники не поддерживается.</p>
    </section>
  );
}
