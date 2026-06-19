import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ACTIVE_CLINIC_REQUIRED_FOR_ENCOUNTER_VISIT_ERROR,
  MAX_ENCOUNTER_VISIT_LIMIT,
  RECORD_ID_REQUIRED_FOR_ENCOUNTER_VISIT_ERROR,
  PATIENT_REQUIRED_FOR_CLINICAL_WORKFLOW_ERROR,
  SupabaseEncounterVisitRepository,
  createEncounterVisitRepository,
  mapClinicalEncounterRow,
  mapCompletedServiceRow,
  mapPatientVisitRow,
  normalizeEncounterVisitLimit,
  normalizeEncounterVisitOffset,
  type EncounterVisitRepository,
} from './EncounterVisitRepository';

type QueryResult = {
  data: Record<string, unknown>[] | null;
  error: Error | null;
};

type SingleQueryResult = {
  data: Record<string, unknown> | null;
  error: Error | null;
};

type QueryCall = {
  method: string;
  args: unknown[];
};

function createRepository(result: QueryResult, singleResult: SingleQueryResult = { data: null, error: null }) {
  const calls: QueryCall[] = [];
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    maybeSingle: vi.fn(),
  };

  chain.select.mockImplementation((...args: unknown[]) => {
    calls.push({ method: 'select', args });
    return chain;
  });
  chain.eq.mockImplementation((...args: unknown[]) => {
    calls.push({ method: 'eq', args });
    return chain;
  });
  chain.neq.mockImplementation((...args: unknown[]) => {
    calls.push({ method: 'neq', args });
    return chain;
  });
  chain.in.mockImplementation((...args: unknown[]) => {
    calls.push({ method: 'in', args });
    return chain;
  });
  chain.gte.mockImplementation((...args: unknown[]) => {
    calls.push({ method: 'gte', args });
    return chain;
  });
  chain.lte.mockImplementation((...args: unknown[]) => {
    calls.push({ method: 'lte', args });
    return chain;
  });
  chain.order.mockImplementation((...args: unknown[]) => {
    calls.push({ method: 'order', args });
    return chain;
  });
  chain.range.mockImplementation(async (...args: unknown[]) => {
    calls.push({ method: 'range', args });
    return result;
  });
  chain.maybeSingle.mockImplementation(async (...args: unknown[]) => {
    calls.push({ method: 'maybeSingle', args });
    return singleResult;
  });

  const client = {
    from: vi.fn((tableName: string) => {
      calls.push({ method: 'from', args: [tableName] });
      return chain;
    }),
  };
  const repository = new SupabaseEncounterVisitRepository(client as unknown as SupabaseClient);
  return { repository, client, calls };
}

function expectCall(calls: QueryCall[], method: string, ...args: unknown[]) {
  expect(calls).toContainEqual({ method, args });
}

const tenantId = '11111111-1111-1111-1111-111111111111';
const patientId = '22222222-2222-2222-2222-222222222222';
const visitId = '33333333-3333-3333-3333-333333333333';
const encounterId = '44444444-4444-4444-4444-444444444444';
const doctorUserId = '55555555-5555-5555-5555-555555555555';

const visitRow = {
  id: visitId,
  tenant_id: tenantId,
  patient_id: patientId,
  appointment_id: 'appointment-1',
  status: 'checked_in',
  visit_type: 'regular',
  arrived_at: '2026-06-19T08:00:00Z',
  checked_in_at: '2026-06-19T08:05:00Z',
  started_at: null,
  completed_at: null,
  cancelled_at: null,
  archived_at: null,
  created_by: 'admin-1',
  updated_by: 'admin-2',
  archived_by: null,
  notes: 'Patient arrived',
  metadata: { smoke: true },
  created_at: '2026-06-19T08:00:01Z',
  updated_at: '2026-06-19T08:00:02Z',
};

const encounterRow = {
  id: encounterId,
  tenant_id: tenantId,
  patient_id: patientId,
  visit_id: visitId,
  appointment_id: 'appointment-1',
  doctor_user_id: doctorUserId,
  status: 'in_progress',
  encounter_type: 'treatment',
  started_at: '2026-06-19T08:15:00Z',
  completed_at: null,
  locked_at: null,
  archived_at: null,
  created_by: 'doctor-1',
  updated_by: 'doctor-1',
  locked_by: null,
  archived_by: null,
  chief_complaint_snapshot: 'Pain',
  clinical_summary: 'Clinical summary',
  correction_reason: null,
  metadata: { clinical: true },
  created_at: '2026-06-19T08:15:01Z',
  updated_at: '2026-06-19T08:15:02Z',
};

