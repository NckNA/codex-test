import { useState } from 'react';
import { validateSubscriptionDates } from '../../domain/platform/TenantSubscription';
import type { CreatePlatformTenantCommand } from '../../data/repositories/PlatformTenantRepository';

interface Props {
  open: boolean;
  pending?: boolean;
  onCancel: () => void;
  onCreate: (command: CreatePlatformTenantCommand) => Promise<boolean> | boolean;
}

const operationKey = () => globalThis.crypto?.randomUUID?.() ?? `tenant-create-${Date.now()}`;

export function CreateTenantDialog({ open, pending = false, onCancel, onCreate }: Props) {
  const [name, setName] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [graceExpiresAt, setGraceExpiresAt] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  if (!open) return null;

  const submit = async () => {
    const validation = validateSubscriptionDates(startsAt, expiresAt, graceExpiresAt || undefined);
    if (name.trim().length < 2) return setError('Укажите корректное название клиники.');
    if (!ownerUserId.trim()) return setError('Для клиники необходимо назначить хотя бы одного владельца.');
    if (!validation.valid) return setError('Проверьте даты действия подписки.');
    if (!confirmed) return setError('Подтвердите создание клиники.');
    setError('');
    const created = await onCreate({
      name: name.trim(), ownerUserId: ownerUserId.trim(), subscriptionStartedAt: new Date(startsAt).toISOString(),
      subscriptionExpiresAt: new Date(expiresAt).toISOString(),
      graceExpiresAt: graceExpiresAt ? new Date(graceExpiresAt).toISOString() : undefined,
      operationKey: operationKey(),
    });
    if (created) {
      setName(''); setOwnerUserId(''); setStartsAt(''); setExpiresAt(''); setGraceExpiresAt(''); setConfirmed(false);
      onCancel();
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Создание клиники" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">Создать клинику</h2>
        <p className="mt-2 text-sm text-amber-700">Владелец получает управление только этой клиникой и не становится администратором платформы.</p>
        <div className="mt-5 grid gap-4">
          <label className="text-sm font-medium">Название клиники<input aria-label="Название клиники" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm font-medium">ID владельца<input aria-label="ID владельца" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium">Начало<input aria-label="Начало подписки" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
            <label className="text-sm font-medium">Окончание<input aria-label="Окончание подписки" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
            <label className="text-sm font-medium">Льготный срок<input aria-label="Льготный срок" type="datetime-local" value={graceExpiresAt} onChange={(e) => setGraceExpiresAt(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input aria-label="Подтверждение создания" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />Подтверждаю создание клиники, владельца и периода подписки.</label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2">Отмена</button><button type="button" data-testid="confirm-create-tenant" disabled={pending} onClick={() => void submit()} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{pending ? 'Создание…' : 'Создать клинику'}</button></div>
      </div>
    </div>
  );
}
