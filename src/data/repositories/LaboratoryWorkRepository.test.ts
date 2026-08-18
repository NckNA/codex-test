// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_CLINIC_REQUIRED_FOR_LAB_ERROR,
  LocalStorageLaboratoryWorkRepository,
  SupabaseLaboratoryWorkRepository,
  createLaboratoryWorkRepository,
} from './LaboratoryWorkRepository';

function chainResult(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return chain;
}

function orderResolvingChain(result: unknown) {
  const chain = chainResult(result);
  chain.order = vi.fn()
    .mockImplementationOnce(() => chain)
    .mockResolvedValueOnce(result);
  return chain;
}

describe('LaboratoryWorkRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('requires tenantId for direct Supabase construction and falls back to local without tenant in factory', () => {
    const fakeClient = { from: vi.fn() } as never;
    expect(() => new SupabaseLaboratoryWorkRepository(undefined, undefined, fakeClient))
      .toThrow(ACTIVE_CLINIC_REQUIRED_FOR_LAB_ERROR);

    const fallback = createLaboratoryWorkRepository({ backend: 'supabase' });
    expect(fallback).toBeInstanceOf(LocalStorageLaboratoryWorkRepository);
  });

  it('lists laboratories with tenant and active filters only', async () => {
    const chain = orderResolvingChain({
      data: [{
        id: 'lab-1', tenant_id: 'tenant-a', name: 'Lab A', active: true, notes: null,
        created_at: '2026-08-19T00:00:00Z', updated_at: '2026-08-19T00:00:00Z',
      }],
      error: null,
    });
    const from = vi.fn(() => chain);
    const repo = new SupabaseLaboratoryWorkRepository('tenant-a', undefined, { from } as never);

    const result = await repo.listLaboratories();

    expect(from).toHaveBeenCalledWith('laboratories');
    expect(chain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(chain.eq).toHaveBeenCalledWith('active', true);
    expect(result[0]).toMatchObject({ id: 'lab-1', tenantId: 'tenant-a', name: 'Lab A', active: true });
  });

  it('creates laboratory references with repository tenant and normalized optional text', async () => {
    const chain = chainResult({
      data: {
        id: 'lab-1', tenant_id: 'tenant-a', name: 'Lab A', active: true, notes: null,
        created_at: '2026-08-19T00:00:00Z', updated_at: '2026-08-19T00:00:00Z',
      },
      error: null,
    });
    const client = { from: vi.fn(() => chain) } as never;
    const repo = new SupabaseLaboratoryWorkRepository('tenant-a', undefined, client);

    await repo.createLaboratory({ name: '  Lab A  ', notes: '   ' });

    expect(chain.insert).toHaveBeenCalledWith({ tenant_id: 'tenant-a', name: 'Lab A', notes: null });
  });

  it('lists orders with tenant-scoped optional filters and maps operational fields', async () => {
    const chain = orderResolvingChain({
      data: [{
        id: 'order-1', tenant_id: 'tenant-a', patient_id: 'patient-a', responsible_doctor_id: 'doctor-a',
        laboratory_id: 'lab-a', order_number: 'L-001', title: 'Crown', status: 'in_progress',
        sent_to_lab_at: '2026-08-19T04:00:00Z', planned_ready_at: null, received_from_lab_at: null,
        try_in_at: null, delivered_to_patient_at: null, shade: 'A2', anatomical_scope: 'selected_teeth',
        selected_teeth: [11, 12], comment: null, created_by: 'user-a', updated_by: 'user-a',
        created_at: '2026-08-19T00:00:00Z', updated_at: '2026-08-19T00:00:00Z',
      }],
      error: null,
    });
    const from = vi.fn(() => chain);
    const repo = new SupabaseLaboratoryWorkRepository('tenant-a', 'user-a', { from } as never);

    const result = await repo.listOrders({ patientId: 'patient-a', status: 'in_progress', laboratoryId: 'lab-a' });

    expect(from).toHaveBeenCalledWith('laboratory_work_orders');
    expect(chain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(chain.eq).toHaveBeenCalledWith('patient_id', 'patient-a');
    expect(chain.eq).toHaveBeenCalledWith('status', 'in_progress');
    expect(chain.eq).toHaveBeenCalledWith('laboratory_id', 'lab-a');
    expect(result[0]).toMatchObject({
      id: 'order-1', tenantId: 'tenant-a', patientId: 'patient-a', selectedTeeth: [11, 12], shade: 'A2',
    });
  });

  it('creates order with tenant/actor ownership and normalized nullable text', async () => {
    const chain = chainResult({
      data: {
        id: 'order-1', tenant_id: 'tenant-a', patient_id: 'patient-a', responsible_doctor_id: null,
        laboratory_id: null, order_number: null, title: 'Crown', status: 'in_progress', sent_to_lab_at: null,
        planned_ready_at: null, received_from_lab_at: null, try_in_at: null, delivered_to_patient_at: null,
        shade: null, anatomical_scope: 'selected_teeth', selected_teeth: [11], comment: null,
        created_by: 'user-a', updated_by: 'user-a', created_at: '2026-08-19T00:00:00Z', updated_at: '2026-08-19T00:00:00Z',
      },
      error: null,
    });
    const client = { from: vi.fn(() => chain) } as never;
    const repo = new SupabaseLaboratoryWorkRepository('tenant-a', 'user-a', client);

    await repo.createOrder({
      patientId: 'patient-a', title: '  Crown  ', orderNumber: ' ', shade: ' ', anatomicalScope: 'selected_teeth', selectedTeeth: [11],
    });

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant-a',
      patient_id: 'patient-a',
      title: 'Crown',
      order_number: null,
      shade: null,
      selected_teeth: [11],
      created_by: 'user-a',
      updated_by: 'user-a',
    }));
  });

  it('updates orders only after tenant and id filters and never exposes patient/tenant mutation fields', async () => {
    const chain = chainResult({
      data: {
        id: 'order-1', tenant_id: 'tenant-a', patient_id: 'patient-a', responsible_doctor_id: null,
        laboratory_id: null, order_number: null, title: 'Updated', status: 'completed', sent_to_lab_at: null,
        planned_ready_at: null, received_from_lab_at: null, try_in_at: null, delivered_to_patient_at: null,
        shade: null, anatomical_scope: null, selected_teeth: [], comment: null,
        created_by: 'user-a', updated_by: 'user-a', created_at: '2026-08-19T00:00:00Z', updated_at: '2026-08-19T01:00:00Z',
      },
      error: null,
    });
    const client = { from: vi.fn(() => chain) } as never;
    const repo = new SupabaseLaboratoryWorkRepository('tenant-a', 'user-a', client);

    await repo.updateOrder('order-1', { title: ' Updated ', status: 'completed' });

    expect(chain.update).toHaveBeenCalledWith({ title: 'Updated', status: 'completed', updated_by: 'user-a' });
    expect(chain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(chain.eq).toHaveBeenCalledWith('id', 'order-1');
  });

  it('tenant-scopes work-type link reads and writes', async () => {
    const listChain = chainResult({ data: [{ laboratory_work_type_id: 'type-1' }], error: null });
    listChain.order = vi.fn().mockResolvedValue({ data: [{ laboratory_work_type_id: 'type-1' }], error: null });
    const addChain = chainResult({ data: null, error: null });
    addChain.upsert = vi.fn().mockResolvedValue({ error: null });
    const removeChain = chainResult({ data: null, error: null });
    removeChain.eq = vi.fn()
      .mockImplementationOnce(() => removeChain)
      .mockImplementationOnce(() => removeChain)
      .mockResolvedValueOnce({ error: null });

    const from = vi.fn()
      .mockReturnValueOnce(listChain)
      .mockReturnValueOnce(addChain)
      .mockReturnValueOnce(removeChain);
    const repo = new SupabaseLaboratoryWorkRepository('tenant-a', undefined, { from } as never);

    expect(await repo.listOrderWorkTypeIds('order-1')).toEqual(['type-1']);
    await repo.addOrderWorkType('order-1', 'type-1');
    await repo.removeOrderWorkType('order-1', 'type-1');

    expect(listChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(addChain.upsert).toHaveBeenCalledWith({
      tenant_id: 'tenant-a', laboratory_work_order_id: 'order-1', laboratory_work_type_id: 'type-1',
    }, {
      onConflict: 'tenant_id,laboratory_work_order_id,laboratory_work_type_id',
      ignoreDuplicates: true,
    });
    expect(removeChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(removeChain.eq).toHaveBeenCalledWith('laboratory_work_order_id', 'order-1');
    expect(removeChain.eq).toHaveBeenCalledWith('laboratory_work_type_id', 'type-1');
  });

  it('keeps local and Supabase validation aligned for required text and FDI teeth', async () => {
    const local = new LocalStorageLaboratoryWorkRepository('tenant-a');
    await expect(local.createLaboratory({ name: '   ' })).rejects.toThrow('name is required');
    await expect(local.createOrder({ patientId: 'patient-a', title: '   ' })).rejects.toThrow('title is required');
    await expect(local.createOrder({ patientId: 'patient-a', title: 'Order', selectedTeeth: [11, 99] }))
      .rejects.toThrow('invalid FDI');

    const from = vi.fn();
    const supabaseRepo = new SupabaseLaboratoryWorkRepository('tenant-a', undefined, { from } as never);
    await expect(supabaseRepo.createOrder({ patientId: 'patient-a', title: 'Order', selectedTeeth: [99] }))
      .rejects.toThrow('invalid FDI');
    expect(from).not.toHaveBeenCalled();
  });

  it('local fallback persists tenant-separated laboratory orders and work-type links', async () => {
    const tenantA = new LocalStorageLaboratoryWorkRepository('tenant-a');
    const tenantB = new LocalStorageLaboratoryWorkRepository('tenant-b');

    const order = await tenantA.createOrder({ patientId: 'patient-a', title: ' Local crown ', selectedTeeth: [11] });
    await tenantA.addOrderWorkType(order.id, 'type-a');
    await tenantA.addOrderWorkType(order.id, 'type-a');

    expect(await tenantA.getOrder(order.id)).toMatchObject({ tenantId: 'tenant-a', title: 'Local crown' });
    expect(await tenantA.listOrderWorkTypeIds(order.id)).toEqual(['type-a']);
    expect(await tenantB.getOrder(order.id)).toBeNull();
    expect(await tenantB.listOrders()).toEqual([]);
  });

  it('propagates Supabase errors instead of fabricating success', async () => {
    const chain = orderResolvingChain({ data: null, error: new Error('DB failure') });
    const repo = new SupabaseLaboratoryWorkRepository('tenant-a', undefined, { from: vi.fn(() => chain) } as never);

    await expect(repo.listLaboratories()).rejects.toThrow('DB failure');
  });
});
