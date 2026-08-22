// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LaboratoryWorkOrderRecord } from '../data/repositories/LaboratoryWorkRepository';
import {
  useLaboratoryWorkPagedQueue,
  type UseLaboratoryWorkPagedQueueResult,
} from '../data/hooks/useLaboratoryWorkPagedQueue';
import {
  useLaboratoryWorkMutations,
  type UseLaboratoryWorkMutationsResult,
} from '../data/hooks/useLaboratoryWorkMutations';
import {
  useLaboratoryWorkRepository,
  type UseLaboratoryWorkRepositoryResult,
} from '../data/hooks/useLaboratoryWorkRepository';
import { useTenant } from '../contexts/TenantContext';
import { LaboratoryPage } from './LaboratoryPage';

vi.mock('../data/hooks/useLaboratoryWorkPagedQueue', () => ({ useLaboratoryWorkPagedQueue: vi.fn() }));
vi.mock('../data/hooks/useLaboratoryWorkMutations', () => ({ useLaboratoryWorkMutations: vi.fn() }));
vi.mock('../data/hooks/useLaboratoryWorkRepository', () => ({ useLaboratoryWorkRepository: vi.fn() }));
vi.mock('../components/laboratory/LaboratoryPatientPicker', () => ({
  LaboratoryPatientPicker: ({ onSelect }: { onSelect: (patient: { id: string; fullName: string; phone: string; status: string }) => void }) => (
    <button type="button" data-testid="picker-select-patient" onClick={() => onSelect({ id: 'patient-picked', fullName: 'Выбранный пациент', phone: '+77001234567', status: 'active' })}>Выбрать пациента</button>
  ),
}));
vi.mock('../components/patients/patient-card/LaboratoryWorkOrderDialog', () => ({
  LaboratoryWorkOrderDialog: ({ patientId, patientLabel, order, onSubmit }: { patientId: string; patientLabel?: string | null; order?: LaboratoryWorkOrderRecord | null; onSubmit: (submission: unknown) => Promise<void> | void }) => (
    <div data-testid="queue-order-dialog" data-patient-id={patientId} data-patient-label={patientLabel ?? ''}>
      <button type="button" data-testid="queue-order-submit" onClick={() => void onSubmit(order ? { mode: 'edit', input: { orderId: order.id, expectedVersion: order.mutationVersion, title: 'Edited' } } : { mode: 'create', input: { patientId, title: 'Created' } })}>Сохранить</button>
    </div>
  ),
}));
vi.mock('../components/patients/patient-card/LaboratoryWorkLifecycleDialogs', () => ({
  LaboratoryWorkCompleteDialog: ({ onConfirm }: { onConfirm: () => Promise<void> | void }) => <button type="button" data-testid="queue-complete-confirm" onClick={() => void onConfirm()}>Подтвердить завершение</button>,
  LaboratoryWorkReopenDialog: ({ onConfirm }: { onConfirm: (reason: string) => Promise<void> | void }) => <button type="button" data-testid="queue-reopen-confirm" onClick={() => void onConfirm('Исправить цвет')}>Подтвердить возврат</button>,
}));
vi.mock('../contexts/TenantContext', async () => {
  const actual = await vi.importActual<typeof import('../contexts/TenantContext')>('../contexts/TenantContext');
  return { ...actual, useTenant: vi.fn() };
});

const mockedPagedQueue = vi.mocked(useLaboratoryWorkPagedQueue);
const mockedMutations = vi.mocked(useLaboratoryWorkMutations);
const mockedRepository = vi.mocked(useLaboratoryWorkRepository);
const mockedTenant = vi.mocked(useTenant);

function makeOrder(options: Partial<LaboratoryWorkOrderRecord> & Pick<LaboratoryWorkOrderRecord, 'id' | 'patientId' | 'title'>): LaboratoryWorkOrderRecord {
  return {
    tenantId: 'tenant-a',
    responsibleDoctorId: null,
    laboratoryId: null,
    orderNumber: null,
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
    createdAt: '2026-08-10T08:00:00.000Z',
    updatedAt: '2026-08-10T08:00:00.000Z',
    ...options,
  };
}

