// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageTreatmentPlansRepository, createTreatmentPlansRepository, SupabaseTreatmentPlansRepository } from './TreatmentPlansRepository';
import type { TreatmentPlan } from '../../types';

describe('TreatmentPlansRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('LocalStorageTreatmentPlansRepository', () => {
    it('listTreatmentPlansByPatient returns only matching patient plans', async () => {
      const plan1: TreatmentPlan = { id: '1', patientId: 'patient_1', title: 'A', status: 'draft', stages: [], totalPrice: 0, createdAt: '', updatedAt: '' };
      const plan2: TreatmentPlan = { id: '2', patientId: 'patient_2', title: 'B', status: 'draft', stages: [], totalPrice: 0, createdAt: '', updatedAt: '' };
      
      localStorage.setItem('df_treatment_plans', JSON.stringify([plan1, plan2]));

      const p1Plans = await LocalStorageTreatmentPlansRepository.listTreatmentPlansByPatient('patient_1');
      expect(p1Plans).toHaveLength(1);
      expect(p1Plans[0].id).toBe('1');
    });

    it('createTreatmentPlan persists plan', async () => {
      const newPlan: TreatmentPlan = { id: '123', patientId: 'patient_1', title: 'New Plan', status: 'draft', stages: [], totalPrice: 100, createdAt: 'now', updatedAt: 'now' };
      
      await LocalStorageTreatmentPlansRepository.createTreatmentPlan('patient_1', newPlan);

      const plans = await LocalStorageTreatmentPlansRepository.listTreatmentPlansByPatient('patient_1');
      expect(plans).toHaveLength(1);
      expect(plans[0].title).toBe('New Plan');
    });

    it('updateTreatmentPlan updates existing plan fields', async () => {
      const plan1: TreatmentPlan = { id: '1', patientId: 'patient_1', title: 'A', status: 'draft', stages: [], totalPrice: 0, createdAt: 'old', updatedAt: 'old' };
      localStorage.setItem('df_treatment_plans', JSON.stringify([plan1]));

      const updatedPlan = { ...plan1, title: 'Updated Plan', status: 'approved' as const };
      await LocalStorageTreatmentPlansRepository.updateTreatmentPlan('patient_1', updatedPlan);

      const plans = await LocalStorageTreatmentPlansRepository.listTreatmentPlansByPatient('patient_1');
      expect(plans[0].title).toBe('Updated Plan');
      expect(plans[0].status).toBe('approved');
    });

    it('deleteTreatmentPlan removes only the target plan', async () => {
      const plan1: TreatmentPlan = { id: '1', patientId: 'patient_1', title: 'A', status: 'draft', stages: [], totalPrice: 0, createdAt: 'old', updatedAt: 'old' };
      const plan2: TreatmentPlan = { id: '2', patientId: 'patient_1', title: 'B', status: 'draft', stages: [], totalPrice: 0, createdAt: 'old', updatedAt: 'old' };
      localStorage.setItem('df_treatment_plans', JSON.stringify([plan1, plan2]));

      await LocalStorageTreatmentPlansRepository.deleteTreatmentPlan('patient_1', '1');

      const plans = await LocalStorageTreatmentPlansRepository.listTreatmentPlansByPatient('patient_1');
      expect(plans).toHaveLength(1);
      expect(plans[0].id).toBe('2');
    });

    it('does not touch findings or dental charts', async () => {
      localStorage.setItem('df_dental_findings', JSON.stringify([{ id: '1' }]));
      localStorage.setItem('df_dental_charts', JSON.stringify([{ id: '1' }]));

      const plan: TreatmentPlan = { id: '1', patientId: 'patient_1', title: 'A', status: 'draft', stages: [], totalPrice: 0, createdAt: 'old', updatedAt: 'old' };
      
      await LocalStorageTreatmentPlansRepository.createTreatmentPlan('patient_1', plan);
      await LocalStorageTreatmentPlansRepository.updateTreatmentPlan('patient_1', { ...plan, title: 'B' });
      await LocalStorageTreatmentPlansRepository.deleteTreatmentPlan('patient_1', '1');

      // Verify isolations
      expect(localStorage.getItem('df_dental_findings')).toBe(JSON.stringify([{ id: '1' }]));
      expect(localStorage.getItem('df_dental_charts')).toBe(JSON.stringify([{ id: '1' }]));
    });
  });

  describe('createTreatmentPlansRepository Factory', () => {
    it('returns LocalStorage repo when backend is local', () => {
      const repo = createTreatmentPlansRepository({ backend: 'local' });
      expect(repo).toBe(LocalStorageTreatmentPlansRepository);
    });

    it('returns LocalStorage repo when backend is local even if tenantId is provided', () => {
      const repo = createTreatmentPlansRepository({ backend: 'local', tenantId: 'tenant-1' });
      expect(repo).toBe(LocalStorageTreatmentPlansRepository);
    });

    it('returns SupabaseTreatmentPlansRepository when backend is supabase and tenantId is provided', () => {
      const repo = createTreatmentPlansRepository({ backend: 'supabase', tenantId: 'tenant-1' });
      expect(repo).toBeInstanceOf(SupabaseTreatmentPlansRepository);
    });

    it('throws error when backend is supabase but no tenantId is provided', () => {
      expect(() => {
        createTreatmentPlansRepository({ backend: 'supabase' });
      }).toThrow('tenantId is required for SupabaseTreatmentPlansRepository');
    });
  });
});
