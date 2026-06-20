import type { ClinicalEncounterStatus } from '../../data/repositories/EncounterVisitRepository';
import { ENCOUNTER_STATUS_LABELS } from './encounterLabels';

const STATUS_CLASSES: Record<ClinicalEncounterStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  locked: 'bg-amber-100 text-amber-700 border-amber-200',
  archived: 'bg-slate-200 text-slate-600 border-slate-300',
};

interface ClinicalEncounterStatusBadgeProps {
  status: ClinicalEncounterStatus;
}

export function ClinicalEncounterStatusBadge({ status }: ClinicalEncounterStatusBadgeProps) {
  return (
    <span
      data-testid={`encounter-status-${status}`}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[status]}`}
    >
      {ENCOUNTER_STATUS_LABELS[status]}
    </span>
  );
}