function pagedResult(overrides: Partial<UseLaboratoryWorkPagedQueueResult> = {}): UseLaboratoryWorkPagedQueueResult {
  return {
    orders: [],
    totalFiltered: 0,
    limit: 50,
    offset: 0,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
    summary: { inProgress: 0, overdue: 0, completed: 0 },
    isSummaryLoading: false,
    isSummaryError: false,
    summaryError: null,
    refetchSummary: vi.fn().mockResolvedValue(undefined),
    patientNamesById: {},
    arePatientNamesLoading: false,
    arePatientNamesError: false,
    patientNamesError: null,
    refetchPatientNames: vi.fn().mockResolvedValue(undefined),
    referencesByOrderId: {},
    areReferencesLoading: false,
    areReferencesError: false,
    referencesError: null,
    refetchReferences: vi.fn().mockResolvedValue(undefined),
    filterOptions: { doctors: [], laboratories: [] },
    areFilterOptionsLoading: false,
    areFilterOptionsError: false,
    filterOptionsError: null,
    refetchFilterOptions: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mutationResult(overrides: Partial<UseLaboratoryWorkMutationsResult> = {}): UseLaboratoryWorkMutationsResult {
  const resultOrder = makeOrder({ id: 'mutation-result', patientId: 'patient-a', title: 'Mutation result' });
  return {
    available: false,
    loading: false,
    actionLoading: null,
    error: null,
    refreshWarning: null,
    pendingRetryAction: null,
    createOrder: vi.fn().mockResolvedValue(resultOrder),
    updateOrder: vi.fn().mockResolvedValue(resultOrder),
    completeOrder: vi.fn().mockResolvedValue(resultOrder),
    reopenOrder: vi.fn().mockResolvedValue(resultOrder),
    retryPendingMutation: vi.fn().mockResolvedValue(resultOrder),
    clearError: vi.fn(),
    clearRefreshWarning: vi.fn(),
    ...overrides,
  };
}

function repositoryResult(overrides: Partial<UseLaboratoryWorkRepositoryResult> = {}): UseLaboratoryWorkRepositoryResult {
  return {
    backend: 'supabase',
    tenantId: 'tenant-a',
    userId: 'user-a',
    ready: true,
    repository: null,
    ...overrides,
  };
}

async function changeValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLInputElement ? 'input' : 'change', { bubbles: true }));
  });
}

