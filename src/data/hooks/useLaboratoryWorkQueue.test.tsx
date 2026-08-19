// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatientRepository } from '../repositories/PatientRepository';
import type {
  ILaboratoryWorkRepository,
  LaboratoryWorkOrderFilters,
  LaboratoryWorkOrderRecord,
} from '../repositories/LaboratoryWorkRepository';
import {
  useLaboratoryWorkRepository,
  type UseLaboratoryWorkRepositoryResult,
} from './useLaboratoryWorkRepository';
import {
  useLaboratoryWorkQueue,
  type UseLaboratoryWorkQueueResult,
} from './useLaboratoryWorkQueue';

vi.mock('./useLaboratoryWorkRepository', () => ({
  useLaboratoryWorkRepository: vi.fn(),
}));

const mockedUseLaboratoryWorkRepository = vi.mocked(useLaboratoryWorkRepository);

function order(id: string, patientId: string): LaboratoryWorkOrderRecord {
  return {
    id,
    tenantId: 'tenant-1',
    patientId,
    responsibleDoctorId: null,
    laboratoryId: null,
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
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  };
}

function selection(
  repository: ILaboratoryWorkRepository | null,
  overrides: Partial<UseLaboratoryWorkRepositoryResult> = {},
): UseLaboratoryWorkRepositoryResult {
  return {
    backend: 'supabase',
    tenantId: 'tenant-1',
    userId: 'user-1',
    ready: true,
    repository,
    ...overrides,
  };
}

function labRepository(listOrders = vi.fn().mockResolvedValue([])): ILaboratoryWorkRepository {
  return { listOrders } as unknown as ILaboratoryWorkRepository;
}

function patientRepository(listPatients = vi.fn().mockResolvedValue([])): PatientRepository {
  return {
    getPatientById: vi.fn(),
    updatePatient: vi.fn(),
    listPatients,
    createPatient: vi.fn(),
  };
}

function Harness({
  filters,
  patientRepositoryFactory,
  onResult,
}: {
  filters?: LaboratoryWorkOrderFilters;
  patientRepositoryFactory: (config: { backend: 'supabase'; tenantId: string }) => PatientRepository;
  onResult: (result: UseLaboratoryWorkQueueResult) => void;
}) {
  const result = useLaboratoryWorkQueue(filters, { patientRepositoryFactory });
  onResult(result);
  return null;
}

