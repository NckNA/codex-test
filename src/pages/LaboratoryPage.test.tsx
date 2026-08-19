// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LaboratoryWorkOrderRecord } from '../data/repositories/LaboratoryWorkRepository';
import { useLaboratoryWorkQueue, type UseLaboratoryWorkQueueResult } from '../data/hooks/useLaboratoryWorkQueue';
import { useLaboratoryWorkMutations, type UseLaboratoryWorkMutationsResult } from '../data/hooks/useLaboratoryWorkMutations';
import {
  usePatientLaboratoryWorkReferences,
  type UsePatientLaboratoryWorkReferencesResult,
} from '../data/hooks/usePatientLaboratoryWorkReferences';
import { useTenant } from '../contexts/TenantContext';
import { LaboratoryPage } from './LaboratoryPage';

vi.mock('../data/hooks/useLaboratoryWorkQueue', () => ({ useLaboratoryWorkQueue: vi.fn() }));
vi.mock('../data/hooks/useLaboratoryWorkMutations', () => ({ useLaboratoryWorkMutations: vi.fn() }));
vi.mock('../data/hooks/usePatientLaboratoryWorkReferences', () => ({ usePatientLaboratoryWorkReferences: vi.fn() }));
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

const mockedQueue = vi.mocked(useLaboratoryWorkQueue);
const mockedMutations = vi.mocked(useLaboratoryWorkMutations);
const mockedReferences = vi.mocked(usePatientLaboratoryWorkReferences);
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

