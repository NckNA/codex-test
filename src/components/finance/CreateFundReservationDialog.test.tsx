// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payment, PaymentFundCapacity } from '../../data/repositories/FinanceRepository';
import { CreateFundReservationDialog } from './CreateFundReservationDialog';

const payment = { id: 'payment-1', tenantId: 'tenant-1', patientId: 'patient-1', status: 'received', paymentMethod: 'cash', amount: 1000, currency: 'KZT', receivedAt: '2026-07-11T00:00:00Z' } as Payment;
const capacity = { paymentId: payment.id, patientId: payment.patientId, currency: 'KZT', paymentAmount: 1000, activeAllocatedAmount: 100, completedRefundAmount: 50, refundReservedAmount: 100, reservedDepositAmount: 50, grossUnallocatedAmount: 850, availableCreditAmount: 650 } as PaymentFundCapacity;

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(element, value);
}

async function change(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null, value: string) {
  await act(async () => {
    if (!element) return;
    if (element instanceof HTMLSelectElement) {
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      setNativeValue(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
}

describe('CreateFundReservationDialog', () => {
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

  async function render(overrides: Partial<React.ComponentProps<typeof CreateFundReservationDialog>> = {}) {
    const props: React.ComponentProps<typeof CreateFundReservationDialog> = {
      open: true,
      payments: [payment],
      capacities: { [payment.id]: capacity },
      pending: false,
      actionMessage: null,
      onClose: vi.fn(),
      onSubmit: vi.fn(),
      ...overrides,
    };
    await act(async () => { root.render(<CreateFundReservationDialog {...props} />); });
    return props;
  }

  it('renders exact backend capacity values and distinguishes existing credit from new money', async () => {
    await render();
    const text = container.textContent ?? '';
    expect(text).toContain('Сумма платежа');
    expect(text).toContain('Распределено');
    expect(text).toContain('Возвращено');
    expect(text).toContain('Зарезервировано под возврат');
    expect(text).toContain('Зарезервировано как депозит');
    expect(text).toContain('Доступный кредит');
    expect(text).toContain('650');
    expect(text).toContain('Новый платёж не создаётся');
    expect(text).not.toContain('Принять оплату');
  });

  it('shows no-credit empty state when no payment is eligible', async () => {
    await render({ capacities: { [payment.id]: { ...capacity, availableCreditAmount: 0 } } });
    expect(container.querySelector('[data-testid="create-fund-reservation-no-credit"]')?.textContent).toContain('Нет доступных средств');
    expect(container.querySelector('[data-testid="fund-reservation-create-submit"]')).toBeNull();
  });

  it('blocks amount above backend capacity', async () => {
    const props = await render();
    await change(container.querySelector('[data-testid="fund-reservation-amount"]'), '800');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="fund-reservation-create-submit"]')?.click(); });
    expect(container.textContent).toContain('Недостаточно доступного кредита');
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('requires a trimmed other-purpose label and maps valid values', async () => {
    const props = await render();
    await change(container.querySelector('[data-testid="fund-reservation-amount"]'), '300');
    await change(container.querySelector('[data-testid="fund-reservation-purpose"]'), 'other');
    await change(container.querySelector('[data-testid="fund-reservation-purpose-label"]'), 'x');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="fund-reservation-create-submit"]')?.click(); });
    expect(container.textContent).toContain('от 2 до 120');
    await change(container.querySelector('[data-testid="fund-reservation-purpose-label"]'), '  Ортопедия  ');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="fund-reservation-create-submit"]')?.click(); });
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 300, purposeType: 'other', purposeLabel: 'Ортопедия' }));
  });

  it('disables duplicate submit while pending and explains progress', async () => {
    await render({ pending: true, actionMessage: 'Проверяем текущее состояние операции…' });
    expect(container.querySelector<HTMLButtonElement>('[data-testid="fund-reservation-create-submit"]')?.disabled).toBe(true);
    expect(container.textContent).toContain('Проверяем текущее состояние операции');
  });

  it('is keyboard dismissible with Escape when not pending', async () => {
    const props = await render();
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
