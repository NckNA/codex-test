import type {
  DentalChart,
  ToothCondition,
  ToothPresenceStatus,
  ToothRecord,
  ToothVisualState,
} from '../types';

const TOOTH_CONDITIONS: ToothCondition[] = [
  'healthy',
  'caries',
  'filled',
  'missing',
  'crown',
  'implant',
  'root',
  'pulpitis',
  'periodontitis',
  'needs_treatment',
];

const TOOTH_CONDITION_SET = new Set<string>(TOOTH_CONDITIONS);

function isToothCondition(value: unknown): value is ToothCondition {
  return typeof value === 'string' && TOOTH_CONDITION_SET.has(value);
}

function getSafeCondition(value: unknown): ToothCondition {
  return isToothCondition(value) ? value : 'healthy';
}

export function derivePresenceStatusFromCondition(condition: ToothCondition): ToothPresenceStatus {
  if (condition === 'missing') return 'missing';
  if (condition === 'implant') return 'implant';
  if (condition === 'root') return 'root_remnant';

  return 'natural';
}

export function deriveVisualStateFromTooth(tooth: ToothRecord): ToothVisualState {
  if (isToothCondition(tooth.visualStateOverride)) {
    return tooth.visualStateOverride;
  }

  if (isToothCondition(tooth.visualState)) {
    return tooth.visualState;
  }

  return getSafeCondition(tooth.condition);
}

export function normalizeToothRecord(tooth: ToothRecord): ToothRecord {
  const condition = getSafeCondition((tooth as { condition?: unknown }).condition);
  const safeTooth: ToothRecord = {
    ...tooth,
    condition,
  };

  return {
    ...tooth,
    condition,
    surfaces: tooth.surfaces ?? [],
    presenceStatus: tooth.presenceStatus ?? derivePresenceStatusFromCondition(condition),
    visualState: deriveVisualStateFromTooth(safeTooth),
    diagnoses: tooth.diagnoses ?? [],
    plannedWorks: tooth.plannedWorks ?? [],
    plannedWorkRecords: tooth.plannedWorkRecords ?? [],
    completedWorks: tooth.completedWorks ?? [],
    updatedAt: tooth.updatedAt ?? new Date().toISOString(),
  };
}

export function normalizeDentalChart(chart: DentalChart): DentalChart {
  return {
    ...chart,
    teeth: chart.teeth.map(normalizeToothRecord),
  };
}
