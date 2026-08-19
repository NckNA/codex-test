import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  LaboratoryWorkMutationClientError,
  SupabaseLaboratoryWorkMutationRpcClient,
  classifyLaboratoryMutationError,
  createLaboratoryWorkMutationRpcClient,
  type LaboratoryWorkOrderDesiredState,
} from './LaboratoryWorkMutationRpcClient';

const tenantId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const patientId = '33333333-3333-4333-8333-333333333333';
const doctorId = '44444444-4444-4444-8444-444444444444';
const laboratoryId = '55555555-5555-4555-8555-555555555555';
const typeA = '66666666-6666-4666-8666-666666666666';
const typeB = '77777777-7777-4777-8777-777777777777';

const dbOrder = {
  id: orderId,
  tenant_id: tenantId,
  patient_id: patientId,
  responsible_doctor_id: doctorId,
  laboratory_id: laboratoryId,
  order_number: 'LAB-42',
  title: 'Crown',
  status: 'in_progress',
  sent_to_lab_at: null,
  planned_ready_at: '2026-08-30T12:00:00+05:00',
  received_from_lab_at: null,
  try_in_at: null,
  delivered_to_patient_at: null,
  shade: 'A2',
  anatomical_scope: 'selected_teeth',
  selected_teeth: [11, 12],
  comment: 'Internal note',
  created_by: null,
  updated_by: null,
  mutation_version: 4,
  created_at: '2026-08-19T08:00:00Z',
  updated_at: '2026-08-19T08:10:00Z',
};

const desired: LaboratoryWorkOrderDesiredState = {
  responsibleDoctorId: doctorId,
  laboratoryId,
  orderNumber: ' LAB-42 ',
  title: ' Crown ',
  sentToLabAt: null,
  plannedReadyAt: '2026-08-30T12:00:00+05:00',
  receivedFromLabAt: null,
  tryInAt: null,
  deliveredToPatientAt: null,
  shade: ' A2 ',
  anatomicalScope: 'selected_teeth',
  selectedTeeth: [12, 11, 11],
  comment: ' Internal note ',
  workTypeIds: [typeB, typeA, typeA],
};

function mockClient(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn(async () => result);
  const from = vi.fn(() => {
    throw new Error('Direct table access is forbidden in the mutation client');
  });
  const client = { rpc, from } as unknown as SupabaseClient;
  return { client, rpc, from, mutationClient: new SupabaseLaboratoryWorkMutationRpcClient(client) };
}

describe('LaboratoryWorkMutationRpcClient', () => {
  it('maps atomic create parameters, normalizes sets, and maps mutation_version', async () => {
    const { mutationClient, rpc, from } = mockClient({ data: dbOrder, error: null });

    const result = await mutationClient.createOrder({
      tenantId,
      orderId,
      patientId,
      requestId: 'req-create-1',
      ...desired,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('create_laboratory_work_order_atomic', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_patient_id: patientId,
      p_title: 'Crown',
      p_work_type_ids: [typeA, typeB],
      p_responsible_doctor_id: doctorId,
      p_laboratory_id: laboratoryId,
      p_order_number: 'LAB-42',
      p_sent_to_lab_at: null,
      p_planned_ready_at: '2026-08-30T12:00:00+05:00',
      p_received_from_lab_at: null,
      p_try_in_at: null,
      p_delivered_to_patient_at: null,
      p_shade: 'A2',
      p_anatomical_scope: 'selected_teeth',
      p_selected_teeth: [11, 12],
      p_comment: 'Internal note',
      p_request_id: 'req-create-1',
    });
    expect(result.mutationVersion).toBe(4);
    expect(result.id).toBe(orderId);
    expect(from).not.toHaveBeenCalled();
  });

  it('maps full desired-state update with expected mutation version', async () => {
    const { mutationClient, rpc } = mockClient({ data: [{ ...dbOrder, mutation_version: 5 }], error: null });

    const result = await mutationClient.updateOrder({
      tenantId,
      orderId,
      expectedVersion: 4,
      requestId: 'req-update-1',
      ...desired,
    });

    expect(rpc).toHaveBeenCalledWith('update_laboratory_work_order_atomic', expect.objectContaining({
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_expected_version: 4,
      p_work_type_ids: [typeA, typeB],
      p_request_id: 'req-update-1',
    }));
    expect(result.mutationVersion).toBe(5);
  });

  it('maps complete and reopen as explicit lifecycle RPCs', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { ...dbOrder, status: 'completed', mutation_version: 5 }, error: null })
      .mockResolvedValueOnce({ data: { ...dbOrder, status: 'in_progress', mutation_version: 6 }, error: null });
    const client = new SupabaseLaboratoryWorkMutationRpcClient({ rpc } as unknown as SupabaseClient);

    await client.completeOrder({ tenantId, orderId, expectedVersion: 4, requestId: 'req-complete' });
    await client.reopenOrder({ tenantId, orderId, expectedVersion: 5, reason: ' Correction ', requestId: 'req-reopen' });

    expect(rpc).toHaveBeenNthCalledWith(1, 'complete_laboratory_work_order_atomic', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_expected_version: 4,
      p_request_id: 'req-complete',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'reopen_laboratory_work_order_atomic', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_expected_version: 5,
      p_reason: 'Correction',
      p_request_id: 'req-reopen',
    });
  });

  it.each([
    ['LAB_ORDER_STALE_WRITE', 'stale'],
    ['LAB_ORDER_CREATE_CONFLICT', 'conflict'],
    ['LAB_ORDER_ACCESS_DENIED', 'permission'],
    ['LAB_ORDER_NOT_FOUND', 'not_found'],
    ['LAB_ORDER_EDIT_REQUIRES_IN_PROGRESS', 'invalid_state'],
    ['LAB_ORDER_REFERENCE_UNAVAILABLE', 'validation'],
  ] as const)('classifies %s as %s without exposing raw backend text', async (marker, category) => {
    const raw = { message: `${marker}: SECRET_BACKEND_DETAIL`, code: 'P0001' };
    const error = classifyLaboratoryMutationError(raw, 'update');
    expect(error).toBeInstanceOf(LaboratoryWorkMutationClientError);
    expect(error.category).toBe(category);
    expect(error.code).toBe(marker);
    expect(error.message).not.toContain('SECRET_BACKEND_DETAIL');
  });

  it('treats unknown transport/backend failures as operation_uncertain', async () => {
    const { mutationClient } = mockClient({ data: null, error: { message: 'socket closed after request', code: 'NETWORK' } });
    await expect(mutationClient.completeOrder({ tenantId, orderId, expectedVersion: 4, requestId: 'req' }))
      .rejects.toMatchObject({ category: 'operation_uncertain', operation: 'complete', code: 'NETWORK' });
  });

  it('rejects invalid versions and required fields before calling RPC', async () => {
    const { mutationClient, rpc } = mockClient({ data: dbOrder, error: null });
    await expect(mutationClient.updateOrder({
      tenantId,
      orderId,
      expectedVersion: 0,
      requestId: 'req',
      ...desired,
    })).rejects.toMatchObject({ category: 'validation' });
    await expect(mutationClient.reopenOrder({
      tenantId,
      orderId,
      expectedVersion: 1,
      requestId: 'req',
      reason: '   ',
    })).rejects.toMatchObject({ category: 'validation' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('factory fails closed for local backend and missing Supabase client', () => {
    expect(() => createLaboratoryWorkMutationRpcClient({ backend: 'local' }))
      .toThrow('requires Supabase backend');
    expect(() => createLaboratoryWorkMutationRpcClient({ backend: 'supabase', client: null }))
      .toThrow('not configured');
  });
});
