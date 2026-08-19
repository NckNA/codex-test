// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IDoctorRepository } from '../repositories/DoctorRepository';
import type {
  ILaboratoryWorkRepository,
  LaboratoryRecord,
  LaboratoryWorkOrderRecord,
  LaboratoryWorkTypeRecord,
} from '../repositories/LaboratoryWorkRepository';
import {
  useLaboratoryWorkRepository,
  type UseLaboratoryWorkRepositoryResult,
} from './useLaboratoryWorkRepository';
import {
  usePatientLaboratoryWorkReferences,
  type UsePatientLaboratoryWorkReferencesResult,
} from './usePatientLaboratoryWorkReferences';

vi.mock('./useLaboratoryWorkRepository', () => ({
  useLaboratoryWorkRepository: vi.fn(),
}));

const mockedUseLaboratoryWorkRepository = vi.mocked(useLaboratoryWorkRepository);

function makeOrder(
  id: string,
  responsibleDoctorId: string | null,
  laboratoryId: string | null,
): LaboratoryWorkOrderRecord {
  return {
    id,
    tenantId: 'tenant-1',
    patientId: 'patient-1',
    responsibleDoctorId,
    laboratoryId,
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
    updatedAt: `2026-08-19T00:00:0${id.endsWith('b') ? '2' : '1'}.000Z`,
  };
}

function makeLaboratory(id: string, name: string, active = true): LaboratoryRecord {
  return {
    id,
    tenantId: 'tenant-1',
    name,
    active,
    notes: null,
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  };
}

