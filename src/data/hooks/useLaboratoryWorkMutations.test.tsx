// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLaboratoryWorkRepository } from './useLaboratoryWorkRepository';
import {
  useLaboratoryWorkMutations,
  type UseLaboratoryWorkMutationsResult,
  type CreateLaboratoryWorkOrderActionInput,
} from './useLaboratoryWorkMutations';
import {
  LaboratoryWorkMutationClientError,
  type LaboratoryWorkMutationRpcClient,
} from '../repositories/LaboratoryWorkMutationRpcClient';
import type { LaboratoryWorkOrderRecord } from '../repositories/LaboratoryWorkRepository';

vi.mock('./useLaboratoryWorkRepository', () => ({
  useLaboratoryWorkRepository: vi.fn(),
}));

const mockedSelection = vi.mocked(useLaboratoryWorkRepository);
const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const patientId = '33333333-3333-4333-8333-333333333333';
const orderId = '44444444-4444-4444-8444-444444444444';

const baseOrder: LaboratoryWorkOrderRecord = {
  id: orderId,
  tenantId,
  patientId,
  responsibleDoctorId: null,
  laboratoryId: null,
  orderNumber: null,
  title: 'Crown',
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
  createdBy: userId,
  updatedBy: userId,
  mutationVersion: 1,
  createdAt: '2026-08-19T08:00:00Z',
  updatedAt: '2026-08-19T08:00:00Z',
};

const desiredInput: CreateLaboratoryWorkOrderActionInput = {
  patientId,
  responsibleDoctorId: null,
  laboratoryId: null,
  orderNumber: null,
  title: 'Crown',
  sentToLabAt: null,
  plannedReadyAt: null,
  receivedFromLabAt: null,
  tryInAt: null,
  deliveredToPatientAt: null,
  shade: null,
  anatomicalScope: null,
  selectedTeeth: [],
  comment: null,
  workTypeIds: [],
};

function setSupabaseSelection(overrides: Partial<ReturnType<typeof useLaboratoryWorkRepository>> = {}) {
  mockedSelection.mockReturnValue({
    backend: 'supabase',
    tenantId,
    userId,
    ready: true,
    repository: null,
    ...overrides,
  });
}

function createRpcClient(): LaboratoryWorkMutationRpcClient {
  return {
    createOrder: vi.fn().mockResolvedValue(baseOrder),
    updateOrder: vi.fn().mockResolvedValue({ ...baseOrder, mutationVersion: 2, title: 'Updated' }),
    completeOrder: vi.fn().mockResolvedValue({ ...baseOrder, mutationVersion: 2, status: 'completed' }),
    reopenOrder: vi.fn().mockResolvedValue({ ...baseOrder, mutationVersion: 3, status: 'in_progress' }),
  };
}

