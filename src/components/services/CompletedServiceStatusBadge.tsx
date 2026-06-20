import type { CompletedServiceStatus } from '../../data/repositories/EncounterVisitRepository';
import { COMPLETED_SERVICE_STATUS_LABELS } from './completedServiceLabels';

const STATUS_CLASSES: Record<CompletedServiceStatus, string> = {
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  corrected: 'bg-blue-100 text-blue-700 border-blue-200',
  voided: 'bg-rose-100 text-rose-700 border-rose-200',
  archived: 'bg-slate-200 text-slate-600 border-slate-300',
};

interface CompletedServiceStatusBadgeProps {
  status: CompletedServiceStatus;
}

export function CompletedServiceStatusBadge({ status }: CompletedServiceStatusBadgeProps) {
  return (
    <span
      data-testid={`completed-service-status-${status}`}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[status]}`}
    >
      {COMPLETED_SERVICE_STATUS_LABELS[status]}
    </span>
  );
}
