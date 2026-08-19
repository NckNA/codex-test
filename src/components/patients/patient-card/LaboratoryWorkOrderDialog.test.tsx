// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LaboratoryWorkOrderDialog } from './LaboratoryWorkOrderDialog';
import { useLaboratoryMutationOptions, type UseLaboratoryMutationOptionsResult } from '../../../data/hooks/useLaboratoryMutationOptions';
import type { LaboratoryWorkOrderRecord } from '../../../data/repositories/LaboratoryWorkRepository';

vi.mock('../../../data/hooks/useLaboratoryMutationOptions', () => ({ useLaboratoryMutationOptions: vi.fn() }));
const mockedOptions = vi.mocked(useLaboratoryMutationOptions);

function options(overrides: Partial<UseLaboratoryMutationOptionsResult> = {}): UseLaboratoryMutationOptionsResult {
  return {
    doctors: [{ id: 'doctor-active', name: 'Doctor Active', active: true }, { id: 'doctor-old', name: 'Doctor Old', active: false }],
    laboratories: [{ id: 'lab-active', tenantId: 'tenant-1', name: 'Lab Active', active: true, notes: null, createdAt: 'x', updatedAt: 'x' }, { id: 'lab-old', tenantId: 'tenant-1', name: 'Lab Old', active: false, notes: null, createdAt: 'x', updatedAt: 'x' }],
    workTypes: [{ id: 'type-active', tenantId: 'tenant-1', name: 'Crown', code: 'CR', active: true, sortOrder: 1, createdAt: 'x', updatedAt: 'x' }, { id: 'type-old', tenantId: 'tenant-1', name: 'Old', code: null, active: false, sortOrder: 2, createdAt: 'x', updatedAt: 'x' }],
    selectedWorkTypeIds: [],
    ready: true,
    loading: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function order(overrides: Partial<LaboratoryWorkOrderRecord> = {}): LaboratoryWorkOrderRecord {
  return {
    id: 'order-1', tenantId: 'tenant-1', patientId: 'patient-1', responsibleDoctorId: 'doctor-old', laboratoryId: 'lab-old', orderNumber: 'LAB-1', title: 'Crown', status: 'in_progress',
    sentToLabAt: '2026-08-19T05:00:00.000Z', plannedReadyAt: null, receivedFromLabAt: null, tryInAt: null, deliveredToPatientAt: null, shade: 'A2', anatomicalScope: 'selected_teeth', selectedTeeth: [11, 12], comment: 'note', createdBy: null, updatedBy: null, mutationVersion: 7, createdAt: '2026-08-19T04:00:00.000Z', updatedAt: '2026-08-19T05:30:00.000Z', ...overrides,
  };
}

describe('LaboratoryWorkOrderDialog', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSubmit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedOptions.mockReturnValue(options());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  async function render(current?: LaboratoryWorkOrderRecord) {
    await act(async () => root.render(<LaboratoryWorkOrderDialog patientId="patient-1" timezone="Asia/Almaty" order={current} onClose={vi.fn()} onSubmit={onSubmit} />));
  }

  it('keeps patient fixed and blocks submit until required title is present', async () => {
    await render();
    expect(container.textContent).toContain('Пациент: текущая карточка');
    const submit = container.querySelector('[data-testid="laboratory-form-submit"]') as HTMLButtonElement;
    await act(async () => submit.click());
    expect(container.querySelector('[data-testid="laboratory-form-error"]')?.textContent).toContain('Название работы обязательно');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('creates a normalized desired state with tenant timezone conversion and sorted FDI teeth', async () => {
    await render();
    const fill = (testId: string, value: string) => {
      const input = container.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    await act(async () => {
      fill('laboratory-form-title', '  New crown  ');
      fill('laboratory-form-teeth', '12, 51, 11, 12');
      fill('laboratory-form-ready', '2026-08-20T10:00');
    });
    await act(async () => (container.querySelector('[data-testid="laboratory-form-submit"]') as HTMLButtonElement).click());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submission = onSubmit.mock.calls[0][0];
    expect(submission.mode).toBe('create');
    expect(submission.input.patientId).toBe('patient-1');
    expect(submission.input.title).toBe('New crown');
    expect(submission.input.selectedTeeth).toEqual([11, 12, 51]);
    expect(submission.input.plannedReadyAt).toBe('2026-08-20T05:00:00.000Z');
  });

  it('preserves currently selected inactive historical references on edit and passes exact expectedVersion', async () => {
    mockedOptions.mockReturnValue(options({ selectedWorkTypeIds: ['type-old'] }));
    await render(order());
    expect((container.querySelector('[data-testid="laboratory-form-doctor"]') as HTMLSelectElement).textContent).toContain('Doctor Old (архив)');
    expect((container.querySelector('[data-testid="laboratory-form-laboratory"]') as HTMLSelectElement).textContent).toContain('Lab Old (архив)');
    expect(container.textContent).toContain('Old · архив');
    await act(async () => (container.querySelector('[data-testid="laboratory-form-submit"]') as HTMLButtonElement).click());
    const submission = onSubmit.mock.calls[0][0];
    expect(submission.mode).toBe('edit');
    expect(submission.input.expectedVersion).toBe(7);
    expect(submission.input.workTypeIds).toEqual(['type-old']);
  });

  it('blocks edit when mutationVersion is missing', async () => {
    await render(order({ mutationVersion: undefined }));
    await act(async () => (container.querySelector('[data-testid="laboratory-form-submit"]') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="laboratory-form-error"]')?.textContent).toContain('Обновите текущие данные');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