function queueResult(overrides: Partial<UseLaboratoryWorkQueueResult> = {}): UseLaboratoryWorkQueueResult {
  return {
    orders: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
    patientNamesById: {},
    arePatientNamesLoading: false,
    arePatientNamesError: false,
    patientNamesError: null,
    refetchPatientNames: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function referenceResult(overrides: Partial<UsePatientLaboratoryWorkReferencesResult> = {}): UsePatientLaboratoryWorkReferencesResult {
  return {
    referencesByOrderId: {},
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mutationResult(overrides: Partial<UseLaboratoryWorkMutationsResult> = {}): UseLaboratoryWorkMutationsResult {
  return {
    available: false,
    loading: false,
    actionLoading: null,
    error: null,
    refreshWarning: null,
    pendingRetryAction: null,
    createOrder: vi.fn().mockResolvedValue(makeOrder({ id: 'mutation-result', patientId: 'patient-a', title: 'Mutation result' })),
    updateOrder: vi.fn().mockResolvedValue(makeOrder({ id: 'mutation-result', patientId: 'patient-a', title: 'Mutation result' })),
    completeOrder: vi.fn().mockResolvedValue(makeOrder({ id: 'mutation-result', patientId: 'patient-a', title: 'Mutation result' })),
    reopenOrder: vi.fn().mockResolvedValue(makeOrder({ id: 'mutation-result', patientId: 'patient-a', title: 'Mutation result' })),
    retryPendingMutation: vi.fn().mockResolvedValue(makeOrder({ id: 'mutation-result', patientId: 'patient-a', title: 'Mutation result' })),
    clearError: vi.fn(),
    clearRefreshWarning: vi.fn(),
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

describe('LaboratoryPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  const orderA = makeOrder({
    id: 'order-a',
    patientId: 'patient-a',
    title: 'Циркониевая коронка',
    orderNumber: 'LAB-A',
    responsibleDoctorId: 'doctor-a-raw',
    laboratoryId: 'lab-a-raw',
    plannedReadyAt: '2020-08-18T08:00:00.000Z',
  });
  const orderB = makeOrder({
    id: 'order-b',
    patientId: 'patient-b',
    title: 'Керамический мост',
    orderNumber: 'LAB-B',
    responsibleDoctorId: 'doctor-b-raw',
    laboratoryId: 'lab-b-raw',
    status: 'completed',
    plannedReadyAt: '2026-08-25T08:00:00.000Z',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedTenant.mockReturnValue({
      activeTenant: { tenantId: 'tenant-a', tenantName: 'Clinic A', role: 'clinic_admin', timezone: 'Asia/Almaty' },
    } as unknown as ReturnType<typeof useTenant>);
    mockedMutations.mockReturnValue(mutationResult());
    mockedQueue.mockReturnValue(queueResult({
      orders: [orderA, orderB],
      patientNamesById: { 'patient-a': 'Пациент А', 'patient-b': 'Пациент Б' },
    }));
    mockedReferences.mockReturnValue(referenceResult({
      referencesByOrderId: {
        'order-a': { responsibleDoctorName: 'Доктор А', laboratoryName: 'Лаборатория А', workTypeNames: ['Коронка', 'Цирконий'] },
        'order-b': { responsibleDoctorName: 'Доктор Б', laboratoryName: 'Лаборатория Б', workTypeNames: ['Мост'] },
      },
    }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render() {
    await act(async () => {
      root.render(<MemoryRouter><LaboratoryPage /></MemoryRouter>);
    });
  }

  it('renders a read-only tenant queue with human labels and overdue presentation', async () => {
    await render();

    expect(mockedQueue).toHaveBeenCalledWith();
    expect(mockedReferences).toHaveBeenCalledWith([orderA, orderB]);
    expect(container.textContent).toContain('Пациент А');
    expect(container.textContent).toContain('Доктор А');
    expect(container.textContent).toContain('Лаборатория А');
    expect(container.textContent).toContain('Коронка, Цирконий');
    expect(container.querySelector('[data-testid="laboratory-queue-order-order-a"]')?.textContent).toContain('Просрочено');
    expect(container.querySelector('[data-testid="laboratory-queue-order-order-b"]')?.textContent).toContain('Завершена');
    expect(container.textContent).not.toContain('doctor-a-raw');
    expect(container.textContent).not.toContain('lab-a-raw');
    expect(container.textContent).not.toContain('Создать лабораторную работу');
    expect(container.textContent).not.toContain('Редактировать');
    expect(container.textContent).not.toContain('Удалить');
  });

  it('filters the loaded queue by status, doctor, laboratory and search without mutations', async () => {
    await render();
    const rowA = () => container.querySelector('[data-testid="laboratory-queue-order-order-a"]');
    const rowB = () => container.querySelector('[data-testid="laboratory-queue-order-order-b"]');

    await changeValue(container.querySelector('[data-testid="laboratory-due-filter"]') as HTMLSelectElement, 'overdue');
    expect(rowA()).not.toBeNull();
    expect(rowB()).toBeNull();

    await changeValue(container.querySelector('[data-testid="laboratory-due-filter"]') as HTMLSelectElement, 'all');
    await changeValue(container.querySelector('[data-testid="laboratory-status-filter"]') as HTMLSelectElement, 'completed');
    expect(rowA()).toBeNull();
    expect(rowB()).not.toBeNull();

    await changeValue(container.querySelector('[data-testid="laboratory-status-filter"]') as HTMLSelectElement, 'all');
    await changeValue(container.querySelector('[data-testid="laboratory-doctor-filter"]') as HTMLSelectElement, 'doctor-a-raw');
    expect(rowA()).not.toBeNull();
    expect(rowB()).toBeNull();

    await changeValue(container.querySelector('[data-testid="laboratory-doctor-filter"]') as HTMLSelectElement, 'all');
    await changeValue(container.querySelector('[data-testid="laboratory-lab-filter"]') as HTMLSelectElement, 'lab-b-raw');
    expect(rowA()).toBeNull();
    expect(rowB()).not.toBeNull();

    await changeValue(container.querySelector('[data-testid="laboratory-lab-filter"]') as HTMLSelectElement, 'all');
    await changeValue(container.querySelector('[data-testid="laboratory-search"]') as HTMLInputElement, 'Пациент А');
    expect(rowA()).not.toBeNull();
    expect(rowB()).toBeNull();
  });

  it('shows a primary read error and retries only the queue read', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    mockedQueue.mockReturnValue(queueResult({ isError: true, error: new Error('queue failed'), refetch }));
    mockedReferences.mockReturnValue(referenceResult());

    await render();
    expect(container.querySelector('[data-testid="laboratory-page-error"]')?.textContent).toContain('Не удалось загрузить лабораторную очередь');
    const retry = container.querySelector('[data-testid="laboratory-page-error"] button') as HTMLButtonElement;
    await act(async () => retry.click());
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps orders visible when patient/reference labels fail and retries secondary reads separately', async () => {
    const refetchPatientNames = vi.fn().mockResolvedValue(undefined);
    const refetchReferences = vi.fn().mockResolvedValue(undefined);
    mockedQueue.mockReturnValue(queueResult({
      orders: [orderA],
      arePatientNamesError: true,
      patientNamesError: new Error('names failed'),
      refetchPatientNames,
    }));
    mockedReferences.mockReturnValue(referenceResult({ isError: true, error: new Error('refs failed'), refetch: refetchReferences }));

    await render();
    expect(container.textContent).toContain('Циркониевая коронка');
    expect(container.textContent).toContain('Имя пациента недоступно');
    expect(container.querySelector('[data-testid="laboratory-patient-names-error"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="laboratory-references-error"]')).not.toBeNull();

    const patientRetry = container.querySelector('[data-testid="laboratory-patient-names-error"] button') as HTMLButtonElement;
    const referenceRetry = container.querySelector('[data-testid="laboratory-references-error"] button') as HTMLButtonElement;
    await act(async () => {
      patientRetry.click();
      referenceRetry.click();
    });
    expect(refetchPatientNames).toHaveBeenCalledTimes(1);
    expect(refetchReferences).toHaveBeenCalledTimes(1);
  });

  it('creates only after explicit patient selection and keeps the selected patient fixed', async () => {
    const createOrder = vi.fn().mockResolvedValue(orderA);
    mockedMutations.mockReturnValue(mutationResult({ available: true, createOrder }));
    await render();

    await act(async () => (container.querySelector('[data-testid="laboratory-queue-create"]') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="picker-select-patient"]')).not.toBeNull();
    await act(async () => (container.querySelector('[data-testid="picker-select-patient"]') as HTMLButtonElement).click());
    const dialog = container.querySelector('[data-testid="queue-order-dialog"]') as HTMLElement;
    expect(dialog.dataset.patientId).toBe('patient-picked');
    expect(dialog.dataset.patientLabel).toContain('Выбранный пациент');
    expect(dialog.dataset.patientLabel).toContain('+77001234567');

    await act(async () => (container.querySelector('[data-testid="queue-order-submit"]') as HTMLButtonElement).click());
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'patient-picked' }));
  });

  it('reuses bounded edit, complete and reopen actions for an admin', async () => {
    const updateOrder = vi.fn().mockResolvedValue(orderA);
    const completeOrder = vi.fn().mockResolvedValue(orderA);
    const reopenOrder = vi.fn().mockResolvedValue(orderB);
    mockedMutations.mockReturnValue(mutationResult({ available: true, updateOrder, completeOrder, reopenOrder }));
    await render();

    await act(async () => (container.querySelector('[data-testid="laboratory-queue-edit-order-a"]') as HTMLButtonElement).click());
    expect((container.querySelector('[data-testid="queue-order-dialog"]') as HTMLElement).dataset.patientId).toBe('patient-a');
    await act(async () => (container.querySelector('[data-testid="queue-order-submit"]') as HTMLButtonElement).click());
    expect(updateOrder).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'order-a', expectedVersion: 1 }));

    await act(async () => (container.querySelector('[data-testid="laboratory-queue-complete-order-a"]') as HTMLButtonElement).click());
    await act(async () => (container.querySelector('[data-testid="queue-complete-confirm"]') as HTMLButtonElement).click());
    expect(completeOrder).toHaveBeenCalledWith({ orderId: 'order-a', expectedVersion: 1 });

    await act(async () => (container.querySelector('[data-testid="laboratory-queue-reopen-order-b"]') as HTMLButtonElement).click());
    await act(async () => (container.querySelector('[data-testid="queue-reopen-confirm"]') as HTMLButtonElement).click());
    expect(reopenOrder).toHaveBeenCalledWith({ orderId: 'order-b', expectedVersion: 1, reason: 'Исправить цвет' });
  });

  it('does not expose reopen to doctor and denies cashier even by direct route', async () => {
    mockedMutations.mockReturnValue(mutationResult({ available: true }));
    mockedTenant.mockReturnValue({ activeTenant: { tenantId: 'tenant-a', tenantName: 'Clinic A', role: 'doctor', timezone: 'Asia/Almaty' } } as unknown as ReturnType<typeof useTenant>);
    await render();
    expect(container.querySelector('[data-testid="laboratory-queue-create"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="laboratory-queue-reopen-order-b"]')).toBeNull();

    await act(async () => root.unmount());
    root = createRoot(container);
    mockedTenant.mockReturnValue({ activeTenant: { tenantId: 'tenant-a', tenantName: 'Clinic A', role: 'cashier', timezone: 'Asia/Almaty' } } as unknown as ReturnType<typeof useTenant>);
    await render();
    expect(container.querySelector('[data-testid="laboratory-page-no-access"]')?.textContent).toContain('Недостаточно прав');
    expect(container.querySelector('[data-testid="laboratory-queue-create"]')).toBeNull();
  });

  it('shows a version warning instead of actions when a queue row lacks mutationVersion', async () => {
    mockedMutations.mockReturnValue(mutationResult({ available: true }));
    mockedQueue.mockReturnValue(queueResult({ orders: [makeOrder({ ...orderA, mutationVersion: undefined })], patientNamesById: { 'patient-a': 'Пациент А' } }));
    await render();
    expect(container.querySelector('[data-testid="laboratory-queue-version-warning-order-a"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="laboratory-queue-edit-order-a"]')).toBeNull();
    expect(container.querySelector('[data-testid="laboratory-queue-complete-order-a"]')).toBeNull();
  });
});
