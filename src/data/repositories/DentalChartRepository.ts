import { storage } from '../../utils/storage';
import { normalizeDentalChart, normalizeToothRecord } from '../../utils/dentalChartNormalization';
import type { DentalChart, ToothRecord, ToothNumber, ToothCondition, ToothSurface } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DentalChartRepository {
  getDentalChart(patientId: string): Promise<DentalChart>;
  saveDentalChart(patientId: string, chart: DentalChart): Promise<void>;
}

export type DentalChartRepositoryBackend = 'local' | 'supabase';

export interface CreateDentalChartRepositoryOptions {
  tenantId?: string | null;
  backend: DentalChartRepositoryBackend;
}

const DENTAL_CHART_EDITOR_COLUMN_NAMES = [
  'presence_status',
  'visual_state',
  'visual_state_override',
  'diagnoses',
  'planned_works',
  'planned_work_records',
  'completed_works',
] as const;

const readStringArray = (value: unknown): string[] => {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
};

const readPlannedWorkRecords = (value: unknown): ToothRecord['plannedWorkRecords'] => {
  return Array.isArray(value) ? value as ToothRecord['plannedWorkRecords'] : [];
};

const errorText = (error: unknown): string => {
  if (!error || typeof error !== 'object') return '';

  const candidate = error as { message?: unknown; details?: unknown; hint?: unknown };

  return [candidate.message, candidate.details, candidate.hint]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();
};

const isMissingEditorColumnError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as { code?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const text = errorText(error);
  const mentionsEditorColumn = DENTAL_CHART_EDITOR_COLUMN_NAMES.some(column => text.includes(column));

  if (!mentionsEditorColumn) return false;

  return code === 'PGRST204'
    || code === '42703'
    || text.includes('schema cache')
    || text.includes('column');
};

const createLegacyToothStateRow = (tenantId: string, chartId: string, tooth: ToothRecord) => ({
  tenant_id: tenantId,
  dental_chart_id: chartId,
  tooth_number: tooth.toothNumber,
  condition: tooth.condition,
  surfaces: tooth.surfaces || [],
  crown: tooth.crown || null,
  root: tooth.root || null,
  gum: tooth.gum || null,
  bone: tooth.bone || null,
  canal: tooth.canal || null,
  notes: tooth.notes || null,
});

const createEditorToothStateRow = (tenantId: string, chartId: string, tooth: ToothRecord) => ({
  ...createLegacyToothStateRow(tenantId, chartId, tooth),
  presence_status: tooth.presenceStatus || null,
  visual_state: tooth.visualState || null,
  visual_state_override: tooth.visualStateOverride || null,
  diagnoses: tooth.diagnoses || [],
  planned_works: tooth.plannedWorks || [],
  planned_work_records: tooth.plannedWorkRecords || [],
  completed_works: tooth.completedWorks || [],
});

export const LocalStorageDentalChartRepository: DentalChartRepository = {
  async getDentalChart(patientId: string): Promise<DentalChart> {
    return normalizeDentalChart(storage.getDentalChart(patientId));
  },

  async saveDentalChart(patientId: string, chart: DentalChart): Promise<void> {
    storage.saveDentalChart(patientId, normalizeDentalChart(chart));
  },
};

export class SupabaseDentalChartRepository implements DentalChartRepository {
  private readonly tenantId: string;
  private readonly client: SupabaseClient;

  constructor(tenantId: string, client: SupabaseClient) {
    this.tenantId = tenantId;
    this.client = client;
  }

