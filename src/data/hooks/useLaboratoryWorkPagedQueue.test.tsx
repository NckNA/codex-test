// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatientRepository } from '../repositories/PatientRepository';
import type {
  LaboratoryWorkQueueReadClient,
  LaboratoryWorkQueueReferencesByOrderId,
} from '../repositories/LaboratoryWorkQueueReadClient';
import type { ILaboratoryWorkRepository, LaboratoryWorkOrderRecord } from '../repositories/LaboratoryWorkRepository';
import {
  useLaboratoryWorkRepository,
  type UseLaboratoryWorkRepositoryResult,
} from './useLaboratoryWorkRepository';
import {
  useLaboratoryWorkPagedQueue,
  type LaboratoryWorkPagedQueueInput,
  type UseLaboratoryWorkPagedQueueResult,
} from './useLaboratoryWorkPagedQueue';

vi.mock('./useLaboratoryWorkRepository', () => ({
  useLaboratoryWorkRepository: vi.fn(),
}));

const mockedUseLaboratoryWorkRepository = vi.mocked(useLaboratoryWorkRepository);

function order(id: string, patientId: string, tenantId = 'tenant-1'): LaboratoryWorkOrderRecord {
  return {
    id,
    tenantId,
    patientId,
    responsibleDoctorId: 'doctor-1',
    laboratoryId: 'lab-1',
    orderNumber: null,
    title: `Order ${id}`,
    status: 'in_progress',
    sentToLabAt: null,
    plannedReadyAt: null,
    receivedFromLabAt: null,
    tryInAt: null,
    deliveredToPatientAt: null,
    shade: null,
    anatomicalScope: null,
    selectedTeeth: [],
    comment: null,
    createdBy: null,
    updatedBy: null,
    mutationVersion: 1,
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
  };
}

function forbiddenLegacyRepository(listOrders = vi.fn().mockRejectedValue(new Error('broad listOrders forbidden'))): ILaboratoryWorkRepository {
  return { listOrders } as unknown as ILaboratoryWorkRepository;
}

function selection(
  overrides: Partial<UseLaboratoryWorkRepositoryResult> = {},
): UseLaboratoryWorkRepositoryResult {
  return {
    backend: 'supabase',
    tenantId: 'tenant-1',
    userId: 'user-1',
    ready: true,
    repository: forbiddenLegacyRepository(),
    ...overrides,
  };
}

function patientRepository(listPatientLabelsByIds = vi.fn().mockResolvedValue([])): PatientRepository {
  return {
    getPatientById: vi.fn(),
    updatePatient: vi.fn(),
    listPatients: vi.fn().mockRejectedValue(new Error('broad patient read forbidden')),
    listPatientLabelsByIds,
    createPatient: vi.fn(),
  };
}

function readClient(overrides: Partial<LaboratoryWorkQueueReadClient> = {}): LaboratoryWorkQueueReadClient {
  return {
    listPage: vi.fn().mockResolvedValue({ items: [], totalFiltered: 0, limit: 50, offset: 0 }),
    getSummary: vi.fn().mockResolvedValue({ inProgress: 0, overdue: 0, completed: 0 }),
    listPageReferences: vi.fn().mockResolvedValue({}),
    listFilterOptions: vi.fn().mockResolvedValue({ doctors: [], laboratories: [] }),
    ...overrides,
  };
}

function Harness({
  input,
  readClientFactory,
  patientRepositoryFactory,
  onResult,
}: {
  input?: LaboratoryWorkPagedQueueInput;
  readClientFactory: (config: { backend: 'supabase' }) => LaboratoryWorkQueueReadClient;
  patientRepositoryFactory: (config: { backend: 'supabase'; tenantId: string }) => PatientRepository;
  onResult: (result: UseLaboratoryWorkPagedQueueResult) => void;
}) {
  const result = useLaboratoryWorkPagedQueue(input, { readClientFactory, patientRepositoryFactory });
  onResult(result);
  return null;
}

