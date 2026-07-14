import { useState } from 'react';
import type { PlatformTenantOwner } from '../../data/repositories/PlatformTenantRepository';

interface Props {
  tenantId: string;
  owners: PlatformTenantOwner[];
  pending?: boolean;
  onAdd: (userId: string) => Promise<boolean> | boolean;
  onReplace: (currentUserId: string, nextUserId: string) => Promise<boolean> | boolean;
  onRemove: (userId: string) => Promise<boolean> | boolean;
}

export function TenantOwnerPanel({ owners, pending = false, onAdd, onReplace, onRemove }: Props) {
  const [newOwnerId, setNewOwnerId] = useState('');
  const [replacementId, setReplacementId] = useState('');
  const [error, setError] = useState('');
  const activeOwners = owners.filter((owner) => owner.membershipStatus === 'active');

  const add = async () => {
    if (!newOwnerId.trim()) return setError('Укажите ID владельца.');
    setError('');
    if (await onAdd(newOwnerId.trim())) setNewOwnerId('');
  };

  return (
    <section className="rounded-2xl border bg-white p-5" aria-label="Владельцы клиники">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Владельцы клиники</h2><span className="text-sm text-slate-500">Активных: {activeOwners.length}</span></div>
      <div className="mt-4 space-y-3">
        {owners.map((owner) => <div key={owner.userId} className="rounded-xl border p-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{owner.displayName || owner.userId}</p><p className="text-xs text-slate-500">{owner.userId} · {owner.membershipStatus}</p></div>
            <button type="button" data-testid={`remove-owner-${owner.userId}`} disabled={pending || activeOwners.length <= 1 || owner.membershipStatus !== 'active'} onClick={() => void onRemove(owner.userId)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Убрать владельца</button>
          </div>
          <div className="mt-3 flex gap-2"><input aria-label={`Новый владелец вместо ${owner.userId}`} value={replacementId} onChange={(e) => setReplacementId(e.target.value)} placeholder="ID нового владельца" className="min-w-0 flex-1 rounded-lg border p-2 text-sm" /><button type="button" disabled={pending || !replacementId.trim()} onClick={() => { if (window.confirm('Заменить владельца клиники?')) void Promise.resolve(onReplace(owner.userId, replacementId.trim())).then((ok: boolean) => { if (ok) setReplacementId(''); }); }} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40">Заменить</button></div>
        </div>)}
      </div>
      <div className="mt-4 flex gap-2"><input aria-label="ID нового владельца" value={newOwnerId} onChange={(e) => setNewOwnerId(e.target.value)} placeholder="ID пользователя" className="min-w-0 flex-1 rounded-lg border p-2" /><button type="button" data-testid="add-owner" disabled={pending} onClick={() => void add()} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-40">Добавить владельца</button></div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-3 text-xs text-slate-500">Нельзя удалить последнего активного владельца клиники.</p>
    </section>
  );
}