const serviceRow = {
  id: '66666666-6666-6666-6666-666666666666',
  tenant_id: tenantId,
  patient_id: patientId,
  visit_id: visitId,
  encounter_id: encounterId,
  appointment_id: 'appointment-1',
  finding_id: '77777777-7777-7777-7777-777777777777',
  treatment_plan_id: '88888888-8888-8888-8888-888888888888',
  treatment_stage_id: '99999999-9999-9999-9999-999999999999',
  clinical_dictionary_item_id: 'service.cleaning',
  service_code: 'CLEAN-1',
  service_name: 'Professional cleaning',
  tooth_number: '16',
  tooth_surface: 'occlusal',
  quantity: '2.50',
  unit_price: '1000.25',
  total_amount: '2500.50',
  currency: 'KZT',
  performed_by: doctorUserId,
  performed_at: '2026-06-19T09:00:00Z',
  status: 'completed',
  correction_of_id: null,
  correction_reason: null,
  voided_at: null,
  voided_by: null,
  archived_at: null,
  archived_by: null,
  created_by: 'doctor-1',
  updated_by: 'doctor-1',
  metadata: { service: true },
  created_at: '2026-06-19T09:00:01Z',
  updated_at: '2026-06-19T09:00:02Z',
};

describe('EncounterVisitRepository', () => {
  it('list methods require tenantId', async () => {
    const { repository } = createRepository({ data: [], error: null });

    await expect(repository.listPatientVisits({ tenantId: '' })).rejects.toThrow(ACTIVE_CLINIC_REQUIRED_FOR_ENCOUNTER_VISIT_ERROR);
    await expect(repository.listClinicalEncounters({ tenantId: '' })).rejects.toThrow(ACTIVE_CLINIC_REQUIRED_FOR_ENCOUNTER_VISIT_ERROR);
    await expect(repository.listCompletedServices({ tenantId: '' })).rejects.toThrow(ACTIVE_CLINIC_REQUIRED_FOR_ENCOUNTER_VISIT_ERROR);
  });

  it('get-by-id methods require tenantId and id', async () => {
    const { repository } = createRepository({ data: [], error: null });

    await expect(repository.getPatientVisitById({ tenantId: '', id: visitId })).rejects.toThrow(ACTIVE_CLINIC_REQUIRED_FOR_ENCOUNTER_VISIT_ERROR);
    await expect(repository.getClinicalEncounterById({ tenantId, id: '' })).rejects.toThrow(RECORD_ID_REQUIRED_FOR_ENCOUNTER_VISIT_ERROR);
    await expect(repository.getCompletedServiceById({ tenantId, id: '' })).rejects.toThrow(RECORD_ID_REQUIRED_FOR_ENCOUNTER_VISIT_ERROR);
  });

  it('listPatientClinicalWorkflow requires tenantId and patientId', async () => {
    const { repository } = createRepository({ data: [], error: null });

    await expect(repository.listPatientClinicalWorkflow({ tenantId: '', patientId })).rejects.toThrow(ACTIVE_CLINIC_REQUIRED_FOR_ENCOUNTER_VISIT_ERROR);
    await expect(repository.listPatientClinicalWorkflow({ tenantId, patientId: '' })).rejects.toThrow(PATIENT_REQUIRED_FOR_CLINICAL_WORKFLOW_ERROR);
  });

  it('listPatientVisits queries patient_visits with tenant and optional filters', async () => {
    const { repository, client, calls } = createRepository({ data: [visitRow], error: null });

    const visits = await repository.listPatientVisits({
      tenantId,
      patientId,
      appointmentId: 'appointment-1',
      statuses: ['checked_in', 'in_progress'],
      visitTypes: ['regular', 'emergency'],
      arrivedFrom: '2026-06-01T00:00:00Z',
      arrivedTo: '2026-06-30T00:00:00Z',
      limit: 500,
      offset: 5,
    });

    expect(client.from).toHaveBeenCalledWith('patient_visits');
    expectCall(calls, 'select', '*');
    expectCall(calls, 'eq', 'tenant_id', tenantId);
    expectCall(calls, 'eq', 'patient_id', patientId);
    expectCall(calls, 'eq', 'appointment_id', 'appointment-1');
    expectCall(calls, 'in', 'status', ['checked_in', 'in_progress']);
    expectCall(calls, 'in', 'visit_type', ['regular', 'emergency']);
    expectCall(calls, 'neq', 'status', 'archived');
    expectCall(calls, 'gte', 'arrived_at', '2026-06-01T00:00:00Z');
    expectCall(calls, 'lte', 'arrived_at', '2026-06-30T00:00:00Z');
    expectCall(calls, 'order', 'arrived_at', { ascending: false });
    expectCall(calls, 'order', 'created_at', { ascending: false });
    expectCall(calls, 'range', 5, 204);
    expect(visits[0]).toMatchObject({ id: visitId, tenantId, patientId, visitType: 'regular', metadata: { smoke: true } });
  });

  it('listPatientVisits includes archived only when requested', async () => {
    const active = createRepository({ data: [], error: null });
    await active.repository.listPatientVisits({ tenantId });
    expectCall(active.calls, 'neq', 'status', 'archived');

    const archived = createRepository({ data: [], error: null });
    await archived.repository.listPatientVisits({ tenantId, includeArchived: true });
    expect(archived.calls).not.toContainEqual({ method: 'neq', args: ['status', 'archived'] });
  });

  it('getPatientVisitById filters by tenant_id and id and returns null when missing', async () => {
    const found = createRepository({ data: [], error: null }, { data: visitRow, error: null });
    await expect(found.repository.getPatientVisitById({ tenantId, id: visitId })).resolves.toMatchObject({ id: visitId, tenantId });
    expectCall(found.calls, 'eq', 'tenant_id', tenantId);
    expectCall(found.calls, 'eq', 'id', visitId);
    expectCall(found.calls, 'maybeSingle');

    const missing = createRepository({ data: [], error: null }, { data: null, error: null });
    await expect(missing.repository.getPatientVisitById({ tenantId, id: visitId })).resolves.toBeNull();
  });

  it('listClinicalEncounters queries clinical_encounters with tenant and optional filters', async () => {
    const { repository, client, calls } = createRepository({ data: [encounterRow], error: null });

    const encounters = await repository.listClinicalEncounters({
      tenantId,
      patientId,
      visitId,
      appointmentId: 'appointment-1',
      doctorUserId,
      statuses: ['draft', 'in_progress'],
      encounterTypes: ['consultation', 'treatment'],
      createdFrom: '2026-06-01T00:00:00Z',
      createdTo: '2026-06-30T00:00:00Z',
      limit: 10,
      offset: 2,
    });

    expect(client.from).toHaveBeenCalledWith('clinical_encounters');
    expectCall(calls, 'eq', 'tenant_id', tenantId);
    expectCall(calls, 'eq', 'patient_id', patientId);
    expectCall(calls, 'eq', 'visit_id', visitId);
    expectCall(calls, 'eq', 'appointment_id', 'appointment-1');
    expectCall(calls, 'eq', 'doctor_user_id', doctorUserId);
    expectCall(calls, 'in', 'status', ['draft', 'in_progress']);
    expectCall(calls, 'in', 'encounter_type', ['consultation', 'treatment']);
    expectCall(calls, 'neq', 'status', 'archived');
    expectCall(calls, 'gte', 'created_at', '2026-06-01T00:00:00Z');
    expectCall(calls, 'lte', 'created_at', '2026-06-30T00:00:00Z');
    expectCall(calls, 'order', 'created_at', { ascending: false });
    expectCall(calls, 'range', 2, 11);
    expect(encounters[0]).toMatchObject({ id: encounterId, tenantId, patientId, doctorUserId, encounterType: 'treatment' });
  });

  it('listClinicalEncounters includes archived only when requested', async () => {
    const active = createRepository({ data: [], error: null });
    await active.repository.listClinicalEncounters({ tenantId });
    expectCall(active.calls, 'neq', 'status', 'archived');

    const archived = createRepository({ data: [], error: null });
    await archived.repository.listClinicalEncounters({ tenantId, includeArchived: true });
    expect(archived.calls).not.toContainEqual({ method: 'neq', args: ['status', 'archived'] });
  });

  it('getClinicalEncounterById filters by tenant_id and id', async () => {
    const { repository, calls } = createRepository({ data: [], error: null }, { data: encounterRow, error: null });
    await expect(repository.getClinicalEncounterById({ tenantId, id: encounterId })).resolves.toMatchObject({ id: encounterId, tenantId });
    expectCall(calls, 'from', 'clinical_encounters');
    expectCall(calls, 'eq', 'tenant_id', tenantId);
    expectCall(calls, 'eq', 'id', encounterId);
    expectCall(calls, 'maybeSingle');
  });

  it('listCompletedServices queries completed_services with tenant and optional filters', async () => {
    const { repository, client, calls } = createRepository({ data: [serviceRow], error: null });

    const services = await repository.listCompletedServices({
      tenantId,
      patientId,
      visitId,
      encounterId,
      appointmentId: 'appointment-1',
      findingId: '77777777-7777-7777-7777-777777777777',
      treatmentPlanId: '88888888-8888-8888-8888-888888888888',
      treatmentStageId: '99999999-9999-9999-9999-999999999999',
      clinicalDictionaryItemId: 'service.cleaning',
      performedBy: doctorUserId,
      statuses: ['completed', 'corrected'],
      performedFrom: '2026-06-01T00:00:00Z',
      performedTo: '2026-06-30T00:00:00Z',
      limit: 20,
      offset: 3,
    });

    expect(client.from).toHaveBeenCalledWith('completed_services');
    expectCall(calls, 'eq', 'tenant_id', tenantId);
    expectCall(calls, 'eq', 'patient_id', patientId);
    expectCall(calls, 'eq', 'visit_id', visitId);
    expectCall(calls, 'eq', 'encounter_id', encounterId);
    expectCall(calls, 'eq', 'appointment_id', 'appointment-1');
    expectCall(calls, 'eq', 'finding_id', '77777777-7777-7777-7777-777777777777');
    expectCall(calls, 'eq', 'treatment_plan_id', '88888888-8888-8888-8888-888888888888');
    expectCall(calls, 'eq', 'treatment_stage_id', '99999999-9999-9999-9999-999999999999');
    expectCall(calls, 'eq', 'clinical_dictionary_item_id', 'service.cleaning');
    expectCall(calls, 'eq', 'performed_by', doctorUserId);
    expectCall(calls, 'in', 'status', ['completed', 'corrected']);
    expectCall(calls, 'neq', 'status', 'archived');
    expectCall(calls, 'neq', 'status', 'voided');
    expectCall(calls, 'gte', 'performed_at', '2026-06-01T00:00:00Z');
    expectCall(calls, 'lte', 'performed_at', '2026-06-30T00:00:00Z');
    expectCall(calls, 'order', 'performed_at', { ascending: false });
    expectCall(calls, 'order', 'created_at', { ascending: false });
    expectCall(calls, 'range', 3, 22);
    expect(services[0]).toMatchObject({ id: serviceRow.id, tenantId, patientId, quantity: 2.5, unitPrice: 1000.25, totalAmount: 2500.5 });
  });

  it('listCompletedServices includes archived and voided only when requested', async () => {
    const active = createRepository({ data: [], error: null });
    await active.repository.listCompletedServices({ tenantId });
    expectCall(active.calls, 'neq', 'status', 'archived');
    expectCall(active.calls, 'neq', 'status', 'voided');

    const all = createRepository({ data: [], error: null });
    await all.repository.listCompletedServices({ tenantId, includeArchived: true, includeVoided: true });
    expect(all.calls).not.toContainEqual({ method: 'neq', args: ['status', 'archived'] });
    expect(all.calls).not.toContainEqual({ method: 'neq', args: ['status', 'voided'] });
  });

  it('getCompletedServiceById filters by tenant_id and id', async () => {
    const { repository, calls } = createRepository({ data: [], error: null }, { data: serviceRow, error: null });
    await expect(repository.getCompletedServiceById({ tenantId, id: String(serviceRow.id) })).resolves.toMatchObject({ id: serviceRow.id, serviceName: 'Professional cleaning' });
    expectCall(calls, 'from', 'completed_services');
    expectCall(calls, 'eq', 'tenant_id', tenantId);
    expectCall(calls, 'eq', 'id', serviceRow.id);
    expectCall(calls, 'maybeSingle');
  });

  it('listPatientClinicalWorkflow calls all three read lists with the same tenantId and patientId', async () => {
    const { repository, calls } = createRepository({ data: [], error: null });
    const workflow = await repository.listPatientClinicalWorkflow({ tenantId, patientId, includeArchived: true, limit: 5, offset: 1 });

    expect(workflow).toEqual({ visits: [], encounters: [], completedServices: [] });
    expectCall(calls, 'from', 'patient_visits');
    expectCall(calls, 'from', 'clinical_encounters');
    expectCall(calls, 'from', 'completed_services');
    expect(calls.filter(call => call.method === 'eq' && call.args[0] === 'tenant_id' && call.args[1] === tenantId)).toHaveLength(3);
    expect(calls.filter(call => call.method === 'eq' && call.args[0] === 'patient_id' && call.args[1] === patientId)).toHaveLength(3);
  });

  it('surfaces Supabase errors without hiding partial workflow failures', async () => {
    const error = new Error('RLS denied');
    const { repository } = createRepository({ data: null, error });

    await expect(repository.listCompletedServices({ tenantId })).rejects.toThrow('RLS denied');
    await expect(repository.listPatientClinicalWorkflow({ tenantId, patientId })).rejects.toThrow('RLS denied');
  });

  it('mappers convert snake_case rows to camelCase and default metadata', () => {
    const visit = mapPatientVisitRow({ ...visitRow, metadata: null });
    expect(visit).toMatchObject({ appointmentId: 'appointment-1', visitType: 'regular', checkedInAt: '2026-06-19T08:05:00Z', metadata: {} });

    const encounter = mapClinicalEncounterRow({ ...encounterRow, metadata: undefined });
    expect(encounter).toMatchObject({ visitId, doctorUserId, chiefComplaintSnapshot: 'Pain', clinicalSummary: 'Clinical summary', metadata: {} });

    const service = mapCompletedServiceRow({ ...serviceRow, quantity: '1.25', unit_price: '200.10', total_amount: '250.125', metadata: [] });
    expect(service).toMatchObject({ clinicalDictionaryItemId: 'service.cleaning', serviceName: 'Professional cleaning', quantity: 1.25, unitPrice: 200.1, totalAmount: 250.125, metadata: {} });
  });

  it('mappers reject missing required fields and invalid numbers instead of silently coercing', () => {
    expect(() => mapPatientVisitRow({ ...visitRow, id: null })).toThrow('missing required field: id');
    expect(() => mapCompletedServiceRow({ ...serviceRow, quantity: 'not-a-number' })).toThrow('invalid numeric field: quantity');
  });

  it('normalizes limit and offset safely', () => {
    expect(normalizeEncounterVisitLimit()).toBe(50);
    expect(normalizeEncounterVisitLimit(0)).toBe(1);
    expect(normalizeEncounterVisitLimit(999)).toBe(MAX_ENCOUNTER_VISIT_LIMIT);
    expect(normalizeEncounterVisitOffset()).toBe(0);
    expect(normalizeEncounterVisitOffset(-5)).toBe(0);
    expect(normalizeEncounterVisitOffset(2.9)).toBe(2);
  });

  it('factory creates only Supabase read repository and rejects local backend', () => {
    const client = { from: vi.fn() } as unknown as SupabaseClient;
    const repository: EncounterVisitRepository = createEncounterVisitRepository({ backend: 'supabase', client });

    expect(repository).toBeInstanceOf(SupabaseEncounterVisitRepository);
    expect(() => createEncounterVisitRepository({ backend: 'local' })).toThrow('requires Supabase backend');
    expect('createPatientVisit' in repository).toBe(false);
    expect('updatePatientVisit' in repository).toBe(false);
    expect('deletePatientVisit' in repository).toBe(false);
    expect('createClinicalEncounter' in repository).toBe(false);
    expect('createCompletedService' in repository).toBe(false);
    expect('voidCompletedService' in repository).toBe(false);
  });
});
