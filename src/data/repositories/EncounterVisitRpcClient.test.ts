import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import {
  createEncounterVisitRpcClient,
  SupabaseEncounterVisitRpcClient,
  type CheckInPatientVisitInput,
  type StartPatientVisitInput,
  type CompletePatientVisitInput,
  type CancelPatientVisitInput,
  type CreateClinicalEncounterInput,
  type StartClinicalEncounterInput,
  type CompleteClinicalEncounterInput,
  type RecordCompletedServiceInput,
  type VoidCompletedServiceInput,
} from './EncounterVisitRpcClient';

// Helper mock creation function
function createClientMock(rpcResult: { data: unknown; error: PostgrestError | Error | null }) {
  const rpcCalls: { rpcName: string; params: unknown }[] = [];
  const client = {
    rpc: vi.fn(async (rpcName: string, params: unknown) => {
      rpcCalls.push({ rpcName, params });
      return rpcResult;
    }),
    from: vi.fn((...args: unknown[]) => {
      void args;
      throw new Error('Direct table writes are forbidden');
    }),
  };
  const rpcClient = new SupabaseEncounterVisitRpcClient(client as unknown as SupabaseClient);
  return { rpcClient, client, rpcCalls };
}

const tenantId = '11111111-1111-1111-1111-111111111111';
const patientId = '22222222-2222-2222-2222-222222222222';
const visitId = '33333333-3333-3333-3333-333333333333';
const encounterId = '44444444-4444-4444-4444-444444444444';
const serviceId = '55555555-5555-5555-5555-555555555555';

// Sample mock db response rows
const dbVisitRow = {
  id: visitId,
  tenant_id: tenantId,
  patient_id: patientId,
  appointment_id: 'app-1',
  status: 'checked_in',
  visit_type: 'regular',
  arrived_at: '2026-06-20T00:00:00Z',
  created_at: '2026-06-20T00:00:01Z',
  updated_at: '2026-06-20T00:00:02Z',
  metadata: { smoke: true },
};

const dbEncounterRow = {
  id: encounterId,
  tenant_id: tenantId,
  patient_id: patientId,
  visit_id: visitId,
  status: 'draft',
  encounter_type: 'consultation',
  created_at: '2026-06-20T00:00:01Z',
  updated_at: '2026-06-20T00:00:02Z',
  metadata: {},
};

const dbServiceRow = {
  id: serviceId,
  tenant_id: tenantId,
  patient_id: patientId,
  service_name: 'Consultation Checkup',
  quantity: 1,
  currency: 'KZT',
  status: 'completed',
  performed_at: '2026-06-20T00:00:00Z',
  created_at: '2026-06-20T00:00:01Z',
  updated_at: '2026-06-20T00:00:02Z',
  metadata: {},
};

