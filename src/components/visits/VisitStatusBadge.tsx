import type { PatientVisitStatus } from '../../data/repositories/EncounterVisitRepository';
import { VISIT_STATUS_LABELS } from './visitLabels';

const STATUS_STYLES: Record<PatientVisitStatus, string> = {
  checked_in: 'bg-amber-100 text-amber-800 border-amber-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
  archived: 'bg-slate-100 text-slate-700 border-slate-200',
};

interface VisitStatusBadgeProps {
  status: PatientVisitStatus;
}

export function VisitStatusBadge({ status }: VisitStatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {VISIT_STATUS_LABELS[status]}
    </span>
  );
}
