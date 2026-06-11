import { storage } from '../../utils/storage';
import type { DentalChart, ToothRecord, ToothNumber, ToothSurface } from '../../types';
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
        dentition: 'permanent',
        presenceStatus: (row as any).presence_status || 'natural',
        visualState: row.condition as any, // Legacy mapping
        diagnoses: (row as any).diagnoses || [],
        plannedWorks: (row as any).planned_works || [],
        completedWorks: (row as any).completed_works || [],
        condition: row.condition as any, // Legacy
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
        complaints: chart.complaints || null,
        diagnosis: chart.diagnosis || null,
      }, {
        onConflict: 'tenant_id,patient_id'
      });

    if (chartError) throw chartError;

    // 5. Save tooth_states using that same stable chartId
    const teethRows = chart.teeth.map(t => ({
      tenant_id: this.tenantId,
      dental_chart_id: chartId,
      tooth_number: t.toothNumber,
      presence_status: t.presenceStatus,
      condition: t.visualState || t.condition || 'healthy', // Legacy column
      diagnoses: t.diagnoses,
      planned_works: t.plannedWorks,
      completed_works: t.completedWorks,
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
