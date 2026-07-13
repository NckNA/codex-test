import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import repositorySource from './CommunicationOrchestrationRepository.ts?raw';
import {
  CommunicationOrchestrationRepositoryError,
  SupabaseCommunicationOrchestrationRepository,
  mapCommunicationOperation,
  mapCommunicationRoute,
  toSafeCommunicationRepositoryError,
} from './CommunicationOrchestrationRepository';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

const tenantId = '11111111-1111-4111-8111-111111111111';
const operationId = '22222222-2222-4222-8222-222222222222';

const routeRow = {
  id: 'route-a',
  tenant_id: tenantId,
  channel: 'sms',
  adapter_code: 'mock',
  enabled: true,
  simulation_only: true,
  priority: 10,
  configuration_version: 2,
  created_at: '2026-07-13T00:00:00Z',
  updated_at: '2026-07-13T01:00:00Z',
  archived_at: null,
};

const operationRow = {
  id: operationId,
  tenant_id: tenantId,
  reminder_job_id: 'job-a',
  appointment_id: 'appointment-a',
  patient_id: 'patient-a',
  contact_id: 'contact-a',
  purpose_code: 'appointment_confirmation_request',
  channel: 'sms',
  language: 'ru',
  state: 'prepared',
  operation_key: 'prepare-operation-a',
  payload_fingerprint: 'a'.repeat(64),
  appointment_updated_at: '2026-07-13T00:00:00Z',
  reminder_job_updated_at: '2026-07-13T00:00:00Z',
  contact_updated_at: '2026-07-13T00:00:00Z',
  policy_version: 1,
  eligibility_version: 1,
  route_id: 'route-a',
  route_version: 2,
  adapter_code: 'mock',
  external_operation_id: null,
  adapter_result_code: null,
  retryable: null,
  uncertain: false,
  safe_error_code: null,
  prepared_at: '2026-07-13T02:00:00Z',
  executed_at: null,
  recovered_at: null,
  cancelled_at: null,
  updated_at: '2026-07-13T02:00:00Z',
  eligibility_snapshot: { eligible: true },
  consent_snapshot: { state: 'granted' },
  suppression_snapshot: { global: false, channel: false },
  contact_snapshot: { maskedDestination: '+7700***4567', destinationFingerprint: 'b'.repeat(64) },
  appointment_snapshot: { appointmentDate: '2026-07-14' },
  route_snapshot: { simulationOnly: true },
  command: {
    tenantId,
    operationId,
    reminderJobId: 'job-a',
    appointmentId: 'appointment-a',
    patientId: 'patient-a',
    contactId: 'contact-a',
    purposeCode: 'appointment_confirmation_request',
    channel: 'sms',
    language: 'ru',
    maskedDestination: '+7700***4567',
    destinationFingerprint: 'b'.repeat(64),
    operationKey: 'prepare-operation-a',
    variables: { patient_first_name: 'Анна' },
    requestedAt: '2026-07-13T02:00:00Z',
  },
  metadata: { simulationOnly: true },
};

const query = (result: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> & PromiseLike<typeof result> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
};

