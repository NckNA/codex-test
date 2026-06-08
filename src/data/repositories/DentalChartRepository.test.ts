// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageDentalChartRepository } from './DentalChartRepository';
import type { DentalChart } from '../../types';

describe('DentalChartRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

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
    // Current behavior: storage.getDentalChart creates and returns default chart when missing
    const chart = await LocalStorageDentalChartRepository.getDentalChart('patient_missing');
    
    expect(chart.patientId).toBe('patient_missing');
    expect(chart.teeth).toHaveLength(32);
    expect(chart.teeth.every(t => t.condition === 'healthy')).toBe(true);

    // Verify it was persisted to localStorage
    const savedData = JSON.parse(localStorage.getItem('df_dental_charts') || '{}');
    expect(Object.keys(savedData)).toHaveLength(1);
    expect(savedData['patient_missing'].patientId).toBe('patient_missing');
  });

  it('saveDentalChart persists updates', async () => {
    const chart = await LocalStorageDentalChartRepository.getDentalChart('patient_1');
    
    // Modify one tooth
    chart.teeth[0].condition = 'caries';
    
    await LocalStorageDentalChartRepository.saveDentalChart('patient_1', chart);

    const savedChart = await LocalStorageDentalChartRepository.getDentalChart('patient_1');
    expect(savedChart.teeth[0].condition).toBe('caries');
  });

  it('saveDentalChart does not create/update findings', async () => {
    localStorage.setItem('df_dental_findings', JSON.stringify([]));

    const chart = await LocalStorageDentalChartRepository.getDentalChart('patient_1');
    chart.teeth[0].condition = 'caries'; // Typically this might create a finding in the UI

    await LocalStorageDentalChartRepository.saveDentalChart('patient_1', chart);

    // The repository should only save the chart, leaving findings untouched
    const findingsStr = localStorage.getItem('df_dental_findings');
    expect(findingsStr).toBe('[]');
  });
});
