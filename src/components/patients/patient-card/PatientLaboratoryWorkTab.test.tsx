// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatInstantInTenant } from '../../../domain/timezone';
import type { LaboratoryWorkOrderRecord } from '../../../data/repositories/LaboratoryWorkRepository';
import {
  usePatientLaboratoryWorkOrders,
  type UsePatientLaboratoryWorkOrdersResult,
} from '../../../data/hooks/usePatientLaboratoryWorkOrders';
import { PatientLaboratoryWorkTab } from './PatientLaboratoryWorkTab';

vi.mock('../../../data/hooks/usePatientLaboratoryWorkOrders', () => ({
  usePatientLaboratoryWorkOrders: vi.fn(),
}));

const mockedUsePatientLaboratoryWorkOrders = vi.mocked(usePatientLaboratoryWorkOrders);

function order(overrides: Partial<LaboratoryWorkOrderRecord> = {}): LaboratoryWorkOrderRecord {
  return {
    id: 'order-1',
    tenantId: 'tenant-1',
    patientId: 'patient-1',
    responsibleDoctorId: 'doctor-raw-uuid',
    laboratoryId: 'laboratory-raw-uuid',
    orderNumber: 'LAB-001',
    title: 'Циркониевая коронка',
    status: 'in_progress',
    sentToLabAt: '2026-08-19T05:00:00.000Z',
    plannedReadyAt: '2026-08-21T07:30:00.000Z',
    receivedFromLabAt: null,
    tryInAt: '2026-08-22T06:00:00.000Z',
    deliveredToPatientAt: null,
    shade: 'A2',
    anatomicalScope: 'selected_teeth',
    selectedTeeth: [11, 12],
    comment: 'Проверить контактный пункт',
    createdBy: null,
    updatedBy: null,
    createdAt: '2026-08-19T04:00:00.000Z',
    updatedAt: '2026-08-19T05:30:00.000Z',
    ...overrides,
  };
}

function result(overrides: Partial<UsePatientLaboratoryWorkOrdersResult> = {}): UsePatientLaboratoryWorkOrdersResult {
  return {
    orders: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('PatientLaboratoryWorkTab', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(patientId = 'patient-1', timezone = 'Asia/Almaty') {
    await act(async () => {
      root.render(<PatientLaboratoryWorkTab patientId={patientId} timezone={timezone} />);
    });
  }

  it('forwards the current patient id and shows loading state', async () => {
    mockedUsePatientLaboratoryWorkOrders.mockReturnValue(result({ isLoading: true }));

    await render('patient-a');

    expect(mockedUsePatientLaboratoryWorkOrders).toHaveBeenCalledWith('patient-a');
    expect(container.querySelector('[data-testid="laboratory-work-loading"]')?.textContent).toContain('Загрузка');
  });

  it('shows a safe empty state', async () => {
    mockedUsePatientLaboratoryWorkOrders.mockReturnValue(result());

    await render();

    expect(container.querySelector('[data-testid="laboratory-work-empty"]')?.textContent)
      .toContain('У пациента нет лабораторных работ');
  });

  it('shows an error state and retries only through the read hook', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    mockedUsePatientLaboratoryWorkOrders.mockReturnValue(result({
      isError: true,
      error: new Error('load failed'),
      refetch,
    }));

    await render();
    const retry = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Повторить') as HTMLButtonElement;

    await act(async () => retry.click());

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders safe operational facts in tenant timezone without raw reference ids', async () => {
    const current = order();
    mockedUsePatientLaboratoryWorkOrders.mockReturnValue(result({ orders: [current] }));

    await render();

    const text = container.textContent ?? '';
    expect(text).toContain('Циркониевая коронка');
    expect(text).toContain('№ LAB-001');
    expect(text).toContain('В работе');
    expect(text).toContain('A2');
    expect(text).toContain('Выбранные зубы: 11, 12');
    expect(text).toContain('Проверить контактный пункт');
    expect(text).toContain(formatInstantInTenant(current.plannedReadyAt!, 'Asia/Almaty', { dateStyle: 'medium', timeStyle: 'short' }));
    expect(text).toContain(formatInstantInTenant(current.tryInAt!, 'Asia/Almaty', { dateStyle: 'medium', timeStyle: 'short' }));
    expect(text).not.toContain('doctor-raw-uuid');
    expect(text).not.toContain('laboratory-raw-uuid');
  });

  it('renders completed status and hides absent optional fields without mutation controls', async () => {
    mockedUsePatientLaboratoryWorkOrders.mockReturnValue(result({
      orders: [order({
        id: 'order-2',
        orderNumber: null,
        status: 'completed',
        sentToLabAt: null,
        plannedReadyAt: null,
        receivedFromLabAt: null,
        tryInAt: null,
        deliveredToPatientAt: null,
        shade: null,
        anatomicalScope: null,
        selectedTeeth: [],
        comment: null,
      })],
    }));

    await render();

    const text = container.textContent ?? '';
    expect(text).toContain('Завершена');
    expect(text).not.toContain('№ null');
    expect(text).not.toContain('Оттенок');
    expect(text).not.toContain('Анатомическая область');

    const buttonLabels = Array.from(container.querySelectorAll('button'))
      .map((button) => button.textContent?.trim());
    expect(buttonLabels).not.toContain('Создать');
    expect(buttonLabels).not.toContain('Редактировать');
    expect(buttonLabels).not.toContain('Удалить');
  });
});
