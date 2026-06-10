// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LocalStorageDentalChartRepository,
  createDentalChartRepository,
  SupabaseDentalChartRepository
} from './DentalChartRepository';
import type { DentalChart } from '../../types';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {},
  isSupabaseConfigured: true,
}));

describe('DentalChartRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('LocalStorageDentalChartRepository', () => {
    it('getDentalChart returns existing chart', async () => {
      const existingChart: DentalChart = {
        id: 'chart_1',
        patientId: 'patient_1',
        teeth: [
          { toothNumber: 11, condition: 'healthy', updatedAt: 'now' }
        ],
        createdAt: 'now',
        updatedAt: 'now'
      };
      localStorage.setItem('df_dental_charts', JSON.stringify({ 'patient_1': existingChart }));

      const chart = await LocalStorageDentalChartRepository.getDentalChart('patient_1');
      
      expect(chart.patientId).toBe('patient_1');
      expect(chart.teeth).toHaveLength(1);
      expect(chart.teeth[0].condition).toBe('healthy');
    });

    it('getDentalChart preserves current default-chart behavior when missing', async () => {
      const chart = await LocalStorageDentalChartRepository.getDentalChart('patient_missing');
      
      expect(chart.patientId).toBe('patient_missing');
      expect(chart.teeth).toHaveLength(32);
      expect(chart.teeth.every(t => t.condition === 'healthy')).toBe(true);

      const savedData = JSON.parse(localStorage.getItem('df_dental_charts') || '{}');
      expect(Object.keys(savedData)).toHaveLength(1);
      expect(savedData['patient_missing'].patientId).toBe('patient_missing');
    });

    it('saveDentalChart persists updates', async () => {
      const chart = await LocalStorageDentalChartRepository.getDentalChart('patient_1');
      chart.teeth[0].condition = 'caries';
      
      await LocalStorageDentalChartRepository.saveDentalChart('patient_1', chart);

      const savedChart = await LocalStorageDentalChartRepository.getDentalChart('patient_1');
      expect(savedChart.teeth[0].condition).toBe('caries');
    });
  });

  describe('createDentalChartRepository Factory', () => {
    it('returns LocalStorage version if backend is local', () => {
      const repo = createDentalChartRepository({ backend: 'local', tenantId: 't1' });
      expect(repo).toBe(LocalStorageDentalChartRepository);
    });

    it('returns LocalStorage version if backend is supabase but no tenantId', () => {
      const repo = createDentalChartRepository({ backend: 'supabase', tenantId: null });
      expect(repo).toBe(LocalStorageDentalChartRepository);
    });

    it('returns Supabase version if backend is supabase and tenantId exists', () => {
      const repo = createDentalChartRepository({ backend: 'supabase', tenantId: 't1' });
      expect(repo).toBeInstanceOf(SupabaseDentalChartRepository);
    });
  });

  describe('SupabaseDentalChartRepository', () => {
    it('getDentalChart calls supabase with correct filters', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'uuid-1', patient_id: 'p1' }, error: null });

      const mockTeethEq2 = vi.fn().mockResolvedValue({ data: [{ tooth_number: 11, condition: 'caries' }], error: null });
      const mockTeethEq1 = vi.fn().mockReturnValue({ eq: mockTeethEq2 });
      const mockTeethSelect = vi.fn().mockReturnValue({ eq: mockTeethEq1 });

      const mockClient = {
        from: vi.fn((table) => {
          if (table === 'dental_charts') {
            return { select: mockSelect, eq: mockEq, maybeSingle: mockMaybeSingle };
          }
          if (table === 'tooth_states') {
            return { select: mockTeethSelect };
          }
        })
      } as unknown as SupabaseClient;

      const repo = new SupabaseDentalChartRepository('t1', mockClient);
      const chart = await repo.getDentalChart('p1');

      expect(mockClient.from).toHaveBeenCalledWith('dental_charts');
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 't1');
      expect(mockEq).toHaveBeenCalledWith('patient_id', 'p1');
      
      expect(mockClient.from).toHaveBeenCalledWith('tooth_states');
      expect(mockTeethSelect).toHaveBeenCalledWith('*');
      expect(mockTeethEq1).toHaveBeenCalledWith('tenant_id', 't1');
      expect(mockTeethEq2).toHaveBeenCalledWith('dental_chart_id', 'uuid-1');

      expect(chart.patientId).toBe('p1');
      expect(chart.teeth.find(t => t.toothNumber === 11)?.condition).toBe('caries');
      expect(chart.teeth).toHaveLength(32); // should merge with default
    });

    it('getDentalChart returns default chart when no Supabase chart exists', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

      const mockClient = {
        from: vi.fn().mockReturnValue({ select: mockSelect, eq: mockEq, maybeSingle: mockMaybeSingle })
      } as unknown as SupabaseClient;

      const repo = new SupabaseDentalChartRepository('t1', mockClient);
      const chart = await repo.getDentalChart('p1');

      expect(chart.patientId).toBe('p1');
      expect(chart.teeth).toHaveLength(32);
      expect(chart.id.startsWith('chart_')).toBe(true);
    });

    it('saveDentalChart uses existing stable chart ID if present', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'uuid-stable' }, error: null });

      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockTeethUpsert = vi.fn().mockResolvedValue({ error: null });

      const mockClient = {
        from: vi.fn((table) => {
          if (table === 'dental_charts') {
            return { select: mockSelect, eq: mockEq, maybeSingle: mockMaybeSingle, upsert: mockUpsert };
          }
          if (table === 'tooth_states') {
            return { upsert: mockTeethUpsert };
          }
        })
      } as unknown as SupabaseClient;

      const repo = new SupabaseDentalChartRepository('t1', mockClient);
      
      const chart: DentalChart = {
        id: 'chart_p1', // local ID
        patientId: 'p1',
        teeth: [{ toothNumber: 11, condition: 'healthy', updatedAt: 'now' }],
        createdAt: 'now',
        updatedAt: 'now'
      };

      await repo.saveDentalChart('p1', chart);

      // Verify chart upsert uses stable ID
      const upsertArgs = mockUpsert.mock.calls[0];
      expect(upsertArgs[0].id).toBe('uuid-stable');
      
      // Verify teeth upsert uses stable ID
      const teethUpsertArgs = mockTeethUpsert.mock.calls[0];
      expect(teethUpsertArgs[0][0].dental_chart_id).toBe('uuid-stable');
    });

    it('saveDentalChart creates new UUID if no existing chart', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockTeethUpsert = vi.fn().mockResolvedValue({ error: null });

      const mockClient = {
        from: vi.fn((table) => {
          if (table === 'dental_charts') {
            return { select: mockSelect, eq: mockEq, maybeSingle: mockMaybeSingle, upsert: mockUpsert };
          }
          if (table === 'tooth_states') {
            return { upsert: mockTeethUpsert };
          }
        })
      } as unknown as SupabaseClient;

      const repo = new SupabaseDentalChartRepository('t1', mockClient);
      
      const chart: DentalChart = {
        id: 'chart_p1', // local ID
        patientId: 'p1',
        teeth: [{ toothNumber: 11, condition: 'healthy', updatedAt: 'now' }],
        createdAt: 'now',
        updatedAt: 'now'
      };

      await repo.saveDentalChart('p1', chart);

      const upsertArgs = mockUpsert.mock.calls[0];
      expect(upsertArgs[0].id).not.toBe('chart_p1');
      expect(upsertArgs[0].id).not.toBe('uuid-stable');

      const teethUpsertArgs = mockTeethUpsert.mock.calls[0];
      expect(teethUpsertArgs[0][0].dental_chart_id).toBe(upsertArgs[0].id);
    });
  });
});
