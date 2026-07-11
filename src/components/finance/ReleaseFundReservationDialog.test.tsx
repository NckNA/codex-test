// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatientFundReservation } from '../../data/repositories/FinanceRepository';
import { ReleaseFundReservationDialog } from './ReleaseFundReservationDialog';

const reservation = { id: 'reservation-1', tenantId: 'tenant-1', patientId: 'patient-1', paymentId: 'payment-1', currency: 'KZT', purposeType: 'general', purposeLabel: null, appointmentId: null, treatmentPlanId: null, originalAmount: 300, consumedAmount: 50, releasedAmount: 0, remainingAmount: 250, status: 'partially_used', expiresAt: null, notes: null, createdAt: '2026-07-11T00:00:00Z', updatedAt: null, releasedAt: null, archivedAt: null } as PatientFundReservation;

describe('ReleaseFundReservationDialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(overrides: Partial<React.ComponentProps<typeof ReleaseFundReservationDialog>> = {}) {
    const props: React.ComponentProps<typeof ReleaseFundReservationDialog> = {
      open: true,
      reservation,
      pending: false,
      actionMessage: null,
      onClose: vi.fn(),
      onSubmit: vi.fn(),
      ...overrides,
    };
    await act(async () => { root.render(<ReleaseFundReservationDialog {...props} />); });
    return props;
  }

  it('shows full-release warning without refund language', async () => {
    await render();
    expect(container.textContent).toContain('250');
    expect(container.textContent).toContain('вернуть сумму в доступный кредит');
    expect(container.textContent).toContain('Это не возврат денег пациенту');
  });

  it('requires a release reason', async () => {
    const props = await render();
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="fund-reservation-release-submit"]')?.click(); });
    expect(container.textContent).toContain('Укажите причину освобождения резерва');
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('submits reservation id and trimmed reason with no partial amount', async () => {
    const props = await render();
    const field = container.querySelector<HTMLTextAreaElement>('[data-testid="fund-reservation-release-reason"]');
    await act(async () => {
      if (field) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        setter?.call(field, '  Отмена записи  ');
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="fund-reservation-release-submit"]')?.click(); });
    expect(props.onSubmit).toHaveBeenCalledWith({ reservationId: reservation.id, reason: 'Отмена записи' });
  });

  it('blocks duplicate submit while pending and closes with Escape otherwise', async () => {
    const pendingProps = await render({ pending: true });
    expect(container.querySelector<HTMLButtonElement>('[data-testid="fund-reservation-release-submit"]')?.disabled).toBe(true);
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(pendingProps.onClose).not.toHaveBeenCalled();
    const props = await render({ pending: false });
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(props.onClose).toHaveBeenCalled();
  });
});