describe('useLaboratoryWorkMutations', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseLaboratoryWorkMutationsResult | null;
  let refresh: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let rpcClient: LaboratoryWorkMutationRpcClient;
  let identities: string[];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
    refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    rpcClient = createRpcClient();
    identities = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
    setSupabaseSelection();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  function identityFactory() {
    const next = identities.shift();
    if (!next) throw new Error('No test identity left');
    return next;
  }

  function Probe() {
    latest = useLaboratoryWorkMutations({ refresh, rpcClient, identityFactory });
    return null;
  }

  async function render() {
    await act(async () => root.render(<Probe />));
  }

  it('uses the accepted Supabase selection and generates stable create order/request identity', async () => {
    await render();
    expect(latest?.available).toBe(true);

    let result: LaboratoryWorkOrderRecord | undefined;
    await act(async () => {
      result = await latest?.createOrder(desiredInput);
    });

    expect(result).toEqual(baseOrder);
    expect(rpcClient.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      patientId,
      orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      requestId: 'laboratory-create:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(latest?.pendingRetryAction).toBeNull();
  });

  it.each([
    { backend: 'local' as const, ready: true, tenantId: 'local-dev', userId },
    { backend: 'unavailable' as const, ready: false, tenantId: null, userId },
    { backend: 'unavailable' as const, ready: false, tenantId, userId: null },
  ])('fails closed for selection $backend/$ready without calling RPC', async (selection) => {
    mockedSelection.mockReturnValue({ ...selection, repository: null });
    await render();
    expect(latest?.available).toBe(false);

    await expect(latest?.createOrder(desiredInput)).rejects.toMatchObject({ category: 'validation' });
    expect(rpcClient.createOrder).not.toHaveBeenCalled();
  });

  it('keeps an uncertain create captured and retries with the exact same order/request identity', async () => {
    const uncertain = new LaboratoryWorkMutationClientError({
      operation: 'create',
      category: 'operation_uncertain',
      message: 'Не удалось подтвердить результат операции.',
    });
    vi.mocked(rpcClient.createOrder)
      .mockRejectedValueOnce(uncertain)
      .mockResolvedValueOnce(baseOrder);
    await render();

    await act(async () => {
      await latest?.createOrder(desiredInput).catch(() => undefined);
    });
    const firstCall = vi.mocked(rpcClient.createOrder).mock.calls[0][0];
    expect(latest?.pendingRetryAction).toBe('create');

    await act(async () => {
      await latest?.retryPendingMutation();
    });
    const secondCall = vi.mocked(rpcClient.createOrder).mock.calls[1][0];

    expect(secondCall.orderId).toBe(firstCall.orderId);
    expect(secondCall.requestId).toBe(firstCall.requestId);
    expect(secondCall).toEqual(firstCall);
    expect(latest?.pendingRetryAction).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('maps stale update as a safe conflict and refetches canonical state', async () => {
    vi.mocked(rpcClient.updateOrder).mockRejectedValueOnce(new LaboratoryWorkMutationClientError({
      operation: 'update',
      category: 'stale',
      code: 'LAB_ORDER_STALE_WRITE',
      message: 'Лабораторная работа уже изменена. Обновите данные перед повтором.',
    }));
    await render();

    await act(async () => {
      await latest?.updateOrder({
        ...desiredInput,
        orderId,
        expectedVersion: 1,
      }).catch(() => undefined);
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(latest?.error).toMatchObject({ category: 'stale', code: 'LAB_ORDER_STALE_WRITE' });
    expect(latest?.pendingRetryAction).toBeNull();
  });

  it('accepts committed result even when post-commit refresh fails and exposes a warning', async () => {
    refresh.mockRejectedValueOnce(new Error('read failed'));
    await render();

    let result: LaboratoryWorkOrderRecord | undefined;
    await act(async () => {
      result = await latest?.completeOrder({ orderId, expectedVersion: 1 });
    });

    expect(result?.status).toBe('completed');
    expect(latest?.error).toBeNull();
    expect(latest?.refreshWarning).toContain('сохранено');
  });

  it('passes mutation version and explicit reopen reason through lifecycle commands', async () => {
    await render();

    await act(async () => {
      await latest?.completeOrder({ orderId, expectedVersion: 7 });
      await latest?.reopenOrder({ orderId, expectedVersion: 8, reason: 'Correction required' });
    });

    expect(rpcClient.completeOrder).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      orderId,
      expectedVersion: 7,
      requestId: expect.stringMatching(/^laboratory-complete:/),
    }));
    expect(rpcClient.reopenOrder).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      orderId,
      expectedVersion: 8,
      reason: 'Correction required',
      requestId: expect.stringMatching(/^laboratory-reopen:/),
    }));
  });

  it('clears uncertain retry state on tenant/user context change', async () => {
    vi.mocked(rpcClient.createOrder).mockRejectedValueOnce(new LaboratoryWorkMutationClientError({
      operation: 'create',
      category: 'operation_uncertain',
      message: 'uncertain',
    }));
    await render();
    await act(async () => {
      await latest?.createOrder(desiredInput).catch(() => undefined);
    });
    expect(latest?.pendingRetryAction).toBe('create');

    setSupabaseSelection({ tenantId: '99999999-9999-4999-8999-999999999999' });
    await render();
    expect(latest?.pendingRetryAction).toBeNull();
    await expect(latest?.retryPendingMutation()).rejects.toThrow('Нет операции');
    expect(rpcClient.createOrder).toHaveBeenCalledTimes(1);
  });

  it('blocks a second mutation while another one is in flight', async () => {
    let resolveCreate!: (value: LaboratoryWorkOrderRecord) => void;
    vi.mocked(rpcClient.createOrder).mockImplementationOnce(() => new Promise((resolve) => {
      resolveCreate = resolve;
    }));
    await render();

    let first!: Promise<LaboratoryWorkOrderRecord>;
    await act(async () => {
      first = latest!.createOrder(desiredInput);
      await Promise.resolve();
    });

    await expect(latest?.completeOrder({ orderId, expectedVersion: 1 })).rejects.toThrow('уже выполняется');
    expect(rpcClient.completeOrder).not.toHaveBeenCalled();

    await act(async () => {
      resolveCreate(baseOrder);
      await first;
    });
    expect(rpcClient.createOrder).toHaveBeenCalledTimes(1);
  });
});