function makeWorkType(id: string, name: string, sortOrder: number, active = true): LaboratoryWorkTypeRecord {
  return {
    id,
    tenantId: 'tenant-1',
    name,
    code: null,
    active,
    sortOrder,
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

function referenceRepository(overrides: Partial<ILaboratoryWorkRepository> = {}): ILaboratoryWorkRepository {
  return {
    listLaboratories: vi.fn().mockResolvedValue([]),
    listWorkTypes: vi.fn().mockResolvedValue([]),
    listOrderWorkTypeLinks: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as ILaboratoryWorkRepository;
}

function doctorRepository(listDoctors = vi.fn().mockResolvedValue([])): IDoctorRepository {
  return {
    listDoctors,
    listActiveDoctors: vi.fn().mockResolvedValue([]),
  };
}

function Harness({
  orders,
  doctorRepositoryFactory,
  onResult,
}: {
  orders: LaboratoryWorkOrderRecord[];
  doctorRepositoryFactory: (config: { backend: 'local' | 'supabase'; tenantId?: string | null }) => IDoctorRepository;
  onResult: (result: UsePatientLaboratoryWorkReferencesResult) => void;
}) {
  const result = usePatientLaboratoryWorkReferences(orders, { doctorRepositoryFactory });
  onResult(result);
  return null;
}

async function flushQuery() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('usePatientLaboratoryWorkReferences', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UsePatientLaboratoryWorkReferencesResult | null;

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

  it('fails closed when the accepted 001C laboratory selection is unavailable', async () => {
    const listLaboratories = vi.fn().mockResolvedValue([]);
    const repository = referenceRepository({ listLaboratories });
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(repository, {
      backend: 'unavailable',
      tenantId: null,
      ready: false,
    }));
    const doctorRepositoryFactory = vi.fn(() => doctorRepository());

    await act(async () => {
      root.render(<Harness
        orders={[makeOrder('order-a', 'doctor-a', 'lab-a')]}
        doctorRepositoryFactory={doctorRepositoryFactory}
        onResult={(result) => { latest = result; }}
      />);
    });
    await flushQuery();

    expect(listLaboratories).not.toHaveBeenCalled();
    expect(doctorRepositoryFactory).not.toHaveBeenCalled();
    expect(latest).toMatchObject({ referencesByOrderId: {}, isLoading: false, isError: false, error: null });
  });

  it('does not load references for an empty order set', async () => {
    const repository = referenceRepository();
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(repository));
    const doctorRepositoryFactory = vi.fn(() => doctorRepository());

    await act(async () => {
      root.render(<Harness orders={[]} doctorRepositoryFactory={doctorRepositoryFactory} onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();

    expect(repository.listLaboratories).not.toHaveBeenCalled();
    expect(repository.listWorkTypes).not.toHaveBeenCalled();
    expect(repository.listOrderWorkTypeLinks).not.toHaveBeenCalled();
    expect(doctorRepositoryFactory).not.toHaveBeenCalled();
    expect(latest?.referencesByOrderId).toEqual({});
  });

  it('resolves doctor, laboratory and work-type names with a constant batch relation read', async () => {
    const orderA = makeOrder('order-a', 'doctor-a', 'lab-a');
    const orderB = makeOrder('order-b', 'doctor-missing', 'lab-inactive');
    const listLaboratories = vi.fn().mockResolvedValue([
      makeLaboratory('lab-a', 'Lab A'),
      makeLaboratory('lab-inactive', 'Historical Lab', false),
    ]);
    const listWorkTypes = vi.fn().mockResolvedValue([
      makeWorkType('type-z', 'Zirconia', 20),
      makeWorkType('type-c', 'Crown', 10, false),
    ]);
    const listOrderWorkTypeLinks = vi.fn().mockResolvedValue([
      { orderId: 'order-a', workTypeId: 'type-z' },
      { orderId: 'order-a', workTypeId: 'type-c' },
      { orderId: 'order-a', workTypeId: 'type-z' },
      { orderId: 'order-b', workTypeId: 'type-missing' },
    ]);
    const repository = referenceRepository({ listLaboratories, listWorkTypes, listOrderWorkTypeLinks });
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(repository));

    const listDoctors = vi.fn().mockResolvedValue([
      { id: 'doctor-a', fullName: 'Doctor A', specialization: '', cabinet: '', color: '', active: false },
    ]);
    const doctorRepositoryFactory = vi.fn(() => doctorRepository(listDoctors));

    await act(async () => {
      root.render(<Harness
        orders={[orderB, orderA]}
        doctorRepositoryFactory={doctorRepositoryFactory}
        onResult={(result) => { latest = result; }}
      />);
    });
    await flushQuery();

    expect(listLaboratories).toHaveBeenCalledTimes(1);
    expect(listLaboratories).toHaveBeenCalledWith(true);
    expect(listWorkTypes).toHaveBeenCalledTimes(1);
    expect(listWorkTypes).toHaveBeenCalledWith(true);
    expect(listOrderWorkTypeLinks).toHaveBeenCalledTimes(1);
    expect(listOrderWorkTypeLinks).toHaveBeenCalledWith(['order-a', 'order-b']);
    expect(doctorRepositoryFactory).toHaveBeenCalledTimes(1);
    expect(doctorRepositoryFactory).toHaveBeenCalledWith({ backend: 'supabase', tenantId: 'tenant-1' });
    expect(listDoctors).toHaveBeenCalledTimes(1);

    expect(latest?.referencesByOrderId).toEqual({
      'order-b': {
        responsibleDoctorName: null,
        laboratoryName: 'Historical Lab',
        workTypeNames: [],
      },
      'order-a': {
        responsibleDoctorName: 'Doctor A',
        laboratoryName: 'Lab A',
        workTypeNames: ['Crown', 'Zirconia'],
      },
    });
    expect(JSON.stringify(latest?.referencesByOrderId)).not.toContain('doctor-missing');
    expect(JSON.stringify(latest?.referencesByOrderId)).not.toContain('type-missing');
  });

  it('does not instantiate the legacy unscoped local doctor repository', async () => {
    const repository = referenceRepository({
      listLaboratories: vi.fn().mockResolvedValue([makeLaboratory('lab-a', 'Local Lab')]),
    });
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(repository, { backend: 'local', tenantId: 'tenant-local' }));
    const listDoctors = vi.fn().mockResolvedValue([
      { id: 'doctor-a', fullName: 'Unsafe Global Doctor', specialization: '', cabinet: '', color: '', active: true },
    ]);
    const doctorRepositoryFactory = vi.fn(() => doctorRepository(listDoctors));

    await act(async () => {
      root.render(<Harness
        orders={[makeOrder('order-a', 'doctor-a', 'lab-a')]}
        doctorRepositoryFactory={doctorRepositoryFactory}
        onResult={(result) => { latest = result; }}
      />);
    });
    await flushQuery();

    expect(doctorRepositoryFactory).not.toHaveBeenCalled();
    expect(listDoctors).not.toHaveBeenCalled();
    expect(latest?.referencesByOrderId['order-a']).toEqual({
      responsibleDoctorName: null,
      laboratoryName: 'Local Lab',
      workTypeNames: [],
    });
    expect(JSON.stringify(latest?.referencesByOrderId)).not.toContain('Unsafe Global Doctor');
  });

  it('clears patient/order-set A references immediately when switching to B', async () => {
    const orderA = makeOrder('order-a', null, 'lab-a');
    const orderB = makeOrder('order-b', null, 'lab-b');
    const listLaboratories = vi.fn()
      .mockResolvedValueOnce([makeLaboratory('lab-a', 'Lab A')])
      .mockResolvedValueOnce([makeLaboratory('lab-b', 'Lab B')]);
    const repository = referenceRepository({ listLaboratories });
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(repository));
    const doctorRepositoryFactory = vi.fn(() => doctorRepository());

    await act(async () => {
      root.render(<Harness orders={[orderA]} doctorRepositoryFactory={doctorRepositoryFactory} onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();
    expect(latest?.referencesByOrderId['order-a']?.laboratoryName).toBe('Lab A');

    await act(async () => {
      root.render(<Harness orders={[orderB]} doctorRepositoryFactory={doctorRepositoryFactory} onResult={(result) => { latest = result; }} />);
    });
    expect(latest?.referencesByOrderId).not.toHaveProperty('order-a');

    await flushQuery();
    expect(latest?.referencesByOrderId).toEqual({
      'order-b': { responsibleDoctorName: null, laboratoryName: 'Lab B', workTypeNames: [] },
    });
  });

  it('exposes only read state and no repository or mutation methods', async () => {
    const repository = referenceRepository();
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(repository));
    const doctorRepositoryFactory = vi.fn(() => doctorRepository());

    await act(async () => {
      root.render(<Harness
        orders={[makeOrder('order-a', null, null)]}
        doctorRepositoryFactory={doctorRepositoryFactory}
        onResult={(result) => { latest = result; }}
      />);
    });
    await flushQuery();

    expect(latest).toHaveProperty('referencesByOrderId');
    expect(latest).toHaveProperty('refetch');
    expect(latest).not.toHaveProperty('repository');
    expect(latest).not.toHaveProperty('doctorRepository');
    expect(latest).not.toHaveProperty('createOrder');
    expect(latest).not.toHaveProperty('updateOrder');
    expect(latest).not.toHaveProperty('addOrderWorkType');
    expect(latest).not.toHaveProperty('removeOrderWorkType');
  });
});