async function flushQuery() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useLaboratoryWorkPagedQueue', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseLaboratoryWorkPagedQueueResult | null;

  beforeEach(() => {
    vi.clearAllMocks();
    latest = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('uses only the bounded RPC client, loads independent summary/filter dictionaries, and enriches current-page ids', async () => {
    const pageOrders = [order('order-1', 'patient-1'), order('order-2', 'patient-2')];
    const legacyListOrders = vi.fn().mockRejectedValue(new Error('broad listOrders forbidden'));
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection({ repository: forbiddenLegacyRepository(legacyListOrders) }));

    const references: LaboratoryWorkQueueReferencesByOrderId = {
      'order-1': { responsibleDoctorName: 'Doctor', laboratoryName: 'Lab', workTypeNames: ['Scan'] },
      'order-2': { responsibleDoctorName: 'Doctor', laboratoryName: 'Lab', workTypeNames: ['Crown'] },
    };
    const client = readClient({
      listPage: vi.fn().mockResolvedValue({ items: pageOrders, totalFiltered: 12, limit: 2, offset: 4 }),
      getSummary: vi.fn().mockResolvedValue({ inProgress: 9, overdue: 2, completed: 3 }),
      listPageReferences: vi.fn().mockResolvedValue(references),
      listFilterOptions: vi.fn().mockResolvedValue({
        doctors: [{ id: 'doctor-1', label: 'Doctor' }],
        laboratories: [{ id: 'lab-1', label: 'Lab' }],
      }),
    });
    const readClientFactory = vi.fn(() => client);
    const listPatientLabelsByIds = vi.fn().mockResolvedValue([
      { id: 'patient-1', fullName: 'Patient One' },
      { id: 'patient-2', fullName: 'Patient Two' },
      { id: 'patient-unrelated', fullName: 'Must not leak' },
    ]);
    const patients = patientRepository(listPatientLabelsByIds);
    const patientRepositoryFactory = vi.fn(() => patients);

    await act(async () => {
      root.render(<Harness
        input={{
          status: 'in_progress',
          responsibleDoctorId: ' doctor-1 ',
          laboratoryId: ' lab-1 ',
          dueFilter: 'today',
          search: ' crown ',
          limit: 2,
          offset: 4,
        }}
        readClientFactory={readClientFactory}
        patientRepositoryFactory={patientRepositoryFactory}
        onResult={(result) => { latest = result; }}
      />);
    });
    await flushQuery();
    await flushQuery();

    expect(legacyListOrders).not.toHaveBeenCalled();
    expect(client.listPage).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      status: 'in_progress',
      responsibleDoctorId: 'doctor-1',
      laboratoryId: 'lab-1',
      dueFilter: 'today',
      search: 'crown',
      limit: 2,
      offset: 4,
    });
    expect(client.getSummary).toHaveBeenCalledWith('tenant-1');
    expect(client.listPageReferences).toHaveBeenCalledWith('tenant-1', pageOrders);
    expect(client.listFilterOptions).toHaveBeenCalledWith('tenant-1');
    expect(listPatientLabelsByIds).toHaveBeenCalledWith(['patient-1', 'patient-2']);
    expect(patients.listPatients).not.toHaveBeenCalled();

    expect(latest).toMatchObject({
      orders: pageOrders,
      totalFiltered: 12,
      limit: 2,
      offset: 4,
      summary: { inProgress: 9, overdue: 2, completed: 3 },
      patientNamesById: { 'patient-1': 'Patient One', 'patient-2': 'Patient Two' },
      referencesByOrderId: references,
    });
    expect(latest?.filterOptions.doctors).toEqual([{ id: 'doctor-1', label: 'Doctor' }]);
    expect(latest?.patientNamesById).not.toHaveProperty('patient-unrelated');
  });

  it('fails closed outside ready Supabase mode and never falls back to legacy broad reads', async () => {
    const legacyListOrders = vi.fn().mockResolvedValue([order('legacy', 'patient')]);
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection({
      backend: 'local',
      ready: true,
      repository: forbiddenLegacyRepository(legacyListOrders),
      tenantId: 'local-tenant',
    }));
    const readClientFactory = vi.fn(() => readClient());
    const patientRepositoryFactory = vi.fn(() => patientRepository());

    await act(async () => {
      root.render(<Harness
        readClientFactory={readClientFactory}
        patientRepositoryFactory={patientRepositoryFactory}
        onResult={(result) => { latest = result; }}
      />);
    });
    await flushQuery();

    expect(readClientFactory).not.toHaveBeenCalled();
    expect(patientRepositoryFactory).not.toHaveBeenCalled();
    expect(legacyListOrders).not.toHaveBeenCalled();
    expect(latest).toMatchObject({
      orders: [],
      totalFiltered: 0,
      isLoading: false,
      isError: false,
      summary: { inProgress: 0, overdue: 0, completed: 0 },
      patientNamesById: {},
      referencesByOrderId: {},
    });
  });

  it('keeps the canonical page visible when secondary patient/reference/filter reads fail', async () => {
    const pageOrder = order('order-1', 'patient-1');
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection());
    const client = readClient({
      listPage: vi.fn().mockResolvedValue({ items: [pageOrder], totalFiltered: 1, limit: 50, offset: 0 }),
      getSummary: vi.fn().mockResolvedValue({ inProgress: 1, overdue: 0, completed: 0 }),
      listPageReferences: vi.fn().mockRejectedValue(new Error('reference failure')),
      listFilterOptions: vi.fn().mockRejectedValue(new Error('filter failure')),
    });
    const readClientFactory = vi.fn(() => client);
    const patients = patientRepository(vi.fn().mockRejectedValue(new Error('patient failure')));
    const patientRepositoryFactory = vi.fn(() => patients);

    await act(async () => {
      root.render(<Harness
        readClientFactory={readClientFactory}
        patientRepositoryFactory={patientRepositoryFactory}
        onResult={(result) => { latest = result; }}
      />);
    });
    await flushQuery();
    await flushQuery();

    expect(latest?.orders).toEqual([pageOrder]);
    expect(latest?.isError).toBe(false);
    expect(latest?.arePatientNamesError).toBe(true);
    expect(latest?.areReferencesError).toBe(true);
    expect(latest?.areFilterOptionsError).toBe(true);
    expect(latest?.patientNamesById).toEqual({});
    expect(latest?.referencesByOrderId).toEqual({});
  });

  it('clears stale page-derived data immediately when the server query identity changes', async () => {
    const firstOrder = order('order-a', 'patient-a');
    const secondOrder = order('order-b', 'patient-b');
    let resolveSecond: ((value: { items: LaboratoryWorkOrderRecord[]; totalFiltered: number; limit: number; offset: number }) => void) | null = null;
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection());
    const listPage = vi.fn()
      .mockResolvedValueOnce({ items: [firstOrder], totalFiltered: 1, limit: 50, offset: 0 })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const client = readClient({ listPage });
    const readClientFactory = vi.fn(() => client);
    const patientRepositoryFactory = vi.fn(() => patientRepository(vi.fn().mockResolvedValue([])));

    await act(async () => {
      root.render(<Harness
        input={{ search: 'first' }}
        readClientFactory={readClientFactory}
        patientRepositoryFactory={patientRepositoryFactory}
        onResult={(result) => { latest = result; }}
      />);
    });
    await flushQuery();
    await flushQuery();
    expect(latest?.orders).toEqual([firstOrder]);

    await act(async () => {
      root.render(<Harness
        input={{ search: 'second' }}
        readClientFactory={readClientFactory}
        patientRepositoryFactory={patientRepositoryFactory}
        onResult={(result) => { latest = result; }}
      />);
    });

    expect(latest?.orders).toEqual([]);
    expect(latest?.patientNamesById).toEqual({});
    expect(latest?.referencesByOrderId).toEqual({});

    await act(async () => {
      resolveSecond?.({ items: [secondOrder], totalFiltered: 1, limit: 50, offset: 0 });
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushQuery();
    await flushQuery();

    expect(listPage).toHaveBeenNthCalledWith(1, expect.objectContaining({ search: 'first' }));
    expect(listPage).toHaveBeenNthCalledWith(2, expect.objectContaining({ search: 'second' }));
    expect(latest?.orders).toEqual([secondOrder]);
  });

  it('drops the old tenant page immediately and does not expose it while a new tenant request is pending', async () => {
    const orderA = order('order-a', 'patient-a', 'tenant-1');
    const orderB = order('order-b', 'patient-b', 'tenant-2');
    let currentSelection = selection({ tenantId: 'tenant-1', userId: 'user-1' });
    mockedUseLaboratoryWorkRepository.mockImplementation(() => currentSelection);
    let resolveTenantB: ((value: { items: LaboratoryWorkOrderRecord[]; totalFiltered: number; limit: number; offset: number }) => void) | null = null;
    const listPage = vi.fn()
      .mockResolvedValueOnce({ items: [orderA], totalFiltered: 1, limit: 50, offset: 0 })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveTenantB = resolve; }));
    const client = readClient({ listPage });
    const readClientFactory = vi.fn(() => client);
    const patientRepositoryFactory = vi.fn(({ tenantId }: { backend: 'supabase'; tenantId: string }) => (
      patientRepository(vi.fn().mockResolvedValue([{ id: tenantId === 'tenant-1' ? 'patient-a' : 'patient-b', fullName: tenantId }]))
    ));

    const render = async () => {
      await act(async () => {
        root.render(<Harness
          readClientFactory={readClientFactory}
          patientRepositoryFactory={patientRepositoryFactory}
          onResult={(result) => { latest = result; }}
        />);
      });
    };

    await render();
    await flushQuery();
    await flushQuery();
    expect(latest?.orders).toEqual([orderA]);

    currentSelection = selection({ tenantId: 'tenant-2', userId: 'user-2' });
    await render();
    expect(latest?.orders).toEqual([]);
    expect(latest?.patientNamesById).not.toHaveProperty('patient-a');

    await act(async () => {
      resolveTenantB?.({ items: [orderB], totalFiltered: 1, limit: 50, offset: 0 });
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushQuery();
    await flushQuery();

    expect(listPage).toHaveBeenNthCalledWith(1, expect.objectContaining({ tenantId: 'tenant-1' }));
    expect(listPage).toHaveBeenNthCalledWith(2, expect.objectContaining({ tenantId: 'tenant-2' }));
    expect(latest?.orders).toEqual([orderB]);
    expect(latest?.patientNamesById).not.toHaveProperty('patient-a');
  });
});
