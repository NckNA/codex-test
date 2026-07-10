// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePaymentRefundFlow } from './usePaymentRefundFlow';
import type { FinanceRepository, Payment, PaymentRefundability, Refund } from '../repositories/FinanceRepository';
import type { FinanceRpcClient } from '../repositories/FinanceRpcClient';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const tenantId = 'tenant-1';
const paymentId = 'payment-1';
const payment = { id: paymentId, tenantId, patientId: 'patient-1', status: 'received', paymentMethod: 'cash', amount: 1000, currency: 'KZT', receivedAt: '2026-07-10T00:00:00Z' } as Payment;
const refundability = { payment, paymentAmount: 1000, activeAllocatedAmount: 0, completedRefundAmount: 0, reservedRefundAmount: 0, refundableAmount: 1000, hasActiveAllocations: false, refundCount: 0, currency: 'KZT' } as PaymentRefundability;
const pendingRefund = { id: 'refund-1', tenantId, patientId: payment.patientId, paymentId, status: 'pending', refundMethod: 'cash', amount: 400, currency: 'KZT', reason: 'Reason', requestedAt: '2026-07-10T00:00:00Z' } as Refund;

function createRepository(overrides: Partial<FinanceRepository> = {}): FinanceRepository {
  return {
    getPaymentRefundability: vi.fn().mockResolvedValue(refundability),
    listRefunds: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as FinanceRepository;
}

function createRpcClient(overrides: Partial<FinanceRpcClient> = {}): FinanceRpcClient {
  return {
    requestRefund: vi.fn().mockResolvedValue(pendingRefund),
    approveRefund: vi.fn().mockResolvedValue({ ...pendingRefund, status: 'approved' }),
    completeRefund: vi.fn().mockResolvedValue({ ...pendingRefund, status: 'completed' }),
    rejectRefund: vi.fn().mockResolvedValue({ ...pendingRefund, status: 'rejected' }),
    voidRefund: vi.fn().mockResolvedValue({ ...pendingRefund, status: 'voided' }),
    ...overrides,
  } as unknown as FinanceRpcClient;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }

describe('usePaymentRefundFlow', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof usePaymentRefundFlow>;
  let defaultRepository: FinanceRepository;
  let defaultRpcClient: FinanceRpcClient;

  function Harness({ tenant = tenantId, payment = paymentId, role = 'clinic_admin', repository = defaultRepository, rpcClient = defaultRpcClient }: { tenant?: string | null; payment?: string | null; role?: string; repository?: FinanceRepository; rpcClient?: FinanceRpcClient }) {
    latest = usePaymentRefundFlow({ tenantId: tenant, paymentId: payment, role, repository, rpcClient });
    return null;
  }

  beforeEach(() => { defaultRepository = createRepository(); defaultRpcClient = createRpcClient(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); document.body.removeChild(container); vi.restoreAllMocks(); });

  it('does not fetch without tenant or payment', async () => {
    const repository = createRepository();
    await act(async () => { root.render(<Harness tenant={null} repository={repository} />); });
    await flush();
    expect(repository.getPaymentRefundability).not.toHaveBeenCalled();
    expect(latest.refundability).toBeNull();
  });

  it('loads refundability and history through repository', async () => {
    const repository = createRepository({ listRefunds: vi.fn().mockResolvedValue([pendingRefund]) });
    await act(async () => { root.render(<Harness repository={repository} />); });
    await flush();
    expect(latest.refundability?.refundableAmount).toBe(1000);
    expect(latest.refunds).toHaveLength(1);
  });

  it('matches role permissions', async () => {
    await act(async () => { root.render(<Harness role="cashier" />); }); await flush();
    expect(latest.capabilities.canRequest).toBe(true);
    expect(latest.capabilities.canApprove).toBe(false);
    expect(latest.capabilities.canComplete).toBe(true);
    await act(async () => { root.render(<Harness role="doctor" />); }); await flush();
    expect(latest.capabilities.canRequest).toBe(false);
  });

  it('validates amount and reason before request', async () => {
    const rpcClient = createRpcClient();
    await act(async () => { root.render(<Harness rpcClient={rpcClient} />); }); await flush();
    await act(async () => { await latest.requestRefund({ amount: 1200, refundMethod: 'cash', reason: 'x' }); });
    expect(latest.actionMessage).toBe('Сумма превышает доступную.');
    await act(async () => { await latest.requestRefund({ amount: 100, refundMethod: 'cash', reason: '   ' }); });
    expect(latest.actionMessage).toBe('Укажите причину возврата.');
    expect(rpcClient.requestRefund).not.toHaveBeenCalled();
  });

  it('creates pending request with controlled metadata and refreshes', async () => {
    const repository = createRepository();
    const rpcClient = createRpcClient();
    await act(async () => { root.render(<Harness repository={repository} rpcClient={rpcClient} />); }); await flush();
    await act(async () => { await latest.requestRefund({ amount: 400, refundMethod: 'cash', reason: ' Return ' }); });
    expect(rpcClient.requestRefund).toHaveBeenCalledWith(expect.objectContaining({ tenantId, paymentId, amount: 400, reason: 'Return', metadata: { source: 'patient_finance_ui' } }));
    expect(latest.actionMessage).toBe('Заявка на возврат создана.');
    expect(repository.getPaymentRefundability).toHaveBeenCalledTimes(2);
  });

  it('retains the request idempotency key across retry', async () => {
    const requestRefund = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(pendingRefund);
    const rpcClient = createRpcClient({ requestRefund });
    await act(async () => { root.render(<Harness rpcClient={rpcClient} />); }); await flush();
    await act(async () => { await latest.requestRefund({ amount: 400, refundMethod: 'cash', reason: 'Reason' }); });
    await act(async () => { await latest.requestRefund({ amount: 400, refundMethod: 'cash', reason: 'Reason' }); });
    expect(requestRefund).toHaveBeenCalledTimes(2);
    expect(requestRefund.mock.calls[0][0].idempotencyKey).toBe(requestRefund.mock.calls[1][0].idempotencyKey);
  });

  it('prevents double submit while request is in flight', async () => {
    const pending = deferred<Refund>();
    const requestRefund = vi.fn().mockReturnValue(pending.promise);
    const rpcClient = createRpcClient({ requestRefund });
    await act(async () => { root.render(<Harness rpcClient={rpcClient} />); }); await flush();
    let first!: Promise<unknown>; let second!: Promise<unknown>;
    act(() => {
      first = latest.requestRefund({ amount: 400, refundMethod: 'cash', reason: 'Reason' });
      second = latest.requestRefund({ amount: 400, refundMethod: 'cash', reason: 'Reason' });
    });
    expect(requestRefund).toHaveBeenCalledOnce();
    pending.resolve(pendingRefund);
    await act(async () => { await Promise.all([first, second]); });
  });

  it('runs approve, complete, reject and void only for allowed roles', async () => {
    const rpcClient = createRpcClient();
    await act(async () => { root.render(<Harness role="clinic_admin" rpcClient={rpcClient} />); }); await flush();
    await act(async () => { await latest.approveRefund('refund-1'); await latest.completeRefund('refund-1', 'REF-1'); await latest.rejectRefund('refund-1', 'No'); await latest.voidRefund('refund-1', 'Cancel'); });
    expect(rpcClient.approveRefund).toHaveBeenCalledOnce();
    expect(rpcClient.completeRefund).toHaveBeenCalledWith(expect.objectContaining({ externalReference: 'REF-1' }));
    expect(rpcClient.rejectRefund).toHaveBeenCalledOnce();
    expect(rpcClient.voidRefund).toHaveBeenCalledOnce();
  });

  it('clears old data and ignores stale payment response', async () => {
    const slow = deferred<PaymentRefundability | null>();
    const repository = createRepository({
      getPaymentRefundability: vi.fn(({ paymentId: requested }) => requested === paymentId ? slow.promise : Promise.resolve({ ...refundability, payment: { ...payment, id: 'payment-2' }, refundableAmount: 600 })),
    });
    await act(async () => { root.render(<Harness payment={paymentId} repository={repository} />); });
    await act(async () => { root.render(<Harness payment="payment-2" repository={repository} />); });
    await flush();
    expect(latest.refundability?.payment.id).toBe('payment-2');
    slow.resolve(refundability);
    await flush();
    expect(latest.refundability?.payment.id).toBe('payment-2');
  });

  it('never exposes raw repository or rpc errors', async () => {
    const repository = createRepository({ getPaymentRefundability: vi.fn().mockRejectedValue(new Error('SQLSTATE 42501 request_refund secret')) });
    await act(async () => { root.render(<Harness repository={repository} />); }); await flush();
    expect(latest.error?.message).toBe('Не удалось загрузить данные возврата.');
    expect(latest.error?.message).not.toContain('SQLSTATE');
  });
});