async function flushQuery() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useLaboratoryWorkQueue', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseLaboratoryWorkQueueResult | null;

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

  it('fails closed when the accepted 001C selection is unavailable', async () => {
    const listOrders = vi.fn().mockResolvedValue([]);
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(labRepository(listOrders), {
      backend: 'unavailable',
      tenantId: null,
      ready: false,
      repository: null,
    }));
    const patientRepositoryFactory = vi.fn(() => patientRepository());

    await act(async () => {
      root.render(<Harness patientRepositoryFactory={patientRepositoryFactory} onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();

    expect(listOrders).not.toHaveBeenCalled();
    expect(patientRepositoryFactory).not.toHaveBeenCalled();
    expect(latest).toMatchObject({
      orders: [],
      isLoading: false,
      isError: false,
      patientNamesById: {},
      arePatientNamesLoading: false,
      arePatientNamesError: false,
    });
  });

  it('loads tenant-wide local laboratory orders but blocks the legacy unscoped local patient repository', async () => {
    const localOrder = order('order-local', 'patient-local');
    const listOrders = vi.fn().mockResolvedValue([localOrder]);
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(labRepository(listOrders), {
      backend: 'local',
      tenantId: 'tenant-local',
    }));
    const patientRepositoryFactory = vi.fn(() => patientRepository());

    await act(async () => {
      root.render(<Harness patientRepositoryFactory={patientRepositoryFactory} onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();

    expect(listOrders).toHaveBeenCalledTimes(1);
    expect(listOrders).toHaveBeenCalledWith({
      patientId: undefined,
      status: undefined,
      laboratoryId: undefined,
      responsibleDoctorId: undefined,
    });
    expect(patientRepositoryFactory).not.toHaveBeenCalled();
    expect(latest?.orders).toEqual([localOrder]);
    expect(latest?.patientNamesById).toEqual({});
  });

  it('forwards normalized existing filters and resolves only relevant patient names with one safe Supabase read', async () => {
    const orderA = order('order-a', 'patient-a');
    const orderB = order('order-b', 'patient-b');
    const listOrders = vi.fn().mockResolvedValue([orderA, orderB]);
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(labRepository(listOrders)));
    const listPatients = vi.fn().mockResolvedValue([
      { id: 'patient-a', fullName: 'Пациент А' },
      { id: 'patient-b', fullName: 'Пациент Б' },
      { id: 'patient-unrelated', fullName: 'Не относится к очереди' },
    ]);
    const patientRepositoryFactory = vi.fn(() => patientRepository(listPatients));
    const filters: LaboratoryWorkOrderFilters = {
      patientId: ' patient-filter ',
      status: 'in_progress',
      laboratoryId: ' lab-filter ',
      responsibleDoctorId: ' doctor-filter ',
    };

    await act(async () => {
      root.render(<Harness filters={filters} patientRepositoryFactory={patientRepositoryFactory} onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();

    expect(listOrders).toHaveBeenCalledTimes(1);
    expect(listOrders).toHaveBeenCalledWith({
      patientId: 'patient-filter',
      status: 'in_progress',
      laboratoryId: 'lab-filter',
      responsibleDoctorId: 'doctor-filter',
    });
    expect(patientRepositoryFactory).toHaveBeenCalledTimes(1);
    expect(patientRepositoryFactory).toHaveBeenCalledWith({ backend: 'supabase', tenantId: 'tenant-1' });
    expect(listPatients).toHaveBeenCalledTimes(1);
    expect(latest?.patientNamesById).toEqual({
      'patient-a': 'Пациент А',
      'patient-b': 'Пациент Б',
    });
    expect(JSON.stringify(latest?.patientNamesById)).not.toContain('patient-unrelated');
  });

  it('keeps loaded laboratory orders visible when the secondary patient-name read fails', async () => {
    const orderA = order('order-a', 'patient-a');
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(labRepository(vi.fn().mockResolvedValue([orderA]))));
    const listPatients = vi.fn().mockRejectedValue(new Error('patient list failed'));
    const patientRepositoryFactory = vi.fn(() => patientRepository(listPatients));

    await act(async () => {
      root.render(<Harness patientRepositoryFactory={patientRepositoryFactory} onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();

    expect(latest?.orders).toEqual([orderA]);
    expect(latest?.isError).toBe(false);
    expect(latest?.patientNamesById).toEqual({});
    expect(latest?.arePatientNamesError).toBe(true);
    expect(latest?.patientNamesError?.message).toContain('имена пациентов');
  });

  it('clears stale orders and patient names immediately when filters change', async () => {
    const orderA = order('order-a', 'patient-a');
    const orderB = order('order-b', 'patient-b');
    let resolveSecond: ((orders: LaboratoryWorkOrderRecord[]) => void) | null = null;
    const listOrders = vi.fn()
      .mockResolvedValueOnce([orderA])
      .mockImplementationOnce(() => new Promise<LaboratoryWorkOrderRecord[]>((resolve) => { resolveSecond = resolve; }));
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(labRepository(listOrders)));
    const listPatients = vi.fn()
      .mockResolvedValueOnce([{ id: 'patient-a', fullName: 'Пациент А' }])
      .mockResolvedValueOnce([{ id: 'patient-b', fullName: 'Пациент Б' }]);
    const patientRepositoryFactory = vi.fn(() => patientRepository(listPatients));

    await act(async () => {
      root.render(<Harness filters={{ status: 'in_progress' }} patientRepositoryFactory={patientRepositoryFactory} onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();
    expect(latest?.orders).toEqual([orderA]);
    expect(latest?.patientNamesById).toEqual({ 'patient-a': 'Пациент А' });

    await act(async () => {
      root.render(<Harness filters={{ status: 'completed' }} patientRepositoryFactory={patientRepositoryFactory} onResult={(result) => { latest = result; }} />);
    });
    expect(latest?.orders).toEqual([]);
    expect(latest?.patientNamesById).toEqual({});

    await act(async () => {
      resolveSecond?.([orderB]);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushQuery();

    expect(latest?.orders).toEqual([orderB]);
    expect(latest?.patientNamesById).toEqual({ 'patient-b': 'Пациент Б' });
  });

  it('clears stale orders and patient names when tenant/user context changes', async () => {
    const orderA = order('order-a', 'patient-a');
    const orderB = { ...order('order-b', 'patient-b'), tenantId: 'tenant-2' };
    const listOrdersA = vi.fn().mockResolvedValue([orderA]);
    const listOrdersB = vi.fn().mockResolvedValue([orderB]);
    const repositoryA = labRepository(listOrdersA);
    const repositoryB = labRepository(listOrdersB);
    let currentSelection = selection(repositoryA, { tenantId: 'tenant-1', userId: 'user-1' });
    mockedUseLaboratoryWorkRepository.mockImplementation(() => currentSelection);

    const listPatientsA = vi.fn().mockResolvedValue([{ id: 'patient-a', fullName: 'Пациент А' }]);
    const listPatientsB = vi.fn().mockResolvedValue([{ id: 'patient-b', fullName: 'Пациент Б' }]);
    const patientRepositoryFactory = vi.fn(({ tenantId }: { backend: 'supabase'; tenantId: string }) => (
      tenantId === 'tenant-1' ? patientRepository(listPatientsA) : patientRepository(listPatientsB)
    ));

    await act(async () => {
      root.render(<Harness patientRepositoryFactory={patientRepositoryFactory} onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();
    expect(latest?.orders).toEqual([orderA]);
    expect(latest?.patientNamesById).toEqual({ 'patient-a': 'Пациент А' });

    currentSelection = selection(repositoryB, { tenantId: 'tenant-2', userId: 'user-2' });
    await act(async () => {
      root.render(<Harness patientRepositoryFactory={patientRepositoryFactory} onResult={(result) => { latest = result; }} />);
    });

    expect(latest?.orders).toEqual([]);
    expect(latest?.patientNamesById).toEqual({});
    await flushQuery();

    expect(listOrdersA).toHaveBeenCalledTimes(1);
    expect(listOrdersB).toHaveBeenCalledTimes(1);
    expect(patientRepositoryFactory).toHaveBeenCalledWith({ backend: 'supabase', tenantId: 'tenant-1' });
    expect(patientRepositoryFactory).toHaveBeenCalledWith({ backend: 'supabase', tenantId: 'tenant-2' });
    expect(latest?.orders).toEqual([orderB]);
    expect(latest?.patientNamesById).toEqual({ 'patient-b': 'Пациент Б' });
  });

  it('never substitutes an unknown patient id as a display name', async () => {
    const unknownPatientId = 'patient-unknown-raw-id';
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(
      labRepository(vi.fn().mockResolvedValue([order('order-unknown', unknownPatientId)])),
    ));
    const listPatients = vi.fn().mockResolvedValue([]);
    const patientRepositoryFactory = vi.fn(() => patientRepository(listPatients));

    await act(async () => {
      root.render(<Harness patientRepositoryFactory={patientRepositoryFactory} onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();

    expect(listPatients).toHaveBeenCalledTimes(1);
    expect(latest?.patientNamesById).toEqual({});
    expect(Object.values(latest?.patientNamesById ?? {})).not.toContain(unknownPatientId);
  });

  it('exposes only read state and no repository or mutation methods', async () => {
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(labRepository()));
    const patientRepositoryFactory = vi.fn(() => patientRepository());

    await act(async () => {
      root.render(<Harness patientRepositoryFactory={patientRepositoryFactory} onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();

    expect(latest).toHaveProperty('orders');
    expect(latest).toHaveProperty('patientNamesById');
    expect(latest).toHaveProperty('refetch');
    expect(latest).toHaveProperty('refetchPatientNames');
    expect(latest).not.toHaveProperty('repository');
    expect(latest).not.toHaveProperty('patientRepository');
    expect(latest).not.toHaveProperty('createOrder');
    expect(latest).not.toHaveProperty('updateOrder');
    expect(latest).not.toHaveProperty('createPatient');
    expect(latest).not.toHaveProperty('updatePatient');
  });
});
