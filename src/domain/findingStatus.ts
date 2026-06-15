import type { DentalFinding, FindingStatus } from '../types';

export const FINDING_STATUSES: readonly FindingStatus[] = [
  'discovered',
  'planned',
  'in_treatment',
  'completed',
  'declined_by_patient',
  'monitoring',
  'archived',
];

export const ACTIVE_FINDING_STATUSES: readonly FindingStatus[] = [
  'discovered',
  'planned',
  'in_treatment',
  'monitoring',
];

export const INACTIVE_FINDING_STATUSES: readonly FindingStatus[] = [
  'completed',
  'declined_by_patient',
  'archived',
];

export const TREATMENT_PLAN_ELIGIBLE_FINDING_STATUSES: readonly FindingStatus[] = [
  'discovered',
  'monitoring',
];

export const LEGACY_FINDING_STATUS_MAP: Record<string, FindingStatus> = {
  recommended: 'discovered',
  included_in_plan: 'planned',
  observing: 'monitoring',
};

export function normalizeFindingStatus(status: string | undefined | null): FindingStatus {
  if (!status) return 'discovered';

  // Handle legacy mapping
  if (status in LEGACY_FINDING_STATUS_MAP) {
    return LEGACY_FINDING_STATUS_MAP[status];
  }

  // Handle canonical statuses
  if ((FINDING_STATUSES as readonly string[]).includes(status)) {
    return status as FindingStatus;
  }

  // Safe fallback for unknown status
  return 'discovered';
}

export function isActiveFindingStatus(status: FindingStatus | string | undefined | null): boolean {
  const normalized = normalizeFindingStatus(status);
  return (ACTIVE_FINDING_STATUSES as readonly FindingStatus[]).includes(normalized);
}

export function isInactiveFindingStatus(status: FindingStatus | string | undefined | null): boolean {
  const normalized = normalizeFindingStatus(status);
  return (INACTIVE_FINDING_STATUSES as readonly FindingStatus[]).includes(normalized);
}

export function isArchivedFindingStatus(status: FindingStatus | string | undefined | null): boolean {
  return normalizeFindingStatus(status) === 'archived';
}

export function isFindingEligibleForTreatmentPlan(
  finding: Pick<DentalFinding, 'includeInTreatmentPlan' | 'status' | 'plannedWorkRecordIds'>,
): boolean {
  const normalizedStatus = normalizeFindingStatus(finding.status);
  const alreadyLinkedToPlan = Boolean(finding.plannedWorkRecordIds?.length);

  return (
    finding.includeInTreatmentPlan === true &&
    (TREATMENT_PLAN_ELIGIBLE_FINDING_STATUSES as readonly FindingStatus[]).includes(normalizedStatus) &&
    !alreadyLinkedToPlan
  );
}

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  discovered: 'Выявлено',
  planned: 'В плане',
  in_treatment: 'В лечении',
  monitoring: 'Наблюдение',
  completed: 'Завершено',
  declined_by_patient: 'Пациент отказался',
  archived: 'Архив',
};
