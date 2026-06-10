import { storage } from '../../utils/storage';
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

export const LocalStorageDentalChartRepository: DentalChartRepository = {
  async getDentalChart(patientId: string): Promise<DentalChart> {
    return storage.getDentalChart(patientId);
  },

  async saveDentalChart(patientId: string, chart: DentalChart): Promise<void> {
    storage.saveDentalChart(patientId, chart);
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
      dbTeethMap.set(row.tooth_number, {
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
      });
    });

    const mergedTeeth = defaultChart.teeth.map(defaultTooth => 
      dbTeethMap.get(defaultTooth.toothNumber) || defaultTooth
    );

    return {
      id: chartData.id,
      patientId: chartData.patient_id,
      teeth: mergedTeeth,
      complaints: chartData.complaints || undefined,
      diagnosis: chartData.diagnosis || undefined,
      createdAt: chartData.created_at,
      updatedAt: chartData.updated_at,
    };
  }

  async saveDentalChart(patientId: string, chart: DentalChart): Promise<void> {
    // Local IDs like chart_p1 must not be sent to Supabase UUID fields.
    let chartId = chart.id;
    if (chartId.startsWith('chart_')) {
      chartId = crypto.randomUUID();
    }

    // Upsert the dental chart itself
    const { error: chartError } = await this.client
      .from('dental_charts')
      .upsert({
        id: chartId,
        tenant_id: this.tenantId,
        patient_id: patientId,
        complaints: chart.complaints || null,
        diagnosis: chart.diagnosis || null,
      }, {
        onConflict: 'tenant_id,patient_id'
      });

    if (chartError) throw chartError;

    // Use safe upsert for tooth states because unique constraint (dental_chart_id, tooth_number) exists
    const teethRows = chart.teeth.map(t => ({
      tenant_id: this.tenantId,
      dental_chart_id: chartId,
      tooth_number: t.toothNumber,
      condition: t.condition,
      surfaces: t.surfaces || [],
      crown: t.crown || null,
      root: t.root || null,
      gum: t.gum || null,
      bone: t.bone || null,
      canal: t.canal || null,
      notes: t.notes || null,
    }));

    const { error: teethError } = await this.client
      .from('tooth_states')
      .upsert(teethRows, {
        onConflict: 'dental_chart_id,tooth_number'
      });

    if (teethError) throw teethError;
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
