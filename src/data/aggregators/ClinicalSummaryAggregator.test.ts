// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getPatientMedicalSummary } from './ClinicalSummaryAggregator';
import type { DentalChart, TreatmentPlan, DentalFinding, Appointment, ChiefComplaint, ToothRecord } from '../../types';

describe('ClinicalSummaryAggregator', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty/default summary for empty patientId', async () => {
    const summary = await getPatientMedicalSummary('');
    expect(summary.dentalSummary.needsTreatment).toBe(0);
    expect(summary.dentalSummary.missing).toBe(0);
    expect(summary.lastVisit).toBeUndefined();
    expect(summary.nextVisit).toBeUndefined();
  });

  it('calculates dental summary from seeded chart/findings/plans/complaint', async () => {
    // Seed chart
    const chart: DentalChart = {
      id: 'c1',
      createdAt: 'now',
      updatedAt: 'now',
      patientId: 'patient_1',
      teeth: Array.from({ length: 32 }, (_, i) => ({
        toothNumber: i + 1,
        condition: i === 0 ? 'caries' : i === 1 ? 'pulpitis' : i === 2 ? 'missing' : 'healthy',
        updatedAt: 'now'
      } as ToothRecord))
    };
    localStorage.setItem('df_dental_charts', JSON.stringify({ 'patient_1': chart }));

    // Seed plans
    const plans: TreatmentPlan[] = [
      { id: '1', patientId: 'patient_1', title: 'Draft Plan', status: 'draft', stages: [], totalPrice: 1000, createdAt: '', updatedAt: '' },
      { id: '2', patientId: 'patient_1', title: 'Completed Plan', status: 'completed', stages: [], totalPrice: 2000, createdAt: '', updatedAt: '' }
    ];
    localStorage.setItem('df_treatment_plans', JSON.stringify(plans));

    // Seed chief complaint
    const complaint: ChiefComplaint = { id: 'cc1', patientId: 'patient_1', text: 'Toothache', relatedTeeth: [], createdAt: 'now', updatedAt: 'now' };
    localStorage.setItem('df_chief_complaints', JSON.stringify([complaint]));

    // Seed findings
    const findings: DentalFinding[] = [
      { id: '1', patientId: 'patient_1', toothNumber: 11, category: 'caries', title: 'Urgent', severity: 'urgent', status: 'discovered', description: 'a', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' },
      { id: '2', patientId: 'patient_1', toothNumber: 12, category: 'caries', title: 'High Completed', severity: 'high', status: 'completed', description: 'b', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' },
      { id: '3', patientId: 'patient_1', toothNumber: 13, category: 'caries', title: 'Med Rec', severity: 'medium', status: 'discovered', description: 'c', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' },
      { id: '4', patientId: 'patient_1', toothNumber: 14, category: 'caries', title: 'Low Obs', severity: 'low', status: 'monitoring', description: 'd', isChiefComplaintRelated: false, includeInTreatmentPlan: false, createdAt: '', updatedAt: '' }
    ];
    localStorage.setItem('df_dental_findings', JSON.stringify(findings));

    const summary = await getPatientMedicalSummary('patient_1');

    expect(summary.dentalSummary.needsTreatment).toBe(2); // caries + pulpitis
    expect(summary.dentalSummary.missing).toBe(1);
    expect(summary.dentalSummary.activePlans).toBe(1); // draft
    expect(summary.dentalSummary.totalAmount).toBe(3000); // 1000 + 2000
    expect(summary.dentalSummary.chiefComplaintText).toBe('Toothache');
    expect(summary.dentalSummary.highUrgentFindings).toBe(1); // urgent discovered (high completed is ignored)
    expect(summary.dentalSummary.notIncludedFindings).toBe(2); // discovered
    expect(summary.dentalSummary.monitoringFindings).toBe(1); // monitoring
  });

  it('calculates lastVisit and nextVisit while ignoring cancelled/blocked', async () => {
    // Avoid default chart creation in this test
    localStorage.setItem('df_dental_charts', JSON.stringify({
      'patient_1': { patientId: 'patient_1', teeth: [] }
    }));

    const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
    const pastBlocked = new Date(Date.now() - 100000).toISOString();
    const futureCancelled = new Date(Date.now() + 100000).toISOString();

    const appts: Appointment[] = [
      { id: '1', patientId: 'patient_1', doctorId: 'd1', cabinet: 'c1', service: 's1', start: pastDate, end: pastDate, status: 'completed', createdAt: 'now' },
      { id: '2', patientId: 'patient_1', doctorId: 'd1', cabinet: 'c1', service: 's1', start: futureDate, end: futureDate, status: 'confirmed', createdAt: 'now' },
      { id: '3', patientId: 'patient_1', doctorId: 'd1', cabinet: 'c1', service: 's1', start: pastBlocked, end: pastBlocked, status: 'blocked', createdAt: 'now' },
      { id: '4', patientId: 'patient_1', doctorId: 'd1', cabinet: 'c1', service: 's1', start: futureCancelled, end: futureCancelled, status: 'cancelled', createdAt: 'now' },
    ];
    localStorage.setItem('df_appointments', JSON.stringify(appts));

    const summary = await getPatientMedicalSummary('patient_1');

    expect(summary.lastVisit?.toISOString()).toBe(pastDate);
    expect(summary.nextVisit?.toISOString()).toBe(futureDate);
  });

  it('does not mutate unrelated storage', async () => {
    // Prevent default chart creation to keep storage exact
    localStorage.setItem('df_dental_charts', JSON.stringify({ 'patient_1': { patientId: 'patient_1', teeth: [] } }));
    
    const findingsData = JSON.stringify([{ id: 'f1', mock: true }]);
    const plansData = JSON.stringify([{ id: 'p1', mock: true }]);
    
    localStorage.setItem('df_dental_findings', findingsData);
    localStorage.setItem('df_treatment_plans', plansData);

    await getPatientMedicalSummary('patient_1');

    expect(localStorage.getItem('df_dental_findings')).toBe(findingsData);
    expect(localStorage.getItem('df_treatment_plans')).toBe(plansData);
  });
});
