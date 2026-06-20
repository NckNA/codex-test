import { useState } from 'react';
import type { ClinicalEncounter } from '../../data/repositories/EncounterVisitRepository';
import type { ClinicalEncounterActionName } from '../../data/hooks/useClinicalEncounterActions';
import { getEncounterRoleCapabilities, type EncounterUserRole } from './encounterPermissions';

interface ClinicalEncounterActionsProps {
  encounter: ClinicalEncounter;
  role: EncounterUserRole;
  actionLoading: ClinicalEncounterActionName | null;
  onStart: (encounterId: string) => Promise<void>;
  onComplete: (encounterId: string, clinicalSummary: string) => Promise<void>;
}

export function ClinicalEncounterActions({
  encounter,
  role,
  actionLoading,
  onStart,
  onComplete,
}: ClinicalEncounterActionsProps) {
  const capabilities = getEncounterRoleCapabilities(role);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [clinicalSummary, setClinicalSummary] = useState(encounter.clinicalSummary || '');
  const isBusy = actionLoading !== null;
  const isTerminal = ['completed', 'locked', 'archived'].includes(encounter.status);

  if (isTerminal) return null;

  const canStart = encounter.status === 'draft' && capabilities.canStart;
  const canComplete = ['draft', 'in_progress'].includes(encounter.status) && capabilities.canComplete;

  if (!canStart && !canComplete) return null;

  const buttonClass = 'rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {canStart && (
          <button
            type="button"
            data-testid={`encounter-start-${encounter.id}`}
            disabled={isBusy}
            onClick={() => onStart(encounter.id)}
            className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}
          >
            {actionLoading === 'start' ? 'Начинаем...' : 'Начать приём'}
          </button>
        )}
        {canComplete && (
          <button
            type="button"
            data-testid={`encounter-complete-${encounter.id}`}
            disabled={isBusy}
            onClick={() => setIsCompleteOpen((value) => !value)}
            className={`${buttonClass} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            Завершить приём
          </button>
        )}
      </div>

      {isCompleteOpen && canComplete && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
          <label className="mb-2 block text-xs font-semibold text-emerald-800" htmlFor={`encounter-summary-${encounter.id}`}>
            Клиническое описание
          </label>
          <textarea
            id={`encounter-summary-${encounter.id}`}
            data-testid={`encounter-complete-summary-${encounter.id}`}
            value={clinicalSummary}
            onChange={(event) => setClinicalSummary(event.target.value)}
            className="min-h-24 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400"
            placeholder="Кратко опишите клинический итог приёма"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              data-testid={`encounter-complete-confirm-${encounter.id}`}
              disabled={isBusy || !clinicalSummary.trim()}
              onClick={async () => {
                await onComplete(encounter.id, clinicalSummary);
                setClinicalSummary('');
                setIsCompleteOpen(false);
              }}
              className={`${buttonClass} bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              {actionLoading === 'complete' ? 'Завершаем...' : 'Подтвердить завершение'}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setIsCompleteOpen(false)}
              className={`${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