describe('LaboratoryPage paged queue UI', () => {
  let container: HTMLDivElement;
  let root: Root;

  const orderA = makeOrder({
    id: 'order-a',
    patientId: 'patient-a',
    title: 'Циркониевая коронка',
    orderNumber: 'LAB-A',
    responsibleDoctorId: 'doctor-a',
    laboratoryId: 'lab-a',
    plannedReadyAt: '2020-08-18T08:00:00.000Z',
  });
  const orderB = makeOrder({
    id: 'order-b',
    patientId: 'patient-b',
    title: 'Керамический мост',
    orderNumber: 'LAB-B',
    responsibleDoctorId: 'doctor-b',
    laboratoryId: 'lab-b',
    status: 'completed',
    plannedReadyAt: '2026-08-25T08:00:00.000Z',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedTenant.mockReturnValue({
      activeTenant: { tenantId: 'tenant-a', tenantName: 'Clinic A', role: 'clinic_admin', timezone: 'Asia/Almaty' },
    } as unknown as ReturnType<typeof useTenant>);
    mockedRepository.mockReturnValue(repositoryResult());
    mockedMutations.mockReturnValue(mutationResult());
    mockedPagedQueue.mockReturnValue(pagedResult({
      orders: [orderA, orderB],
      totalFiltered: 2,
      summary: { inProgress: 17, overdue: 4, completed: 29 },
      patientNamesById: { 'patient-a': 'Пациент А', 'patient-b': 'Пациент Б' },
      referencesByOrderId: {
        'order-a': { responsibleDoctorName: 'Доктор А', laboratoryName: 'Лаборатория А', workTypeNames: ['Коронка', 'Цирконий'] },
        'order-b': { responsibleDoctorName: 'Доктор Б', laboratoryName: 'Лаборатория Б', workTypeNames: ['Мост'] },
      },
      filterOptions: {
        doctors: [{ id: 'doctor-a', label: 'Доктор А' }, { id: 'doctor-b', label: 'Доктор Б' }],
        laboratories: [{ id: 'lab-a', label: 'Лаборатория А' }, { id: 'lab-b', label: 'Лаборатория Б' }],
      },
    }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await act(async () => root.unmount());
    container.remove();
  });

  async function render() {
    await act(async () => {
      root.render(<MemoryRouter><LaboratoryPage /></MemoryRouter>);
    });
  }

  it('renders server summary, page rows, human labels and pagination range', async () => {
    await render();

    expect(mockedPagedQueue).toHaveBeenCalledWith({
      status: undefined,
      responsibleDoctorId: undefined,
      laboratoryId: undefined,
      dueFilter: 'all',
      search: undefined,
      limit: 50,
      offset: 0,
    });
    expect(container.querySelector('[data-testid="laboratory-summary"]')?.textContent).toContain('17');
    expect(container.querySelector('[data-testid="laboratory-summary"]')?.textContent).toContain('29');
    expect(container.textContent).toContain('Пациент А');
    expect(container.textContent).toContain('Доктор А');
    expect(container.textContent).toContain('Лаборатория А');
    expect(container.textContent).toContain('Коронка, Цирконий');
    expect(container.querySelector('[data-testid="laboratory-queue-order-order-a"]')?.textContent).toContain('Просрочено');
    expect(container.querySelector('[data-testid="laboratory-pagination-range"]')?.textContent).toContain('Показано 1–2 из 2');
  });

  it('sends status, due, doctor and laboratory filters to the paged hook without client-side filtering', async () => {
    await render();

    await changeValue(container.querySelector('[data-testid="laboratory-status-filter"]') as HTMLSelectElement, 'completed');
    expect(mockedPagedQueue).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'completed', offset: 0 }));
    expect(container.querySelector('[data-testid="laboratory-queue-order-order-a"]')).not.toBeNull();

    await changeValue(container.querySelector('[data-testid="laboratory-due-filter"]') as HTMLSelectElement, 'overdue');
    expect(mockedPagedQueue).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'completed', dueFilter: 'overdue', offset: 0 }));

    await changeValue(container.querySelector('[data-testid="laboratory-doctor-filter"]') as HTMLSelectElement, 'doctor-b');
    expect(mockedPagedQueue).toHaveBeenLastCalledWith(expect.objectContaining({ responsibleDoctorId: 'doctor-b', offset: 0 }));

    await changeValue(container.querySelector('[data-testid="laboratory-lab-filter"]') as HTMLSelectElement, 'lab-b');
    expect(mockedPagedQueue).toHaveBeenLastCalledWith(expect.objectContaining({ laboratoryId: 'lab-b', offset: 0 }));
  });

  it('debounces server search by 300ms and resets the page identity to offset zero', async () => {
    vi.useFakeTimers();
    mockedPagedQueue.mockReturnValue(pagedResult({ orders: [orderA], totalFiltered: 120, patientNamesById: { 'patient-a': 'Пациент А' } }));
    await render();

    await act(async () => (container.querySelector('[data-testid="laboratory-page-next"]') as HTMLButtonElement).click());
    expect(mockedPagedQueue).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 50 }));

    await changeValue(container.querySelector('[data-testid="laboratory-search"]') as HTMLInputElement, '  Пациент А  ');
    expect(mockedPagedQueue).toHaveBeenLastCalledWith(expect.objectContaining({ search: undefined, offset: 50 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(mockedPagedQueue).toHaveBeenLastCalledWith(expect.objectContaining({ search: undefined, offset: 50 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mockedPagedQueue).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Пациент А', offset: 0 }));
  });

  it('advances by server limit and resets to page zero when page size changes', async () => {
    mockedPagedQueue.mockReturnValue(pagedResult({ orders: [orderA], totalFiltered: 120, limit: 50 }));
    await render();

    await act(async () => (container.querySelector('[data-testid="laboratory-page-next"]') as HTMLButtonElement).click());
    expect(mockedPagedQueue).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50, offset: 50 }));

    await changeValue(container.querySelector('[data-testid="laboratory-page-size"]') as HTMLSelectElement, '25');
    expect(mockedPagedQueue).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 25, offset: 0 }));
  });

  it('resets to the first page after the mutation refresh contract runs', async () => {
    mockedPagedQueue.mockReturnValue(pagedResult({ orders: [orderA], totalFiltered: 120, limit: 50 }));
    let refreshAfterMutation: (() => Promise<void> | void) | undefined;
    mockedMutations.mockImplementation((options) => {
      refreshAfterMutation = options?.refresh;
      return mutationResult({ available: true });
    });
    await render();

    await act(async () => (container.querySelector('[data-testid="laboratory-page-next"]') as HTMLButtonElement).click());
    expect(mockedPagedQueue).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 50 }));

    await act(async () => {
      await refreshAfterMutation?.();
    });
    expect(mockedPagedQueue).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 }));
  });

  it('keeps the canonical page visible when summary and secondary enrichments fail', async () => {
    const refetchSummary = vi.fn().mockResolvedValue(undefined);
    const refetchPatientNames = vi.fn().mockResolvedValue(undefined);
    const refetchReferences = vi.fn().mockResolvedValue(undefined);
    const refetchFilterOptions = vi.fn().mockResolvedValue(undefined);
    mockedPagedQueue.mockReturnValue(pagedResult({
      orders: [orderA],
      totalFiltered: 1,
      isSummaryError: true,
      refetchSummary,
      arePatientNamesError: true,
      refetchPatientNames,
      areReferencesError: true,
      refetchReferences,
      areFilterOptionsError: true,
      refetchFilterOptions,
    }));
    await render();

    expect(container.textContent).toContain('Циркониевая коронка');
    expect(container.querySelector('[data-testid="laboratory-summary-error"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="laboratory-patient-names-error"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="laboratory-references-error"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="laboratory-filter-options-error"]')).not.toBeNull();
  });

  it('shows primary server read errors separately and retries only the queue page', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    mockedPagedQueue.mockReturnValue(pagedResult({ isError: true, error: new Error('queue failed'), refetch }));
    await render();

    expect(container.querySelector('[data-testid="laboratory-page-error"]')?.textContent).toContain('Не удалось загрузить лабораторную очередь');
    await act(async () => (container.querySelector('[data-testid="laboratory-page-error"] button') as HTMLButtonElement).click());
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('fails closed in local prototype mode instead of falling back to the old broad queue', async () => {
    mockedRepository.mockReturnValue(repositoryResult({ backend: 'local', tenantId: 'local-tenant', userId: null, ready: true }));
    await render();

    expect(container.querySelector('[data-testid="laboratory-page-server-required"]')?.textContent).toContain('Серверная лабораторная очередь');
    expect(container.querySelector('[data-testid="laboratory-order-list"]')).toBeNull();
  });

  it('keeps explicit patient selection and bounded mutation actions', async () => {
    const createOrder = vi.fn().mockResolvedValue(orderA);
    const updateOrder = vi.fn().mockResolvedValue(orderA);
    const completeOrder = vi.fn().mockResolvedValue(orderA);
    const reopenOrder = vi.fn().mockResolvedValue(orderB);
    mockedMutations.mockReturnValue(mutationResult({ available: true, createOrder, updateOrder, completeOrder, reopenOrder }));
    await render();

    await act(async () => (container.querySelector('[data-testid="laboratory-queue-create"]') as HTMLButtonElement).click());
    await act(async () => (container.querySelector('[data-testid="picker-select-patient"]') as HTMLButtonElement).click());
    const dialog = container.querySelector('[data-testid="queue-order-dialog"]') as HTMLElement;
    expect(dialog.dataset.patientId).toBe('patient-picked');
    expect(dialog.dataset.patientLabel).toContain('Выбранный пациент');
    await act(async () => (container.querySelector('[data-testid="queue-order-submit"]') as HTMLButtonElement).click());
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'patient-picked' }));

    await act(async () => (container.querySelector('[data-testid="laboratory-queue-edit-order-a"]') as HTMLButtonElement).click());
    await act(async () => (container.querySelector('[data-testid="queue-order-submit"]') as HTMLButtonElement).click());
    expect(updateOrder).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'order-a', expectedVersion: 1 }));

    await act(async () => (container.querySelector('[data-testid="laboratory-queue-complete-order-a"]') as HTMLButtonElement).click());
    await act(async () => (container.querySelector('[data-testid="queue-complete-confirm"]') as HTMLButtonElement).click());
    expect(completeOrder).toHaveBeenCalledWith({ orderId: 'order-a', expectedVersion: 1 });

    await act(async () => (container.querySelector('[data-testid="laboratory-queue-reopen-order-b"]') as HTMLButtonElement).click());
    await act(async () => (container.querySelector('[data-testid="queue-reopen-confirm"]') as HTMLButtonElement).click());
    expect(reopenOrder).toHaveBeenCalledWith({ orderId: 'order-b', expectedVersion: 1, reason: 'Исправить цвет' });
  });

  it('preserves role and mutation-version gates', async () => {
    mockedMutations.mockReturnValue(mutationResult({ available: true }));
    mockedTenant.mockReturnValue({ activeTenant: { tenantId: 'tenant-a', tenantName: 'Clinic A', role: 'doctor', timezone: 'Asia/Almaty' } } as unknown as ReturnType<typeof useTenant>);
    await render();
    expect(container.querySelector('[data-testid="laboratory-queue-create"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="laboratory-queue-reopen-order-b"]')).toBeNull();

    await act(async () => root.unmount());
    root = createRoot(container);
    mockedTenant.mockReturnValue({ activeTenant: { tenantId: 'tenant-a', tenantName: 'Clinic A', role: 'clinic_admin', timezone: 'Asia/Almaty' } } as unknown as ReturnType<typeof useTenant>);
    mockedPagedQueue.mockReturnValue(pagedResult({
      orders: [makeOrder({ ...orderA, mutationVersion: undefined })],
      totalFiltered: 1,
      patientNamesById: { 'patient-a': 'Пациент А' },
    }));
    await render();
    expect(container.querySelector('[data-testid="laboratory-queue-version-warning-order-a"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="laboratory-queue-edit-order-a"]')).toBeNull();

    await act(async () => root.unmount());
    root = createRoot(container);
    mockedPagedQueue.mockClear();
    mockedRepository.mockClear();
    mockedMutations.mockClear();
    mockedTenant.mockReturnValue({ activeTenant: { tenantId: 'tenant-a', tenantName: 'Clinic A', role: 'cashier', timezone: 'Asia/Almaty' } } as unknown as ReturnType<typeof useTenant>);
    await render();
    expect(container.querySelector('[data-testid="laboratory-page-no-access"]')?.textContent).toContain('Недостаточно прав');
    expect(mockedPagedQueue).not.toHaveBeenCalled();
    expect(mockedRepository).not.toHaveBeenCalled();
    expect(mockedMutations).not.toHaveBeenCalled();
  });
});
