// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LaboratoryWorkCompleteDialog, LaboratoryWorkReopenDialog } from './LaboratoryWorkLifecycleDialogs';
import type { LaboratoryWorkOrderRecord } from '../../../data/repositories/LaboratoryWorkRepository';

const order: LaboratoryWorkOrderRecord = {
  id: 'order-1', tenantId: 'tenant-1', patientId: 'patient-1', responsibleDoctorId: null, laboratoryId: null,
  orderNumber: null, title: 'Crown', status: 'in_progress', sentToLabAt: null, plannedReadyAt: null,
  receivedFromLabAt: null, tryInAt: null, deliveredToPatientAt: null, shade: null, anatomicalScope: null,
  selectedTeeth: [], comment: null, createdBy: null, updatedBy: null, mutationVersion: 3,
  createdAt: '2026-08-19T00:00:00.000Z', updatedAt: '2026-08-19T00:00:00.000Z',
};

describe('LaboratoryWorkLifecycleDialogs', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it('complete uses a deliberate confirmation action', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<LaboratoryWorkCompleteDialog order={order} onClose={vi.fn()} onConfirm={onConfirm} />));
    expect(container.textContent).toContain('Завершить работу?');
    await act(async () => (container.querySelector('[data-testid="laboratory-complete-confirm"]') as HTMLButtonElement).click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('reopen requires a non-empty reason before calling the action', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<LaboratoryWorkReopenDialog order={{ ...order, status: 'completed' }} onClose={vi.fn()} onConfirm={onConfirm} />));
    await act(async () => (container.querySelector('[data-testid="laboratory-reopen-confirm"]') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="laboratory-reopen-error"]')?.textContent).toContain('Укажите причину');
    expect(onConfirm).not.toHaveBeenCalled();

    const textarea = container.querySelector('[data-testid="laboratory-reopen-reason"]') as HTMLTextAreaElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, '  Ошибка в статусе  ');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => (container.querySelector('[data-testid="laboratory-reopen-confirm"]') as HTMLButtonElement).click());
    expect(onConfirm).toHaveBeenCalledWith('Ошибка в статусе');
  });
});