describe('CommunicationOrchestrationRepository', () => {
  it('maps safe route and operation snapshots', () => {
    expect(mapCommunicationRoute(routeRow)).toMatchObject({
      tenantId,
      adapterCode: 'mock',
      configurationVersion: 2,
      simulationOnly: true,
    });
    expect(mapCommunicationOperation(operationRow)).toMatchObject({
      id: operationId,
      reminderJobId: 'job-a',
      state: 'prepared',
      uncertain: false,
      contactSnapshot: { maskedDestination: '+7700***4567' },
    });
  });

  it('lists tenant-scoped route metadata through RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [routeRow], error: null });
    const repository = new SupabaseCommunicationOrchestrationRepository(
      tenantId,
      { rpc, from: vi.fn() } as unknown as SupabaseClient,
    );
    await expect(repository.listCommunicationRoutes()).resolves.toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith('list_communication_routes', { p_tenant_id: tenantId });
  });

  it('lists tenant-scoped operations with deterministic ordering', async () => {
    const operationQuery = query({ data: [operationRow], error: null });
    const from = vi.fn(() => operationQuery);
    const repository = new SupabaseCommunicationOrchestrationRepository(
      tenantId,
      { rpc: vi.fn(), from } as unknown as SupabaseClient,
    );
    const operations = await repository.listCommunicationOperations();
    expect(from).toHaveBeenCalledWith('communication_operations');
    expect(operationQuery.eq).toHaveBeenCalledWith('tenant_id', tenantId);
    expect(operationQuery.order).toHaveBeenCalledWith('prepared_at', { ascending: false });
    expect(operations[0].command.variables).toEqual({ patient_first_name: 'Анна' });
  });

  it('calls route, preparation, simulation and recovery RPCs', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { route: routeRow, changed: true, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { operation: operationRow, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { operation: { ...operationRow, state: 'simulation_succeeded', adapter_result_code: 'accepted', executed_at: '2026-07-13T03:00:00Z' }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { operation: { ...operationRow, state: 'simulation_uncertain', uncertain: true }, replayed: true, recoveryOnly: true }, error: null });
    const repository = new SupabaseCommunicationOrchestrationRepository(
      tenantId,
      { rpc, from: vi.fn() } as unknown as SupabaseClient,
    );

    await repository.upsertCommunicationRoute({
      channel: 'sms',
      adapterCode: 'mock',
      enabled: true,
      priority: 10,
      operationKey: 'route-operation-a',
    });
    await repository.prepareCommunicationOperation({
      reminderJobId: 'job-a',
      channel: 'sms',
      operationKey: 'prepare-operation-a',
      expectedJobUpdatedAt: 'job-version',
      expectedAppointmentUpdatedAt: 'appointment-version',
    });
    await repository.simulateCommunicationOperation({
      operationId,
      scenario: 'success',
      operationKey: 'simulate-operation-a',
      expectedUpdatedAt: 'operation-version',
    });
    await repository.recoverCommunicationOperation(operationId, 'recover-operation-a');

    expect(rpc).toHaveBeenNthCalledWith(1, 'create_or_update_communication_route', expect.objectContaining({
      p_tenant_id: tenantId,
      p_adapter_code: 'mock',
    }));
    expect(rpc).toHaveBeenNthCalledWith(2, 'prepare_communication_operation', expect.objectContaining({
      p_reminder_job_id: 'job-a',
      p_channel: 'sms',
    }));
    expect(rpc).toHaveBeenNthCalledWith(3, 'simulate_communication_operation', expect.objectContaining({
      p_scenario: 'success',
    }));
    expect(rpc).toHaveBeenNthCalledWith(4, 'recover_communication_operation', expect.objectContaining({
      p_operation_id: operationId,
    }));
  });

  it('maps provider errors to safe user messages', () => {
    expect(toSafeCommunicationRepositoryError({ message: 'permission denied 42501' })).toMatchObject({ code: 'permission' });
    expect(toSafeCommunicationRepositoryError({ message: 'Для этого канала не настроен тестовый маршрут.' })).toMatchObject({ code: 'no_route' });
    expect(toSafeCommunicationRepositoryError({ message: 'Контакт или согласие больше не позволяют подготовить коммуникацию.' })).toMatchObject({ code: 'not_eligible' });
    expect(toSafeCommunicationRepositoryError({ message: '40001 conflict' })).toMatchObject({ code: 'stale' });
    expect(toSafeCommunicationRepositoryError({ message: '23505 duplicate' })).toMatchObject({ code: 'conflict' });
    expect(toSafeCommunicationRepositoryError({ message: 'secret constraint raw provider body' }))
      .toEqual(new CommunicationOrchestrationRepositoryError('operation_failed'));
  });

  it('contains no direct write or external provider path', () => {
    expect(repositorySource).not.toMatch(/\.insert\s*\(/);
    expect(repositorySource).not.toMatch(/\.update\s*\(/);
    expect(repositorySource).not.toMatch(/\.delete\s*\(/);
    expect(repositorySource).not.toMatch(/service[_-]?role/i);
    expect(repositorySource).not.toMatch(/fetch\s*\(|axios|twilio|smtp|amocrm|whatsapp.*api/i);
    expect(repositorySource).not.toContain('contact_value_raw');
    expect(repositorySource).not.toContain('contact_value_normalized');
  });
});
