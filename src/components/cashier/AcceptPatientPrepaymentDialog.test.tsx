// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatientFinanceSummary, Payment } from '../../data/repositories/FinanceRepository';
import type { PatientCreditPaymentOperationResult } from '../../data/repositories/FinanceRpcClient';
import { CashierPaymentForm } from './CashierPaymentForm';
import { AcceptPatientPrepaymentDialog, type PrepaymentPatient } from './AcceptPatientPrepaymentDialog';
import { UseReservedCreditDialog } from '../finance/UseReservedCreditDialog';

const tenantId = 'tenant-a';
const patient: PrepaymentPatient = { id: 'patient-a', fullName: 'Алина Тестова' };
const summary: PatientFinanceSummary = {
  tenantId,
  patientId: patient.id,
  asOf: '2026-07-11T12:00:00Z',
  modelVersion: 'finance-summary-v1',
  factComplete: true,
  warnings: [],
  currencies: [{
    currency: 'KZT',
    totalInvoiced: 500,
    activeAllocatedAmount: 0,
    cashReceived: 1000,
    completedRefundAmount: 0,
    approvedWriteOffAmount: 0,
    currentDebt: 200,
    grossUnallocatedAmount: 850,
    refundReservedAmount: 50,
    reservedDepositAmount: 100,
    availableCreditAmount: 700,
    netPositionAmount: 500,
    openInvoiceCount: 1,
    unpaidInvoiceCount: 1,
    partiallyPaidInvoiceCount: 0,
    lastPaymentAt: '2026-07-11T10:00:00Z',
  }],
};
const payment = {
  id: 'payment-prepayment-1', tenantId, patientId: patient.id, status: 'received', paymentMethod: 'cash', amount: 1000,
  currency: 'KZT', receivedAt: '2026-07-11T12:00:00Z', externalReference: null, payerName: null, notes: null,
} as Payment;
const operationResult: PatientCreditPaymentOperationResult = {
  status: 'completed', operationId: 'operation-1', tenantId, patientId: patient.id, payment,
  capacity: {
    paymentId: payment.id, patientId: patient.id, currency: 'KZT', paymentAmount: 1000,
    activeAllocatedAmount: 0, completedRefundAmount: 0, refundReservedAmount: 0,
    reservedDepositAmount: 0, grossUnallocatedAmount: 1000, availableCreditAmount: 1000,
  },
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

function setNativeValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

describe('AcceptPatientPrepaymentDialog', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSubmit = vi.fn().mockResolvedValue(operationResult);
  const onResetOperation = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onSubmit.mockReset().mockResolvedValue(operationResult);
    onResetOperation.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  async function renderDialog(overrides: Partial<React.ComponentProps<typeof AcceptPatientPrepaymentDialog>> = {}) {
    const props: React.ComponentProps<typeof AcceptPatientPrepaymentDialog> = {
      tenantId,
      patient,
      role: 'clinic_admin',
      summary,
      operationStatus: 'idle',
      operationResult: null,
      operationError: null,
      onSubmit,
      onResetOperation,
      testIdPrefix: 'test-prepayment',
      ...overrides,
    };
    await act(async () => { root.render(<AcceptPatientPrepaymentDialog {...props} />); });
    return props;
  }

  async function openDialog() {
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="test-prepayment-open"]')?.click(); });
  }

  async function fillValidForm(amount = '1000', method = 'cash') {
    await act(async () => {
      setNativeValue(container.querySelector<HTMLInputElement>('[data-testid="test-prepayment-amount"]')!, amount);
      setNativeValue(container.querySelector<HTMLSelectElement>('[data-testid="test-prepayment-method"]')!, method);
    });
  }

  it('1. action is visible for owner', async () => { await renderDialog({ role: 'clinic_owner' }); expect(container.querySelector('[data-testid="test-prepayment-open"]')).not.toBeNull(); });
  it('2. action is visible for admin', async () => { await renderDialog({ role: 'clinic_admin' }); expect(container.querySelector('[data-testid="test-prepayment-open"]')).not.toBeNull(); });
  it('3. action is visible for cashier', async () => { await renderDialog({ role: 'cashier' }); expect(container.querySelector('[data-testid="test-prepayment-open"]')).not.toBeNull(); });
  it('4. action is hidden for doctor', async () => { await renderDialog({ role: 'doctor' }); expect(container.querySelector('[data-testid="test-prepayment-open"]')).toBeNull(); });
  it('5. action is hidden for registrar', async () => { await renderDialog({ role: 'registrar' }); expect(container.querySelector('[data-testid="test-prepayment-open"]')).toBeNull(); });
  it('6. action is hidden without tenant', async () => { await renderDialog({ tenantId: null }); expect(container.querySelector('[data-testid="test-prepayment-open"]')).toBeNull(); });
  it('7. action is hidden without patient', async () => { await renderDialog({ patient: null }); expect(container.querySelector('[data-testid="test-prepayment-open"]')).toBeNull(); });
  it('8. dialog opens', async () => { await renderDialog(); await openDialog(); expect(container.querySelector('[role="dialog"]')).not.toBeNull(); });
  it('9. patient is displayed', async () => { await renderDialog(); await openDialog(); expect(container.textContent).toContain('Алина Тестова'); });
  it('10. current credit is displayed', async () => { await renderDialog(); await openDialog(); expect(container.textContent).toContain('700 KZT'); });
  it('11. current debt is displayed', async () => { await renderDialog(); await openDialog(); expect(container.textContent).toContain('200 KZT'); });
  it('12. deposit reserve is displayed', async () => { await renderDialog(); await openDialog(); expect(container.textContent).toContain('100 KZT'); });
  it('13. refund reserve is displayed', async () => { await renderDialog(); await openDialog(); expect(container.textContent).toContain('50 KZT'); });
  it('14. KZT is fixed', async () => { await renderDialog(); await openDialog(); expect(container.textContent).toContain('ВалютаKZT'); });
  it('15. currency selector is absent', async () => { await renderDialog(); await openDialog(); expect(container.querySelector('[data-testid="test-prepayment-currency"]')).toBeNull(); });

  it('16. amount is required', async () => {
    await renderDialog(); await openDialog();
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="test-prepayment-submit"]')?.click(); });
    expect(container.textContent).toContain('Введите сумму больше нуля.');
  });
  it('17. zero is rejected', async () => {
    await renderDialog(); await openDialog(); await fillValidForm('0');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="test-prepayment-submit"]')?.click(); });
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('18. negative value is rejected', async () => {
    await renderDialog(); await openDialog(); await fillValidForm('-1');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="test-prepayment-submit"]')?.click(); });
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('19. more than two decimal places are rejected', async () => {
    await renderDialog(); await openDialog(); await fillValidForm('1.234');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="test-prepayment-submit"]')?.click(); });
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('20. method is required', async () => {
    await renderDialog(); await openDialog();
    await act(async () => { setNativeValue(container.querySelector<HTMLInputElement>('[data-testid="test-prepayment-amount"]')!, '1000'); });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="test-prepayment-submit"]')?.click(); });
    expect(container.textContent).toContain('Выберите способ оплаты.');
  });
  it('21. optional text is trimmed', async () => {
    await renderDialog(); await openDialog(); await fillValidForm();
    await act(async () => {
      setNativeValue(container.querySelector<HTMLInputElement>('[data-testid="test-prepayment-external-reference"]')!, '  REF-1  ');
      setNativeValue(container.querySelector<HTMLInputElement>('[data-testid="test-prepayment-payer-name"]')!, '  Плательщик  ');
      setNativeValue(container.querySelector<HTMLInputElement>('[data-testid="test-prepayment-notes"]')!, '  заметка  ');
      container.querySelector<HTMLButtonElement>('[data-testid="test-prepayment-submit"]')?.click();
    });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ externalReference: 'REF-1', payerName: 'Плательщик', notes: 'заметка' }));
  });
  it('22. confirmation explicitly says no invoice is selected', async () => { await renderDialog(); await openDialog(); expect(container.textContent).toContain('Счёт не выбран'); });
  it('23. confirmation explicitly says this is new money', async () => { await renderDialog(); await openDialog(); expect(container.textContent).toContain('фиксирует получение новых денег'); });
  it('24. submit calls the hardened action once', async () => {
    await renderDialog(); await openDialog(); await fillValidForm();
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="test-prepayment-submit"]')?.click(); });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000, paymentMethod: 'cash', currency: 'KZT' }));
  });
  it('25. duplicate submit is blocked', async () => {
    const pending = deferred<PatientCreditPaymentOperationResult>();
    onSubmit.mockReturnValueOnce(pending.promise);
    await renderDialog(); await openDialog(); await fillValidForm();
    const submit = container.querySelector<HTMLButtonElement>('[data-testid="test-prepayment-submit"]')!;
    await act(async () => { submit.click(); submit.click(); });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    pending.resolve(operationResult);
    await act(async () => { await pending.promise; });
  });
  it('26. submitting progress is shown and fields are disabled', async () => {
    await renderDialog(); await openDialog(); await renderDialog({ operationStatus: 'submitting' });
    expect(container.textContent).toContain('Сохраняем платёж…');
    expect(container.querySelector<HTMLInputElement>('[data-testid="test-prepayment-amount"]')?.disabled).toBe(true);
  });
  it('27. reconciliation progress is shown', async () => {
    await renderDialog(); await openDialog(); await renderDialog({ operationStatus: 'reconciling' });
    expect(container.textContent).toContain('Проверяем, был ли платёж сохранён…');
  });
  it('28. success message and details are correct', async () => {
    await renderDialog(); await openDialog(); await renderDialog({ operationStatus: 'succeeded', operationResult });
    expect(container.textContent).toContain('Предоплата принята.');
    expect(container.textContent).toContain('1 000 KZT');
    expect(container.textContent).toContain('Наличные');
  });
  it('29. success never says invoice paid', async () => {
    await renderDialog(); await openDialog(); await renderDialog({ operationStatus: 'succeeded', operationResult });
    expect(container.textContent).not.toContain('Счёт оплачен');
  });
  it('30. success never says deposit was created', async () => {
    await renderDialog(); await openDialog(); await renderDialog({ operationStatus: 'succeeded', operationResult });
    expect(container.textContent).not.toContain('Депозит создан');
  });
  it('31. permission error is safe', async () => {
    onSubmit.mockRejectedValueOnce(new Error('Недостаточно прав для приёма предоплаты.'));
    await renderDialog(); await openDialog(); await fillValidForm();
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="test-prepayment-submit"]')?.click(); });
    expect(container.textContent).toContain('Недостаточно прав для приёма предоплаты.');
  });
  it('32. idempotency conflict is safe', async () => {
    onSubmit.mockRejectedValueOnce(new Error('Эта операция уже была выполнена с другими параметрами.'));
    await renderDialog(); await openDialog(); await fillValidForm();
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="test-prepayment-submit"]')?.click(); });
    expect(container.textContent).toContain('Эта операция уже была выполнена с другими параметрами.');
  });
  it('33. generic error hides raw details', async () => {
    onSubmit.mockRejectedValueOnce(new Error('SQLSTATE 23505 uq_payments secret stack'));
    await renderDialog(); await openDialog(); await fillValidForm();
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="test-prepayment-submit"]')?.click(); });
    expect(container.textContent).toContain('Не удалось принять предоплату. Проверьте текущее состояние операции.');
    expect(container.textContent).not.toContain('23505');
    expect(container.textContent).not.toContain('uq_payments');
  });
  it('34. patient switch closes the dialog', async () => {
    await renderDialog(); await openDialog();
    await renderDialog({ patient: { id: 'patient-b', fullName: 'Борис Тестов' } });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
  it('35. tenant switch clears the form', async () => {
    await renderDialog(); await openDialog(); await fillValidForm('555');
    await renderDialog({ tenantId: 'tenant-b' });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="test-prepayment-open"]')?.click(); });
    expect(container.querySelector<HTMLInputElement>('[data-testid="test-prepayment-amount"]')?.value).toBe('');
  });
  it('36. late success for the old patient is ignored visually', async () => {
    const pending = deferred<PatientCreditPaymentOperationResult>();
    onSubmit.mockReturnValueOnce(pending.promise);
    await renderDialog(); await openDialog(); await fillValidForm();
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="test-prepayment-submit"]')?.click(); });
    await renderDialog({ patient: { id: 'patient-b', fullName: 'Борис Тестов' } });
    pending.resolve(operationResult);
    await act(async () => { await pending.promise; });
    expect(container.textContent).not.toContain('Предоплата принята.');
    expect(container.textContent).not.toContain('Алина Тестова');
  });
  it('37. allocated cashier flow keeps the distinct label', async () => {
    await act(async () => { root.render(<CashierPaymentForm onSubmit={vi.fn().mockResolvedValue(null)} />); });
    expect(container.textContent).toContain('Принять оплату по счетам');
    expect(container.textContent).not.toContain('Принять предоплату');
  });
  it('38. existing deposit use keeps its distinct label', async () => {
    const reservation = {
      id: 'reservation-1', tenantId, patientId: patient.id, paymentId: payment.id, currency: 'KZT', status: 'active',
      purposeType: 'general', purposeLabel: null, appointmentId: null, treatmentPlanId: null,
      originalAmount: 300, consumedAmount: 0, releasedAmount: 0, remainingAmount: 300,
      releaseReason: null, expiresAt: null, notes: null, createdAt: '2026-07-11T00:00:00Z', updatedAt: null, releasedAt: null, archivedAt: null,
    } as const;
    const invoice = { id: 'invoice-1', tenantId, patientId: patient.id, currency: 'KZT', status: 'issued', balanceAmount: 300, invoiceNumber: 'INV-1' } as never;
    await act(async () => { root.render(<UseReservedCreditDialog open reservation={reservation as never} invoices={[invoice]} onClose={vi.fn()} onSubmit={vi.fn()} />); });
    expect(container.textContent).toContain('Использовать депозит');
    expect(container.textContent).not.toContain('Принять предоплату');
  });
});
