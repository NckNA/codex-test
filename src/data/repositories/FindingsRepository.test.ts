// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageFindingsRepository, type CreateFindingInput } from './FindingsRepository';
import type { DentalFinding } from '../../types';

describe('FindingsRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('listFindingsByPatient returns only matching patient findings', async () => {
    const finding1: DentalFinding = { id: '1', patientId: 'patient_1', toothNumber: 11, category: 'caries', title: 'A', severity: 'medium', description: 'a', isChiefComplaintRelated: false, includeInTreatmentPlan: false, status: 'discovered', createdAt: '', updatedAt: '' };
    const finding2: DentalFinding = { id: '2', patientId: 'patient_2', toothNumber: 12, category: 'caries', title: 'B', severity: 'medium', description: 'b', isChiefComplaintRelated: false, includeInTreatmentPlan: false, status: 'discovered', createdAt: '', updatedAt: '' };
    
    localStorage.setItem('df_dental_findings', JSON.stringify([finding1, finding2]));

    const patient1Findings = await LocalStorageFindingsRepository.listFindingsByPatient('patient_1');
    expect(patient1Findings).toHaveLength(1);
    expect(patient1Findings[0].id).toBe('1');
  });

  it('createFinding persists finding with generated id, patientId, createdAt, updatedAt', async () => {
    const findingDraft: CreateFindingInput = {
      toothNumber: 11,
      category: 'caries',
      title: 'Caries',
      description: 'Deep caries',
      severity: 'high',
      isChiefComplaintRelated: false,
      includeInTreatmentPlan: false,
      status: 'discovered'
    };

    await LocalStorageFindingsRepository.createFinding('patient_1', findingDraft);

    const findings = await LocalStorageFindingsRepository.listFindingsByPatient('patient_1');
    expect(findings).toHaveLength(1);
    const saved = findings[0];
    
    expect(saved.patientId).toBe('patient_1');
    expect(typeof saved.id).toBe('string');
    expect(typeof saved.createdAt).toBe('string');
    expect(typeof saved.updatedAt).toBe('string');
    expect(saved.title).toBe('Caries');
    expect(saved.status).toBe('discovered');
  });

  it('updateFinding updates only matching patient/finding', async () => {
    const finding1: DentalFinding = { id: '1', patientId: 'patient_1', toothNumber: 11, category: 'caries', title: 'A', severity: 'medium', description: 'a', isChiefComplaintRelated: false, includeInTreatmentPlan: false, status: 'discovered', createdAt: 'old', updatedAt: 'old' };
    const finding2: DentalFinding = { id: '2', patientId: 'patient_2', toothNumber: 12, category: 'caries', title: 'B', severity: 'medium', description: 'b', isChiefComplaintRelated: false, includeInTreatmentPlan: false, status: 'discovered', createdAt: 'old', updatedAt: 'old' };
    
    localStorage.setItem('df_dental_findings', JSON.stringify([finding1, finding2]));

    const updatedFinding = { ...finding1, title: 'Updated Title', status: 'completed' as const };
    await LocalStorageFindingsRepository.updateFinding('patient_1', updatedFinding);

    const p1 = await LocalStorageFindingsRepository.listFindingsByPatient('patient_1');
    expect(p1[0].title).toBe('Updated Title');
    expect(p1[0].status).toBe('completed');
    expect(p1[0].updatedAt).not.toBe('old');

    const p2 = await LocalStorageFindingsRepository.listFindingsByPatient('patient_2');
    expect(p2[0].title).toBe('B');
    expect(p2[0].status).toBe('discovered');
  });

  it('deleteFinding removes only matching finding', async () => {
    const finding1: DentalFinding = { id: '1', patientId: 'patient_1', toothNumber: 11, category: 'caries', title: 'A', severity: 'medium', description: 'a', isChiefComplaintRelated: false, includeInTreatmentPlan: false, status: 'discovered', createdAt: 'old', updatedAt: 'old' };
    const finding2: DentalFinding = { id: '2', patientId: 'patient_1', toothNumber: 12, category: 'caries', title: 'B', severity: 'medium', description: 'b', isChiefComplaintRelated: false, includeInTreatmentPlan: false, status: 'discovered', createdAt: 'old', updatedAt: 'old' };
    
    localStorage.setItem('df_dental_findings', JSON.stringify([finding1, finding2]));

    await LocalStorageFindingsRepository.deleteFinding('patient_1', '1');

    const p1 = await LocalStorageFindingsRepository.listFindingsByPatient('patient_1');
    expect(p1).toHaveLength(1);
    expect(p1[0].id).toBe('2');
  });

  it('does not touch dental charts or treatment plans', async () => {
    localStorage.setItem('df_dental_charts', JSON.stringify([{ id: 'c1' }]));
    localStorage.setItem('df_treatment_plans', JSON.stringify([{ id: 'p1' }]));

    const draft: CreateFindingInput = { toothNumber: 11, category: 'caries', title: 'Caries', severity: 'high', status: 'discovered', description: 'a', isChiefComplaintRelated: false, includeInTreatmentPlan: false };
    await LocalStorageFindingsRepository.createFinding('patient_1', draft);
    
    const findings = await LocalStorageFindingsRepository.listFindingsByPatient('patient_1');
    const findingId = findings[0].id;
    
    await LocalStorageFindingsRepository.updateFinding('patient_1', { ...findings[0], title: 'Updated' });
    await LocalStorageFindingsRepository.deleteFinding('patient_1', findingId);

    // Verify isolations
    expect(localStorage.getItem('df_dental_charts')).toBe(JSON.stringify([{ id: 'c1' }]));
    expect(localStorage.getItem('df_treatment_plans')).toBe(JSON.stringify([{ id: 'p1' }]));
  });
});
