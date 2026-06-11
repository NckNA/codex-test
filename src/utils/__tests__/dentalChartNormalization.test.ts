import { describe, expect, it } from 'vitest';
import type { DentalChart, ToothRecord } from '../../types';
import {
  derivePresenceStatusFromCondition,
  deriveVisualStateFromTooth,
  normalizeDentalChart,
  normalizeToothRecord,
} from '../dentalChartNormalization';

const baseTooth: ToothRecord = {
  toothNumber: 11,
  condition: 'healthy',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createChart(tooth: ToothRecord): DentalChart {
  return {
    id: 'chart_patient_1',
    patientId: 'patient_1',
    teeth: [tooth],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('dental chart normalization', () => {
  it('adds forward-compatible defaults to an old healthy tooth record', () => {
    const normalized = normalizeToothRecord(baseTooth);

    expect(normalized.presenceStatus).toBe('natural');
    expect(normalized.visualState).toBe('healthy');
    expect(normalized.diagnoses).toEqual([]);
    expect(normalized.plannedWorks).toEqual([]);
    expect(normalized.plannedWorkRecords).toEqual([]);
    expect(normalized.completedWorks).toEqual([]);
    expect(normalized.surfaces).toEqual([]);
  });

  it('derives missing presence status from condition', () => {
    expect(derivePresenceStatusFromCondition('missing')).toBe('missing');
    expect(normalizeToothRecord({ ...baseTooth, condition: 'missing' }).presenceStatus).toBe('missing');
  });

  it('derives implant presence status from condition', () => {
    expect(derivePresenceStatusFromCondition('implant')).toBe('implant');
    expect(normalizeToothRecord({ ...baseTooth, condition: 'implant' }).presenceStatus).toBe('implant');
  });

  it('derives root remnant presence status from root condition', () => {
    expect(derivePresenceStatusFromCondition('root')).toBe('root_remnant');
    expect(normalizeToothRecord({ ...baseTooth, condition: 'root' }).presenceStatus).toBe('root_remnant');
  });

  it('uses visualStateOverride before visualState and condition', () => {
    const tooth: ToothRecord = {
      ...baseTooth,
      condition: 'healthy',
      visualState: 'caries',
      visualStateOverride: 'crown',
    };

    expect(deriveVisualStateFromTooth(tooth)).toBe('crown');
    expect(normalizeToothRecord(tooth).visualState).toBe('crown');
  });

  it('does not mutate original dental chart input', () => {
    const original = createChart(baseTooth);
    const snapshot = JSON.parse(JSON.stringify(original));

    const normalized = normalizeDentalChart(original);

    expect(original).toEqual(snapshot);
    expect(normalized).not.toBe(original);
    expect(normalized.teeth[0]).not.toBe(original.teeth[0]);
  });

  it('preserves existing forward-compatible fields', () => {
    const tooth: ToothRecord = {
      ...baseTooth,
      condition: 'healthy',
      surfaces: ['occlusal'],
      presenceStatus: 'impacted',
      visualState: 'filled',
      diagnoses: ['dx_1'],
      plannedWorks: ['work_1'],
      plannedWorkRecords: [{
        id: 'planned_1',
        workId: 'work_1',
        zone: 'crown',
        status: 'planned',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
      completedWorks: ['work_done_1'],
    };

    const normalized = normalizeToothRecord(tooth);

    expect(normalized.presenceStatus).toBe('impacted');
    expect(normalized.visualState).toBe('filled');
    expect(normalized.surfaces).toEqual(['occlusal']);
    expect(normalized.diagnoses).toEqual(['dx_1']);
    expect(normalized.plannedWorks).toEqual(['work_1']);
    expect(normalized.plannedWorkRecords).toEqual(tooth.plannedWorkRecords);
    expect(normalized.completedWorks).toEqual(['work_done_1']);
  });

  it('defaults surfaces to an empty array when absent', () => {
    const normalized = normalizeToothRecord({
      toothNumber: 12,
      condition: 'healthy',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(normalized.surfaces).toEqual([]);
  });

  it('falls back to healthy when a legacy record has an invalid condition', () => {
    const invalidTooth = {
      toothNumber: 13,
      condition: 'legacy_unknown',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as unknown as ToothRecord;

    const normalized = normalizeToothRecord(invalidTooth);

    expect(normalized.condition).toBe('healthy');
    expect(normalized.presenceStatus).toBe('natural');
    expect(normalized.visualState).toBe('healthy');
  });
});