describe('EncounterVisitRpcClient Validation & Parameter Mapping', () => {
  describe('Validation - tenantId requirement', () => {
    const invalidInputs = [
      { tenantId: '' },
      { tenantId: '   ' },
      { tenantId: undefined as unknown as string },
      { tenantId: null as unknown as string },
    ];

    it('requires tenantId for checkInPatientVisit', async () => {
      const { rpcClient } = createClientMock({ data: dbVisitRow, error: null });
      for (const input of invalidInputs) {
        await expect(rpcClient.checkInPatientVisit({ ...input, patientId } as unknown as CheckInPatientVisitInput))
          .rejects.toThrow('Active clinic is required for encounter/visit writes.');
      }
    });

    it('requires tenantId for startPatientVisit', async () => {
      const { rpcClient } = createClientMock({ data: dbVisitRow, error: null });
      for (const input of invalidInputs) {
        await expect(rpcClient.startPatientVisit({ ...input, visitId } as unknown as StartPatientVisitInput))
          .rejects.toThrow('Active clinic is required for encounter/visit writes.');
      }
    });

    it('requires tenantId for completePatientVisit', async () => {
      const { rpcClient } = createClientMock({ data: dbVisitRow, error: null });
      for (const input of invalidInputs) {
        await expect(rpcClient.completePatientVisit({ ...input, visitId } as unknown as CompletePatientVisitInput))
          .rejects.toThrow('Active clinic is required for encounter/visit writes.');
      }
    });

    it('requires tenantId for cancelPatientVisit', async () => {
      const { rpcClient } = createClientMock({ data: dbVisitRow, error: null });
      for (const input of invalidInputs) {
        await expect(rpcClient.cancelPatientVisit({ ...input, visitId, reason: 'cancel' } as unknown as CancelPatientVisitInput))
          .rejects.toThrow('Active clinic is required for encounter/visit writes.');
      }
    });

    it('requires tenantId for createClinicalEncounter', async () => {
      const { rpcClient } = createClientMock({ data: dbEncounterRow, error: null });
      for (const input of invalidInputs) {
        await expect(rpcClient.createClinicalEncounter({ ...input, patientId } as unknown as CreateClinicalEncounterInput))
          .rejects.toThrow('Active clinic is required for encounter/visit writes.');
      }
    });

    it('requires tenantId for startClinicalEncounter', async () => {
      const { rpcClient } = createClientMock({ data: dbEncounterRow, error: null });
      for (const input of invalidInputs) {
        await expect(rpcClient.startClinicalEncounter({ ...input, encounterId } as unknown as StartClinicalEncounterInput))
          .rejects.toThrow('Active clinic is required for encounter/visit writes.');
      }
    });

    it('requires tenantId for completeClinicalEncounter', async () => {
      const { rpcClient } = createClientMock({ data: dbEncounterRow, error: null });
      for (const input of invalidInputs) {
        await expect(rpcClient.completeClinicalEncounter({ ...input, encounterId } as unknown as CompleteClinicalEncounterInput))
          .rejects.toThrow('Active clinic is required for encounter/visit writes.');
      }
    });

    it('requires tenantId for recordCompletedService', async () => {
      const { rpcClient } = createClientMock({ data: dbServiceRow, error: null });
      for (const input of invalidInputs) {
        await expect(rpcClient.recordCompletedService({ ...input, patientId, serviceName: 'Test' } as unknown as RecordCompletedServiceInput))
          .rejects.toThrow('Active clinic is required for encounter/visit writes.');
      }
    });

    it('requires tenantId for voidCompletedService', async () => {
      const { rpcClient } = createClientMock({ data: dbServiceRow, error: null });
      for (const input of invalidInputs) {
        await expect(rpcClient.voidCompletedService({ ...input, completedServiceId: serviceId, reason: 'void' } as unknown as VoidCompletedServiceInput))
          .rejects.toThrow('Active clinic is required for encounter/visit writes.');
      }
    });
  });

  describe('Validation - other required parameters', () => {
    it('checkInPatientVisit requires patientId', async () => {
      const { rpcClient } = createClientMock({ data: dbVisitRow, error: null });
      await expect(rpcClient.checkInPatientVisit({ tenantId, patientId: '' } as unknown as CheckInPatientVisitInput))
        .rejects.toThrow('Patient is required to check in a visit.');
      await expect(rpcClient.checkInPatientVisit({ tenantId, patientId: '   ' } as unknown as CheckInPatientVisitInput))
        .rejects.toThrow('Patient is required to check in a visit.');
    });

    it('start/complete/cancel visit require visitId', async () => {
      const { rpcClient } = createClientMock({ data: dbVisitRow, error: null });
      await expect(rpcClient.startPatientVisit({ tenantId, visitId: '' }))
        .rejects.toThrow('Visit id is required.');
      await expect(rpcClient.completePatientVisit({ tenantId, visitId: '  ' }))
        .rejects.toThrow('Visit id is required.');
      await expect(rpcClient.cancelPatientVisit({ tenantId, visitId: '', reason: 'Cancel' }))
        .rejects.toThrow('Visit id is required.');
    });

    it('cancelPatientVisit requires reason', async () => {
      const { rpcClient } = createClientMock({ data: dbVisitRow, error: null });
      await expect(rpcClient.cancelPatientVisit({ tenantId, visitId, reason: '' }))
        .rejects.toThrow('Cancellation reason is required.');
      await expect(rpcClient.cancelPatientVisit({ tenantId, visitId, reason: '  ' }))
        .rejects.toThrow('Cancellation reason is required.');
    });

    it('createClinicalEncounter requires patientId', async () => {
      const { rpcClient } = createClientMock({ data: dbEncounterRow, error: null });
      await expect(rpcClient.createClinicalEncounter({ tenantId, patientId: '' }))
        .rejects.toThrow('Patient is required to create a clinical encounter.');
    });

    it('start/complete encounter require encounterId', async () => {
      const { rpcClient } = createClientMock({ data: dbEncounterRow, error: null });
      await expect(rpcClient.startClinicalEncounter({ tenantId, encounterId: '' }))
        .rejects.toThrow('Encounter id is required.');
      await expect(rpcClient.completeClinicalEncounter({ tenantId, encounterId: '  ' }))
        .rejects.toThrow('Encounter id is required.');
    });

    it('recordCompletedService requires patientId and serviceName', async () => {
      const { rpcClient } = createClientMock({ data: dbServiceRow, error: null });
      await expect(rpcClient.recordCompletedService({ tenantId, patientId: '', serviceName: 'Test' }))
        .rejects.toThrow('Patient is required to record a completed service.');
      await expect(rpcClient.recordCompletedService({ tenantId, patientId, serviceName: '' }))
        .rejects.toThrow('Service name is required.');
    });

    it('recordCompletedService validates quantity, unitPrice and totalAmount', async () => {
      const { rpcClient } = createClientMock({ data: dbServiceRow, error: null });
      await expect(rpcClient.recordCompletedService({ tenantId, patientId, serviceName: 'Test', quantity: 0 }))
        .rejects.toThrow('Service quantity must be greater than 0.');
      await expect(rpcClient.recordCompletedService({ tenantId, patientId, serviceName: 'Test', quantity: -5 }))
        .rejects.toThrow('Service quantity must be greater than 0.');
      await expect(rpcClient.recordCompletedService({ tenantId, patientId, serviceName: 'Test', unitPrice: -10 }))
        .rejects.toThrow('Service amount cannot be negative.');
      await expect(rpcClient.recordCompletedService({ tenantId, patientId, serviceName: 'Test', totalAmount: -10 }))
        .rejects.toThrow('Service amount cannot be negative.');
    });

    it('voidCompletedService requires completedServiceId and reason', async () => {
      const { rpcClient } = createClientMock({ data: dbServiceRow, error: null });
      await expect(rpcClient.voidCompletedService({ tenantId, completedServiceId: '', reason: 'Void' }))
        .rejects.toThrow('Completed service id is required.');
      await expect(rpcClient.voidCompletedService({ tenantId, completedServiceId: serviceId, reason: '' }))
        .rejects.toThrow('Void reason is required.');
    });

    it('rejects invalid metadata types', async () => {
      const { rpcClient } = createClientMock({ data: dbVisitRow, error: null });
      const invalidMetadatas = [
        null,
        'string',
        123,
        [1, 2, 3],
      ];
      for (const meta of invalidMetadatas) {
        await expect(rpcClient.checkInPatientVisit({ tenantId, patientId, metadata: meta as unknown as Record<string, unknown> }))
          .rejects.toThrow('RPC metadata must be a JSON object.');
      }
    });
  });

  describe('RPC Name and Parameter Mapping', () => {
    it('checkInPatientVisit maps to check_in_patient_visit', async () => {
      const { rpcClient, rpcCalls } = createClientMock({ data: [dbVisitRow], error: null });
      const input = {
        tenantId,
        patientId,
        appointmentId: 'app-id',
        visitType: 'consultation' as const,
        arrivedAt: '2026-06-20T00:00:00Z',
        notes: 'Visit notes',
        metadata: { key: 'value' },
      };
      await rpcClient.checkInPatientVisit(input);
      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0].rpcName).toBe('check_in_patient_visit');
      expect(rpcCalls[0].params as Record<string, unknown>).toEqual({
        p_tenant_id: tenantId,
        p_patient_id: patientId,
        p_appointment_id: 'app-id',
        p_visit_type: 'consultation',
        p_arrived_at: '2026-06-20T00:00:00Z',
        p_notes: 'Visit notes',
        p_metadata: { key: 'value' },
      });
    });

    it('startPatientVisit maps to start_patient_visit', async () => {
      const { rpcClient, rpcCalls } = createClientMock({ data: [dbVisitRow], error: null });
      await rpcClient.startPatientVisit({ tenantId, visitId, metadata: { smoke: true } });
      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0].rpcName).toBe('start_patient_visit');
      expect(rpcCalls[0].params as Record<string, unknown>).toEqual({
        p_tenant_id: tenantId,
        p_visit_id: visitId,
        p_metadata: { smoke: true },
      });
    });

    it('completePatientVisit maps to complete_patient_visit', async () => {
      const { rpcClient, rpcCalls } = createClientMock({ data: [dbVisitRow], error: null });
      await rpcClient.completePatientVisit({ tenantId, visitId });
      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0].rpcName).toBe('complete_patient_visit');
      expect(rpcCalls[0].params as Record<string, unknown>).toEqual({
        p_tenant_id: tenantId,
        p_visit_id: visitId,
        p_metadata: {},
      });
    });

    it('cancelPatientVisit maps to cancel_patient_visit', async () => {
      const { rpcClient, rpcCalls } = createClientMock({ data: [dbVisitRow], error: null });
      await rpcClient.cancelPatientVisit({ tenantId, visitId, reason: 'Patient cancelled' });
      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0].rpcName).toBe('cancel_patient_visit');
      expect(rpcCalls[0].params as Record<string, unknown>).toEqual({
        p_tenant_id: tenantId,
        p_visit_id: visitId,
        p_reason: 'Patient cancelled',
        p_metadata: {},
      });
    });

    it('createClinicalEncounter maps to create_clinical_encounter', async () => {
      const { rpcClient, rpcCalls } = createClientMock({ data: [dbEncounterRow], error: null });
      const input = {
        tenantId,
        patientId,
        visitId,
        appointmentId: 'app-id',
        doctorUserId: 'doc-id',
        encounterType: 'treatment' as const,
        chiefComplaintSnapshot: 'Pain in tooth',
        clinicalSummary: 'Treated cavity',
        metadata: { clinical: true },
      };
      await rpcClient.createClinicalEncounter(input);
      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0].rpcName).toBe('create_clinical_encounter');
      expect(rpcCalls[0].params as Record<string, unknown>).toEqual({
        p_tenant_id: tenantId,
        p_patient_id: patientId,
        p_visit_id: visitId,
        p_appointment_id: 'app-id',
        p_doctor_user_id: 'doc-id',
        p_encounter_type: 'treatment',
        p_chief_complaint_snapshot: 'Pain in tooth',
        p_clinical_summary: 'Treated cavity',
        p_metadata: { clinical: true },
      });
    });

    it('startClinicalEncounter maps to start_clinical_encounter', async () => {
      const { rpcClient, rpcCalls } = createClientMock({ data: [dbEncounterRow], error: null });
      await rpcClient.startClinicalEncounter({ tenantId, encounterId });
      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0].rpcName).toBe('start_clinical_encounter');
      expect(rpcCalls[0].params as Record<string, unknown>).toEqual({
        p_tenant_id: tenantId,
        p_encounter_id: encounterId,
        p_metadata: {},
      });
    });

    it('completeClinicalEncounter maps to complete_clinical_encounter', async () => {
      const { rpcClient, rpcCalls } = createClientMock({ data: [dbEncounterRow], error: null });
      await rpcClient.completeClinicalEncounter({ tenantId, encounterId, clinicalSummary: 'Finished session' });
      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0].rpcName).toBe('complete_clinical_encounter');
      expect(rpcCalls[0].params as Record<string, unknown>).toEqual({
        p_tenant_id: tenantId,
        p_encounter_id: encounterId,
        p_clinical_summary: 'Finished session',
        p_metadata: {},
      });
    });

    it('recordCompletedService maps to record_completed_service', async () => {
      const { rpcClient, rpcCalls } = createClientMock({ data: [dbServiceRow], error: null });
      const input = {
        tenantId,
        patientId,
        visitId,
        encounterId,
        appointmentId: 'app-id',
        findingId: 'finding-id',
        treatmentPlanId: 'plan-id',
        treatmentStageId: 'stage-id',
        clinicalDictionaryItemId: 'dict-item-id',
        serviceCode: 'S-001',
        serviceName: 'Consultation Checkup',
        toothNumber: '18',
        toothSurface: 'O',
        quantity: 2,
        unitPrice: 5000,
        totalAmount: 10000,
        currency: 'KZT',
        performedAt: '2026-06-20T00:00:00Z',
        metadata: { price: 5000 },
      };
      await rpcClient.recordCompletedService(input);
      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0].rpcName).toBe('record_completed_service');
      expect(rpcCalls[0].params as Record<string, unknown>).toEqual({
        p_tenant_id: tenantId,
        p_patient_id: patientId,
        p_visit_id: visitId,
        p_encounter_id: encounterId,
        p_appointment_id: 'app-id',
        p_finding_id: 'finding-id',
        p_treatment_plan_id: 'plan-id',
        p_treatment_stage_id: 'stage-id',
        p_clinical_dictionary_item_id: 'dict-item-id',
        p_service_code: 'S-001',
        p_service_name: 'Consultation Checkup',
        p_tooth_number: '18',
        p_tooth_surface: 'O',
        p_quantity: 2,
        p_unit_price: 5000,
        p_total_amount: 10000,
        p_currency: 'KZT',
        p_performed_at: '2026-06-20T00:00:00Z',
        p_metadata: { price: 5000 },
      });
    });

    it('recordCompletedService applies quantity, currency defaults', async () => {
      const { rpcClient, rpcCalls } = createClientMock({ data: [dbServiceRow], error: null });
      await rpcClient.recordCompletedService({ tenantId, patientId, serviceName: 'Tooth Fill' });
      expect(rpcCalls).toHaveLength(1);
      expect((rpcCalls[0].params as Record<string, unknown>).p_quantity).toBe(1);
      expect((rpcCalls[0].params as Record<string, unknown>).p_currency).toBe('KZT');
    });

    it('voidCompletedService maps to void_completed_service', async () => {
      const { rpcClient, rpcCalls } = createClientMock({ data: [dbServiceRow], error: null });
      await rpcClient.voidCompletedService({ tenantId, completedServiceId: serviceId, reason: 'Incorrect entry' });
      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0].rpcName).toBe('void_completed_service');
      expect(rpcCalls[0].params as Record<string, unknown>).toEqual({
        p_tenant_id: tenantId,
        p_completed_service_id: serviceId,
        p_reason: 'Incorrect entry',
        p_metadata: {},
      });
    });
  });

  describe('Response and Error Mapping', () => {
    it('maps db patient visit row to PatientVisit camelCase object', async () => {
      const { rpcClient } = createClientMock({ data: dbVisitRow, error: null });
      const result = await rpcClient.completePatientVisit({ tenantId, visitId });
      expect(result).toEqual({
        id: visitId,
        tenantId,
        patientId,
        appointmentId: 'app-1',
        status: 'checked_in',
        visitType: 'regular',
        arrivedAt: '2026-06-20T00:00:00Z',
        checkedInAt: null,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        archivedAt: null,
        createdBy: null,
        updatedBy: null,
        archivedBy: null,
        notes: null,
        metadata: { smoke: true },
        createdAt: '2026-06-20T00:00:01Z',
        updatedAt: '2026-06-20T00:00:02Z',
      });
    });

    it('maps db clinical encounter row to ClinicalEncounter camelCase object', async () => {
      const { rpcClient } = createClientMock({ data: [dbEncounterRow], error: null });
      const result = await rpcClient.startClinicalEncounter({ tenantId, encounterId });
      expect(result).toEqual({
        id: encounterId,
        tenantId,
        patientId,
        visitId,
        appointmentId: null,
        doctorUserId: null,
        status: 'draft',
        encounterType: 'consultation',
        startedAt: null,
        completedAt: null,
        lockedAt: null,
        archivedAt: null,
        createdBy: null,
        updatedBy: null,
        lockedBy: null,
        archivedBy: null,
        chiefComplaintSnapshot: null,
        clinicalSummary: null,
        correctionReason: null,
        metadata: {},
        createdAt: '2026-06-20T00:00:01Z',
        updatedAt: '2026-06-20T00:00:02Z',
      });
    });

    it('maps db completed service row to CompletedService camelCase object', async () => {
      const { rpcClient } = createClientMock({ data: dbServiceRow, error: null });
      const result = await rpcClient.voidCompletedService({ tenantId, completedServiceId: serviceId, reason: 'Duplicate' });
      expect(result).toEqual({
        id: serviceId,
        tenantId,
        patientId,
        visitId: null,
        encounterId: null,
        appointmentId: null,
        findingId: null,
        treatmentPlanId: null,
        treatmentStageId: null,
        clinicalDictionaryItemId: null,
        serviceCode: null,
        serviceName: 'Consultation Checkup',
        toothNumber: null,
        toothSurface: null,
        quantity: 1,
        unitPrice: null,
        totalAmount: null,
        currency: 'KZT',
        performedBy: null,
        performedAt: '2026-06-20T00:00:00Z',
        status: 'completed',
        correctionOfId: null,
        correctionReason: null,
        voidedAt: null,
        voidedBy: null,
        archivedAt: null,
        archivedBy: null,
        createdBy: null,
        updatedBy: null,
        metadata: {},
        createdAt: '2026-06-20T00:00:01Z',
        updatedAt: '2026-06-20T00:00:02Z',
      });
    });

    it('surfaces Supabase RPC errors directly', async () => {
      const dbError = new Error('Database level validation failed');
      const { rpcClient } = createClientMock({ data: null, error: dbError });
      await expect(rpcClient.completePatientVisit({ tenantId, visitId }))
        .rejects.toThrow('Database level validation failed');
    });

    it('throws clear error when response is null or empty', async () => {
      const { rpcClient } = createClientMock({ data: null, error: null });
      await expect(rpcClient.completePatientVisit({ tenantId, visitId }))
        .rejects.toThrow('Received empty or null response from database RPC.');

      const { rpcClient: rpcClientEmptyArray } = createClientMock({ data: [], error: null });
      await expect(rpcClientEmptyArray.completePatientVisit({ tenantId, visitId }))
        .rejects.toThrow('Received empty or null response from database RPC.');
    });
  });

  describe('Safety & Factory constraints', () => {
    it('throws if trying to make direct database write from the client wrapper', async () => {
      const { client } = createClientMock({ data: [dbVisitRow], error: null });
      expect(() => client.from('patient_visits')).toThrow('Direct table writes are forbidden');
    });

    it('factory rejects local backend option', () => {
      expect(() => createEncounterVisitRpcClient({ backend: 'local' }))
        .toThrow('Encounter/visit RPC client requires Supabase backend.');
    });

    it('factory requires supabase client when configured', () => {
      const testCall = () => {
        createEncounterVisitRpcClient({
          backend: 'supabase',
          client: null as unknown as SupabaseClient,
        });
      };
      expect(testCall).toThrow('Supabase client is not configured for encounter/visit RPC access.');
    });
  });
});
