import { useState } from 'react';
import type { CompletedService } from '../../data/repositories/EncounterVisitRepository';
import type { CompletedServiceActionName } from '../../data/hooks/useCompletedServiceActions';
import { getCompletedServiceRoleCapabilities, type CompletedServiceUserRole } from './completedServicePermissions';

interface CompletedServiceActionsProps {
  service: CompletedService;
  role: CompletedServiceUserRole;
  actionLoading: CompletedServiceActionName | null;
  onVoid: (completedServiceId: string, reason: string) => Promise<void>;
}

export function CompletedServiceActions({ service, role, actionLoading, onVoid }: CompletedServiceActionsProps) {
  const capabilities = getCompletedServiceRoleCapabilities(role);
  const [isVoidOpen, setIsVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const isBusy = actionLoading !== null;
  const canVoid = ['completed', 'corrected'].includes(service.status) && capabilities.canVoid;

  if (!canVoid) return null;

  const buttonClass = 'rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="mt-4 space-y-3">
      <button
        type="button"
        data-testid={`completed-service-void-${service.id}`}
        disabled={isBusy}
        onClick={() => setIsVoidOpen((value) => !value)}
        className={`${buttonClass} bg-rose-600 text-white hover:bg-rose-700`}
      >
        Аннулировать услугу
      </button>

      {isVoidOpen && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
          <label className="mb-2 block text-xs font-semibold text-rose-800" htmlFor={`completed-service-reason-${service.id}`}>
            Причина аннулирования
          </label>
          <textarea
            id={`completed-service-reason-${service.id}`}
            data-testid={`completed-service-void-reason-${service.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-20 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-rose-400"
            placeholder="Укажите причину аннулирования выполненной услуги"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              data-testid={`completed-service-void-confirm-${service.id}`}
              disabled={isBusy || !reason.trim()}
              onClick={async () => {
                await onVoid(service.id, reason);
                setReason('');
                setIsVoidOpen(false);
              }}
              className={`${buttonClass} bg-rose-600 text-white hover:bg-rose-700`}
            >
              {actionLoading === 'void' ? 'Аннулируем...' : 'Подтвердить аннулирование'}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setIsVoidOpen(false)}
              className={`${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