  async getDentalChart(patientId: string): Promise<DentalChart> {
    const { data: chartData, error: chartError } = await this.client
      .from('dental_charts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('patient_id', patientId)
      .maybeSingle();

    if (chartError) throw chartError;

    if (!chartData) {
      // Prefer read-only get. Return a default chart without saving it to DB yet.
      return storage.createDefaultDentalChart(patientId);
    }

    const { data: teethData, error: teethError } = await this.client
      .from('tooth_states')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('dental_chart_id', chartData.id);

    if (teethError) throw teethError;

    // We must ensure that the chart has 32 teeth records. If some are missing, merge with default.
    const defaultChart = storage.createDefaultDentalChart(patientId);
    const dbTeethMap = new Map<number, ToothRecord>();

    (teethData || []).forEach(row => {
      const toothRow = row as Record<string, unknown>;

      dbTeethMap.set(row.tooth_number, normalizeToothRecord({
        toothNumber: row.tooth_number as ToothNumber,
        condition: row.condition as ToothCondition,
        surfaces: (row.surfaces || []) as ToothSurface[],
        crown: row.crown || undefined,
        root: row.root || undefined,
        gum: row.gum || undefined,
        bone: row.bone || undefined,
        canal: row.canal || undefined,
        notes: row.notes || undefined,
        updatedAt: row.updated_at,
        presenceStatus: toothRow.presence_status as ToothRecord['presenceStatus'] || undefined,
        visualState: toothRow.visual_state as ToothRecord['visualState'] || undefined,
        visualStateOverride: toothRow.visual_state_override as ToothRecord['visualStateOverride'] || undefined,
        diagnoses: readStringArray(toothRow.diagnoses),
        plannedWorks: readStringArray(toothRow.planned_works),
        plannedWorkRecords: readPlannedWorkRecords(toothRow.planned_work_records),
        completedWorks: readStringArray(toothRow.completed_works),
      }));
    });

    const mergedTeeth = defaultChart.teeth.map(defaultTooth =>
      dbTeethMap.get(defaultTooth.toothNumber) || defaultTooth
    );

    return normalizeDentalChart({
      id: chartData.id,
      patientId: chartData.patient_id,
      teeth: mergedTeeth,
      complaints: chartData.complaints || undefined,
      diagnosis: chartData.diagnosis || undefined,
      createdAt: chartData.created_at,
      updatedAt: chartData.updated_at,
    });
  }

  async saveDentalChart(patientId: string, chart: DentalChart): Promise<void> {
    const normalizedChart = normalizeDentalChart(chart);

    // 1. First select existing dental_charts row by tenant_id + patient_id
    const { data: existingChart, error: fetchError } = await this.client
      .from('dental_charts')
      .select('id')
      .eq('tenant_id', this.tenantId)
      .eq('patient_id', patientId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    let chartId: string;

    // 2. If existing row exists, use existing.id as stable chartId
    if (existingChart?.id) {
      chartId = existingChart.id;
    } else {
      // 3. If no row exists, create a new UUID only once
      chartId = crypto.randomUUID();
    }

    // 4. Save/update dental_charts using stable chartId
    const { error: chartError } = await this.client
      .from('dental_charts')
      .upsert({
        id: chartId,
        tenant_id: this.tenantId,
        patient_id: patientId,
        complaints: normalizedChart.complaints || null,
        diagnosis: normalizedChart.diagnosis || null,
      }, {
        onConflict: 'tenant_id,patient_id'
      });

    if (chartError) throw chartError;

    // 5. Save tooth_states using that same stable chartId.
    const teethRows = normalizedChart.teeth.map(t => createEditorToothStateRow(this.tenantId, chartId, t));

    const { error: teethError } = await this.client
      .from('tooth_states')
      .upsert(teethRows, {
        onConflict: 'dental_chart_id,tooth_number'
      });

    if (teethError) {
      if (!isMissingEditorColumnError(teethError)) {
        throw teethError;
      }

      const legacyTeethRows = normalizedChart.teeth.map(t => createLegacyToothStateRow(this.tenantId, chartId, t));
      const { error: legacyTeethError } = await this.client
        .from('tooth_states')
        .upsert(legacyTeethRows, {
          onConflict: 'dental_chart_id,tooth_number'
        });

      if (legacyTeethError) throw legacyTeethError;
    }
  }
}

/**
 * Factory function to instantiate the DentalChartRepository.
 */
export function createDentalChartRepository(options: CreateDentalChartRepositoryOptions): DentalChartRepository {
  if (options.backend === 'supabase' && options.tenantId && supabase) {
    return new SupabaseDentalChartRepository(options.tenantId, supabase);
  }

  return LocalStorageDentalChartRepository;
}
