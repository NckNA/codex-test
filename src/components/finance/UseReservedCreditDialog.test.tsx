// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invoice, PatientFundReservation } from '../../data/repositories/FinanceRepository';
import { UseReservedCreditDialog } from './UseReservedCreditDialog';

const reservation = { id: 'reservation-1', tenantId: 'tenant-1', patientId: 'patient-1', paymentId: 'payment-1', currency: 'KZT', purposeType: 'service', purposeLabel: 'Имплантация', appointmentId: null, treatmentPlanId: null, originalAmount: 400, consumedAmount: 100, releasedAmount: 0, remainingAmount: 300, status: 'partially_used', expiresAt: null, notes: null, createdAt: '2026-07-11T00:00:00Z', updatedAt: null, releasedAt: null, archivedAt: null } as PatientFundReservation;
const invoice = { id: 'invoice-1', tenantId: reservation.tenantId, patientId: reservation.patientId, invoiceNumber: 'INV-1', status: 'issued', currency: 'KZT', balanceAmount: 250 } as Invoice;
const unavailable = { ...invoice, id: 'invoice-2', status: 'voided', balanceAmount: 1000 } as Invoice;

function setNativeInputValue(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(element, value);
}

async function change(element: HTMLInputElement | HTMLSelectElement | null, value: string) {
  await act(async () => {
    if (!element) return;
    if (element instanceof HTMLSelectElement) {
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      setNativeInputValue(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
}

describe('UseReservedCreditDialog', () => {
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

  async function render(overrides: Partial<React.ComponentProps<typeof UseReservedCreditDialog>> = {}) {
    const props: React.ComponentProps<typeof UseReservedCreditDialog> = {
      open: true,
      reservation,
      invoices: [invoice, unavailable],
      pending: false,
      actionMessage: null,
      onClose: vi.fn(),
      onSubmit: vi.fn(),
      ...overrides,
    };
    await act(async () => { root.render(<UseReservedCreditDialog {...props} />); });
    return props;
  }

  it('shows eligible invoice debt and excludes voided invoices', async () => {
    await render();
    const select = container.querySelector<HTMLSelectElement>('[data-testid="use-reserved-credit-invoice"]');
    expect(select?.options).toHaveLength(1);
    expect(select?.textContent).toContain('INV-1');
    expect(container.textContent).toContain('Долг по счёту');
    expect(container.textContent).toContain('250');
  });

  it('limits amount by reservation remainder and invoice debt', async () => {
    const props = await render();
    await change(container.querySelector('[data-testid="use-reserved-credit-amount"]'), '260');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="use-reserved-credit-submit"]')?.click(); });
    expect(container.textContent).toContain('превышает доступный остаток депозита или долг по счёту');
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('shows remaining reservation and submits controlled allocation values', async () => {
    const props = await render();
    await change(container.querySelector('[data-testid="use-reserved-credit-amount"]'), '200');
    expect(container.querySelector('[data-testid="use-reserved-credit-remaining"]')?.textContent).toContain('100');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="use-reserved-credit-submit"]')?.click(); });
    expect(props.onSubmit).toHaveBeenCalledWith({ reservationId: reservation.id, invoiceId: invoice.id, amount: 200 });
    expect(container.textContent).not.toContain('Принять оплату');
  });

  it('renders safe no-invoice state', async () => {
    await render({ invoices: [unavailable] });
    expect(container.querySelector('[data-testid="use-reserved-credit-no-invoices"]')?.textContent).toContain('Нет доступных счетов');
    expect(container.querySelector('[data-testid="use-reserved-credit-submit"]')).toBeNull();
  });

  it('disables duplicate submit during reconciliation and supports Escape', async () => {
    const pendingProps = await render({ pending: true, actionMessage: 'Проверяем текущее состояние операции…' });
    expect(container.querySelector<HTMLButtonElement>('[data-testid="use-reserved-credit-submit"]')?.disabled).toBe(true);
    expect(container.textContent).toContain('Проверяем текущее состояние операции');
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(pendingProps.onClose).not.toHaveBeenCalled();
    const props = await render({ pending: false });
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(props.onClose).toHaveBeenCalled();
  });
});
