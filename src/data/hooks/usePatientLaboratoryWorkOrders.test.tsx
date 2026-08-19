// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ILaboratoryWorkRepository,
  LaboratoryWorkOrderRecord,
} from '../repositories/LaboratoryWorkRepository';
import {
  useLaboratoryWorkRepository,
  type UseLaboratoryWorkRepositoryResult,
} from './useLaboratoryWorkRepository';
import {
  usePatientLaboratoryWorkOrders,
  type UsePatientLaboratoryWorkOrdersResult,
} from './usePatientLaboratoryWorkOrders';

vi.mock('./useLaboratoryWorkRepository', () => ({
  useLaboratoryWorkRepository: vi.fn(),
}));

const mockedUseLaboratoryWorkRepository = vi.mocked(useLaboratoryWorkRepository);

function makeOrder(patientId: string, id: string): LaboratoryWorkOrderRecord {
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

function repositoryWithListOrders(
  listOrders: ILaboratoryWorkRepository['listOrders'],
): ILaboratoryWorkRepository {
  return { listOrders } as ILaboratoryWorkRepository;
}

function Harness({
  patientId,
  onResult,
}: {
  patientId: string | null | undefined;
  onResult: (result: UsePatientLaboratoryWorkOrdersResult) => void;
}) {
  const result = usePatientLaboratoryWorkOrders(patientId);
  onResult(result);
  return null;
}

async function flushQuery() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('usePatientLaboratoryWorkOrders', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UsePatientLaboratoryWorkOrdersResult | null;

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

  it('does not call listOrders when the laboratory repository is unavailable', async () => {
    const listOrders = vi.fn<ILaboratoryWorkRepository['listOrders']>().mockResolvedValue([]);
    const repository = repositoryWithListOrders(listOrders);
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(repository, {
      backend: 'unavailable',
      ready: false,
      tenantId: null,
      repository,
    }));

    await act(async () => {
      root.render(<Harness patientId="patient-a" onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();

    expect(listOrders).not.toHaveBeenCalled();
    expect(latest).toMatchObject({
      orders: [],
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it('queries strictly for patient A', async () => {
    const orderA = makeOrder('patient-a', 'order-a');
    const listOrders = vi.fn<ILaboratoryWorkRepository['listOrders']>().mockResolvedValue([orderA]);
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(repositoryWithListOrders(listOrders)));

    await act(async () => {
      root.render(<Harness patientId="patient-a" onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();

    expect(listOrders).toHaveBeenCalledTimes(1);
    expect(listOrders).toHaveBeenCalledWith({ patientId: 'patient-a' });
    expect(latest?.orders).toEqual([orderA]);
  });

  it('switches from patient A to patient B without keeping patient A orders visible', async () => {
    const orderA = makeOrder('patient-a', 'order-a');
    const orderB = makeOrder('patient-b', 'order-b');
    const listOrders = vi.fn<ILaboratoryWorkRepository['listOrders']>()
      .mockImplementation(async (filters = {}) => {
        if (filters.patientId === 'patient-a') return [orderA];
        if (filters.patientId === 'patient-b') return [orderB];
        return [];
      });
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(repositoryWithListOrders(listOrders)));

    await act(async () => {
      root.render(<Harness patientId="patient-a" onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();
    expect(latest?.orders).toEqual([orderA]);

    await act(async () => {
      root.render(<Harness patientId="patient-b" onResult={(result) => { latest = result; }} />);
    });

    expect(latest?.orders).not.toEqual([orderA]);
    await flushQuery();

    expect(listOrders).toHaveBeenNthCalledWith(1, { patientId: 'patient-a' });
    expect(listOrders).toHaveBeenNthCalledWith(2, { patientId: 'patient-b' });
    expect(latest?.orders).toEqual([orderB]);
  });

  it.each([null, undefined, '', '   '])('keeps an empty/invalid patientId in a safe disabled state: %s', async (patientId) => {
    const listOrders = vi.fn<ILaboratoryWorkRepository['listOrders']>().mockResolvedValue([]);
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(repositoryWithListOrders(listOrders)));

    await act(async () => {
      root.render(<Harness patientId={patientId} onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();

    expect(listOrders).not.toHaveBeenCalled();
    expect(latest).toMatchObject({
      orders: [],
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it('preserves the 001C tenant/backend selection and exposes no repository mutation surface', async () => {
    const order = makeOrder('patient-a', 'order-a');
    const listOrders = vi.fn<ILaboratoryWorkRepository['listOrders']>().mockResolvedValue([order]);
    mockedUseLaboratoryWorkRepository.mockReturnValue(selection(repositoryWithListOrders(listOrders), {
      backend: 'supabase',
      tenantId: 'tenant-1',
      userId: 'user-1',
      ready: true,
    }));

    await act(async () => {
      root.render(<Harness patientId="patient-a" onResult={(result) => { latest = result; }} />);
    });
    await flushQuery();

    expect(mockedUseLaboratoryWorkRepository).toHaveBeenCalled();
    expect(listOrders).toHaveBeenCalledWith({ patientId: 'patient-a' });
    expect(latest).not.toHaveProperty('repository');
    expect(latest).not.toHaveProperty('createOrder');
    expect(latest).not.toHaveProperty('updateOrder');
    expect(latest).not.toHaveProperty('addOrderWorkType');
    expect(latest).not.toHaveProperty('removeOrderWorkType');
  });
});
