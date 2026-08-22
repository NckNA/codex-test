import { describe, expect, it, vi } from 'vitest';
import {
  SupabaseLaboratoryWorkQueueReadClient,
  createLaboratoryWorkQueueReadClient,
} from './LaboratoryWorkQueueReadClient';

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    tenant_id: 'tenant-a',
    patient_id: 'patient-a',
    responsible_doctor_id: 'doctor-a',
    laboratory_id: 'lab-a',
    order_number: 'L-1',
    title: 'Crown',
    status: 'in_progress',
    sent_to_lab_at: null,
    planned_ready_at: null,
    received_from_lab_at: null,
    try_in_at: null,
    delivered_to_patient_at: null,
    shade: null,
    anatomical_scope: null,
    selected_teeth: [],
    comment: null,
    created_by: null,
    updated_by: null,
    mutation_version: 1,
    created_at: '2026-08-22T00:00:00.000Z',
    updated_at: '2026-08-22T00:00:00.000Z',
    ...overrides,
  };
}

function exactChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn().mockResolvedValue(result);
  return chain;
}

function orderedChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn()
    .mockImplementationOnce(() => chain)
    .mockResolvedValueOnce(result);
  return chain;
}

describe('LaboratoryWorkQueueReadClient', () => {
  it('calls the frozen paged RPC with normalized bounded arguments and maps canonical rows', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        items: [orderRow()],
        totalFiltered: 17,
        limit: 25,
        offset: 50,
      },
      error: null,
    });
    const client = new SupabaseLaboratoryWorkQueueReadClient({ rpc } as never);

    const result = await client.listPage({
      tenantId: ' tenant-a ',
      status: 'in_progress',
      responsibleDoctorId: ' doctor-a ',
      laboratoryId: ' lab-a ',
      dueFilter: 'today',
      search: ' crown ',
      limit: 25,
      offset: 50,
    });

    expect(rpc).toHaveBeenCalledWith('list_laboratory_work_queue_page', {
      p_tenant_id: 'tenant-a',
      p_status: 'in_progress',
      p_responsible_doctor_id: 'doctor-a',
      p_laboratory_id: 'lab-a',
      p_due_filter: 'today',
      p_search: 'crown',
      p_limit: 25,
      p_offset: 50,
    });
    expect(result).toEqual(expect.objectContaining({ totalFiltered: 17, limit: 25, offset: 50 }));
    expect(result.items[0]).toMatchObject({ id: 'order-1', tenantId: 'tenant-a', patientId: 'patient-a' });
  });

  it('fails closed on invalid bounds, malformed payloads, and cross-tenant rows', async () => {
    const rpc = vi.fn();
    const client = new SupabaseLaboratoryWorkQueueReadClient({ rpc } as never);

    await expect(client.listPage({ tenantId: 'tenant-a', limit: 0 })).rejects.toThrow('limit');
    await expect(client.listPage({ tenantId: 'tenant-a', limit: 101 })).rejects.toThrow('limit');
    await expect(client.listPage({ tenantId: 'tenant-a', offset: -1 })).rejects.toThrow('offset');
    expect(rpc).not.toHaveBeenCalled();

    rpc.mockResolvedValueOnce({ data: { items: [], totalFiltered: 'bad', limit: 50, offset: 0 }, error: null });
    await expect(client.listPage({ tenantId: 'tenant-a' })).rejects.toThrow('totalFiltered');

    rpc.mockResolvedValueOnce({
      data: { items: [orderRow({ tenant_id: 'tenant-b' })], totalFiltered: 1, limit: 50, offset: 0 },
      error: null,
    });
    await expect(client.listPage({ tenantId: 'tenant-a' })).rejects.toThrow('LAB_QUEUE_TENANT_MISMATCH');
  });

  it('loads whole-tenant summary through its independent RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { inProgress: 8, overdue: 2, completed: 11 },
      error: null,
    });
    const client = new SupabaseLaboratoryWorkQueueReadClient({ rpc } as never);

    await expect(client.getSummary('tenant-a')).resolves.toEqual({ inProgress: 8, overdue: 2, completed: 11 });
    expect(rpc).toHaveBeenCalledWith('get_laboratory_work_queue_summary', { p_tenant_id: 'tenant-a' });
  });

  it('hydrates only current-page doctor/laboratory/work-type ids with minimal tenant-scoped reads', async () => {
    const links = exactChain({
      data: [
        { laboratory_work_order_id: 'order-1', laboratory_work_type_id: 'type-2' },
        { laboratory_work_order_id: 'order-1', laboratory_work_type_id: 'type-1' },
      ],
      error: null,
    });
    const doctors = exactChain({ data: [{ id: 'doctor-a', full_name: 'Doctor A' }], error: null });
    const laboratories = exactChain({ data: [{ id: 'lab-a', name: 'Lab A' }], error: null });
    const workTypes = exactChain({
      data: [
        { id: 'type-2', name: 'Zirconia', sort_order: 20 },
        { id: 'type-1', name: 'Scan', sort_order: 10 },
      ],
      error: null,
    });
    const from = vi.fn((table: string) => ({
      laboratory_work_order_types: links,
      doctors,
      laboratories,
      laboratory_work_types: workTypes,
    })[table] as never);
    const client = new SupabaseLaboratoryWorkQueueReadClient({ from } as never);
    const order = {
      id: 'order-1', tenantId: 'tenant-a', patientId: 'patient-a', responsibleDoctorId: 'doctor-a', laboratoryId: 'lab-a',
      orderNumber: null, title: 'Order', status: 'in_progress' as const, sentToLabAt: null, plannedReadyAt: null,
      receivedFromLabAt: null, tryInAt: null, deliveredToPatientAt: null, shade: null, anatomicalScope: null,
      selectedTeeth: [], comment: null, createdBy: null, updatedBy: null, mutationVersion: 1,
      createdAt: '2026-08-22T00:00:00Z', updatedAt: '2026-08-22T00:00:00Z',
    };

    const result = await client.listPageReferences('tenant-a', [order]);

    expect(from).toHaveBeenCalledWith('laboratory_work_order_types');
    expect(links.select).toHaveBeenCalledWith('laboratory_work_order_id,laboratory_work_type_id');
    expect(links.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(links.in).toHaveBeenCalledWith('laboratory_work_order_id', ['order-1']);

    expect(doctors.select).toHaveBeenCalledWith('id,full_name');
    expect(doctors.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(doctors.in).toHaveBeenCalledWith('id', ['doctor-a']);
    expect(laboratories.select).toHaveBeenCalledWith('id,name');
    expect(laboratories.in).toHaveBeenCalledWith('id', ['lab-a']);
    expect(workTypes.select).toHaveBeenCalledWith('id,name,sort_order');
    expect(workTypes.in).toHaveBeenCalledWith('id', ['type-1', 'type-2']);

    expect(result).toEqual({
      'order-1': {
        responsibleDoctorName: 'Doctor A',
        laboratoryName: 'Lab A',
        workTypeNames: ['Scan', 'Zirconia'],
      },
    });
  });

  it('returns zero reference DB reads for an empty page and rejects mixed-tenant page input', async () => {
    const from = vi.fn();
    const client = new SupabaseLaboratoryWorkQueueReadClient({ from } as never);

    await expect(client.listPageReferences('tenant-a', [])).resolves.toEqual({});
    expect(from).not.toHaveBeenCalled();

    const foreign = {
      id: 'order-b', tenantId: 'tenant-b', patientId: 'patient-b', responsibleDoctorId: null, laboratoryId: null,
      orderNumber: null, title: 'Foreign', status: 'in_progress' as const, sentToLabAt: null, plannedReadyAt: null,
      receivedFromLabAt: null, tryInAt: null, deliveredToPatientAt: null, shade: null, anatomicalScope: null,
      selectedTeeth: [], comment: null, createdBy: null, updatedBy: null, mutationVersion: 1,
      createdAt: '2026-08-22T00:00:00Z', updatedAt: '2026-08-22T00:00:00Z',
    };
    await expect(client.listPageReferences('tenant-a', [foreign])).rejects.toThrow('LAB_QUEUE_TENANT_MISMATCH');
    expect(from).not.toHaveBeenCalled();
  });

  it('loads doctor/laboratory filter dictionaries independently with minimal whole-tenant columns', async () => {
    const doctors = orderedChain({
      data: [{ id: 'doctor-b', full_name: 'Бета' }, { id: 'doctor-a', full_name: 'Альфа' }],
      error: null,
    });
    const laboratories = orderedChain({
      data: [{ id: 'lab-b', name: 'Бета Lab' }, { id: 'lab-a', name: 'Альфа Lab' }],
      error: null,
    });
    const from = vi.fn((table: string) => table === 'doctors' ? doctors : laboratories);
    const client = new SupabaseLaboratoryWorkQueueReadClient({ from } as never);

    const result = await client.listFilterOptions('tenant-a');

    expect(doctors.select).toHaveBeenCalledWith('id,full_name');
    expect(laboratories.select).toHaveBeenCalledWith('id,name');
    expect(doctors.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(laboratories.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(result.doctors.map((item) => item.id)).toEqual(['doctor-a', 'doctor-b']);
    expect(result.laboratories.map((item) => item.id)).toEqual(['lab-a', 'lab-b']);
  });

  it('propagates server errors and never silently fabricates a page', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('RPC denied') });
    const client = new SupabaseLaboratoryWorkQueueReadClient({ rpc } as never);
    await expect(client.listPage({ tenantId: 'tenant-a' })).rejects.toThrow('RPC denied');
  });

  it('factory fails closed when Supabase is unavailable instead of falling back to broad local reads', () => {
    expect(() => createLaboratoryWorkQueueReadClient({ backend: 'supabase', client: null }))
      .toThrow('Supabase client is not configured');
  });
});
