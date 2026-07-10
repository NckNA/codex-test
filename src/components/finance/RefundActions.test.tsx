// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RefundActions } from './RefundActions';
import type { FinanceRepository, Payment, PaymentRefundability, Refund } from '../../data/repositories/FinanceRepository';
import type { FinanceRpcClient } from '../../data/repositories/FinanceRpcClient';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const tenantId = 'tenant-1';
const paymentId = 'payment-1';
const payment = { id: paymentId, tenantId, patientId: 'patient-1', status: 'received', paymentMethod: 'cash', amount: 1000, currency: 'KZT', receivedAt: '2026-07-10T00:00:00Z' } as Payment;
const refundability = { payment, paymentAmount: 1000, activeAllocatedAmount: 0, completedRefundAmount: 100, reservedRefundAmount: 200, refundableAmount: 700, hasActiveAllocations: false, refundCount: 2, currency: 'KZT' } as PaymentRefundability;
const pending = { id: 'refund-pending', tenantId, patientId: payment.patientId, paymentId, status: 'pending', refundMethod: 'cash', amount: 200, currency: 'KZT', reason: 'Reason', requestedAt: '2026-07-10T00:00:00Z' } as Refund;
const approved = { ...pending, id: 'refund-approved', status: 'approved' } as Refund;
const completed = { ...pending, id: 'refund-completed', status: 'completed' } as Refund;

function createRepository(data: PaymentRefundability = refundability, refunds: Refund[] = [pending, approved, completed]): FinanceRepository {
  return { getPaymentRefundability: vi.fn().mockResolvedValue(data), listRefunds: vi.fn().mockResolvedValue(refunds) } as unknown as FinanceRepository;
}
function createRpcClient(): FinanceRpcClient {
  return {
    requestRefund: vi.fn().mockResolvedValue(pending), approveRefund: vi.fn().mockResolvedValue(approved), completeRefund: vi.fn().mockResolvedValue(completed), rejectRefund: vi.fn().mockResolvedValue({ ...pending, status: 'rejected' }), voidRefund: vi.fn().mockResolvedValue({ ...pending, status: 'voided' }),
  } as unknown as FinanceRpcClient;
}
async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
function setValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('RefundActions', () => {
  let container: HTMLDivElement; let root: Root;
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); document.body.removeChild(container); vi.restoreAllMocks(); });

  async function render(role = 'clinic_admin', repository = createRepository(), rpcClient = createRpcClient(), tenant: string | null = tenantId) {
    await act(async () => { root.render(<RefundActions tenantId={tenant} paymentId={paymentId} role={role} repository={repository} rpcClient={rpcClient} />); });
    await flush();
    return { repository, rpcClient };
  }

  it('shows safe no-tenant state', async () => {
    await render('clinic_admin', createRepository(), createRpcClient(), null);
    expect(container.querySelector('[data-testid="refund-no-tenant"]')).not.toBeNull();
  });

  it('renders payment, allocated, completed, reserved and refundable amounts', async () => {
    await render();
    expect(container.textContent).toContain('Сумма платежа');
    expect(container.textContent).toContain('Распределено');
    expect(container.textContent).toContain('Уже возвращено');
    expect(container.textContent).toContain('Зарезервировано под возврат');
    expect(container.textContent).toContain('Доступно к возврату');
    expect(container.textContent).toContain('700 KZT');
  });

  it('hides request and instructs allocation void when funds are allocated', async () => {
    const allocated = { ...refundability, activeAllocatedAmount: 1000, refundableAmount: 0, hasActiveAllocations: true };
    await render('cashier', createRepository(allocated));
    expect(container.querySelector(`[data-testid="refund-request-open-${paymentId}"]`)).toBeNull();
    expect(container.textContent).toContain('Сначала отмените распределение платежа по счёту.');
  });

  it('cashier can request and complete but cannot approve reject or void', async () => {
    await render('cashier');
    expect(container.querySelector(`[data-testid="refund-request-open-${paymentId}"]`)).not.toBeNull();
    expect(container.querySelector('[data-testid="refund-approve-refund-pending"]')).toBeNull();
    expect(container.querySelector('[data-testid="refund-reject-refund-pending"]')).toBeNull();
    expect(container.querySelector('[data-testid="refund-void-refund-pending"]')).toBeNull();
    expect(container.querySelector('[data-testid="refund-complete-refund-approved"]')).not.toBeNull();
  });

  it('admin can approve reject and void pending while completed has no actions', async () => {
    await render('clinic_admin');
    expect(container.querySelector('[data-testid="refund-approve-refund-pending"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="refund-reject-refund-pending"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="refund-void-refund-pending"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="refund-actions-refund-completed"]')).toBeNull();
  });

  it('validates request amount and reason and creates pending request', async () => {
    const { rpcClient } = await render('cashier');
    await act(async () => { container.querySelector<HTMLButtonElement>(`[data-testid="refund-request-open-${paymentId}"]`)!.click(); });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="refund-request-submit"]')!.click(); });
    expect(container.textContent).toContain('Сумма должна быть больше 0.');
    setValue(container.querySelector<HTMLInputElement>('[data-testid="refund-request-amount"]')!, '400');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="refund-request-submit"]')!.click(); });
    expect(container.textContent).toContain('Укажите причину возврата.');
    setValue(container.querySelector<HTMLTextAreaElement>('[data-testid="refund-request-reason"]')!, 'Return cash');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="refund-request-submit"]')!.click(); });
    await flush();
    expect(rpcClient.requestRefund).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('Заявка на возврат создана.');
    expect(container.textContent).not.toContain('Деньги возвращены');
  });

  it('completion confirmation uses factual wording', async () => {
    await render('cashier');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="refund-complete-refund-approved"]')!.click(); });
    expect(container.textContent).toContain('Подтвердите, что деньги фактически возвращены пациенту.');
  });

  it('does not render raw metadata or database errors', async () => {
    const repository = { getPaymentRefundability: vi.fn().mockRejectedValue(new Error('SQLSTATE request_refund secret')), listRefunds: vi.fn().mockResolvedValue([]) } as unknown as FinanceRepository;
    await render('clinic_admin', repository);
    expect(container.textContent).toContain('Не удалось загрузить данные возврата.');
    expect(container.textContent).not.toContain('SQLSTATE');
    expect(container.textContent).not.toContain('metadata');
  });

  it('source contains no direct Supabase writes or raw rpc calls', () => {
    const source = String(RefundActions);
    expect(source).not.toContain('supabase.rpc');
    expect(source).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
    expect(source).not.toContain('service_role');
    expect(source).not.toContain('localStorage');
  });
});
