import { useState } from 'react';
import type { PatientVisit } from '../../data/repositories/EncounterVisitRepository';
import type { VisitLifecycleActionName } from '../../data/hooks/useVisitLifecycleActions';

import { getVisitRoleCapabilities, type VisitUserRole } from './visitPermissions';

interface VisitLifecycleActionsProps {
  visit: PatientVisit;
  role: VisitUserRole;
  actionLoading: VisitLifecycleActionName | null;
  onStart: (visitId: string) => Promise<void>;
  onComplete: (visitId: string) => Promise<void>;
  onCancel: (visitId: string, reason: string) => Promise<void>;
}

export function VisitLifecycleActions({
  visit,
  role,
  actionLoading,
  onStart,
  onComplete,
  onCancel,
}: VisitLifecycleActionsProps) {
  const capabilities = getVisitRoleCapabilities(role);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const isBusy = actionLoading !== null;
  const isTerminal = ['completed', 'cancelled', 'archived'].includes(visit.status);

  if (isTerminal) {
    return null;
  }

  const canStart = visit.status === 'checked_in' && capabilities.canStart;
  const canComplete = ['checked_in', 'in_progress'].includes(visit.status) && capabilities.canComplete;
  const canCancel = ['checked_in', 'in_progress'].includes(visit.status) && capabilities.canCancel;

  if (!canStart && !canComplete && !canCancel) {
    return null;
  }

  const buttonClass = 'rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {canStart && (
          <button
            type="button"
            data-testid={`visit-start-${visit.id}`}
            disabled={isBusy}
            onClick={() => onStart(visit.id)}
            className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}
          >
            {actionLoading === 'start' ? 'Начинаем...' : 'Начать визит'}
          </button>
        )}
        {canComplete && (
          <button
            type="button"
            data-testid={`visit-complete-${visit.id}`}
            disabled={isBusy}
            onClick={() => onComplete(visit.id)}
            className={`${buttonClass} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            {actionLoading === 'complete' ? 'Завершаем...' : 'Завершить визит'}
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            data-testid={`visit-cancel-${visit.id}`}
            disabled={isBusy}
            onClick={() => setIsCancelOpen((value) => !value)}
            className={`${buttonClass} bg-white text-rose-700 border border-rose-200 hover:bg-rose-50`}
          >
            Отменить визит
          </button>
        )}
      </div>

      {isCancelOpen && canCancel && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
          <label className="block text-xs font-semibold text-rose-800 mb-2" htmlFor={`visit-cancel-${visit.id}`}>
            Причина отмены
          </label>
          <textarea
            id={`visit-cancel-${visit.id}`}
            data-testid={`visit-cancel-reason-${visit.id}`}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            className="w-full min-h-20 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-rose-400"
            placeholder="Укажите причину отмены визита"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              data-testid={`visit-cancel-confirm-${visit.id}`}
              disabled={isBusy || !cancelReason.trim()}
              onClick={async () => {
                await onCancel(visit.id, cancelReason);
                setCancelReason('');
                setIsCancelOpen(false);
              }}
              className={`${buttonClass} bg-rose-600 text-white hover:bg-rose-700`}
            >
              {actionLoading === 'cancel' ? 'Отменяем...' : 'Подтвердить отмену'}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setIsCancelOpen(false)}
              className={`${buttonClass} bg-white text-slate-700 border border-slate-200 hover:bg-slate-50`}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
