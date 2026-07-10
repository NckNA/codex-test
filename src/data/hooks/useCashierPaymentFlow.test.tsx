// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCashierPaymentFlow } from './useCashierPaymentFlow';
import { FinanceRpcClientError, type CashierPaymentOperationResult, type FinanceRpcClient } from '../repositories/FinanceRpcClient';
import type { FinanceRepository, Invoice, InvoiceItem, PatientFinanceSummary, Payment, PaymentAllocation } from '../repositories/FinanceRepository';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const tenantId = 'tenant-1';
const patientId = 'patient-1';
const patientIdB = 'patient-2';
const summary = { tenantId, patientId, invoiceTotalAmount: 1000, paidAmount: 0, allocatedPaymentAmount: 0, refundedAmount: 0, discountAmount: 0, writeOffAmount: 0, adjustmentAmount: 0, balanceAmount: 1000, creditAmount: 0, openInvoiceCount: 1, unpaidInvoiceCount: 1, partiallyPaidInvoiceCount: 0, lastPaymentAt: null } as PatientFinanceSummary;
const summaryB = { ...summary, patientId: patientIdB, balanceAmount: 2000 } as PatientFinanceSummary;
const invoice = { id: 'invoice-1', tenantId, patientId, invoiceNumber: 'INV-1', status: 'issued', currency: 'KZT', issueDate: '2026-06-27T00:00:00Z', dueDate: null, totalAmount: 1000, paidAmount: 0, balanceAmount: 1000, notes: 'Smoke cashier invoice' } as Invoice;
const invoiceB = { ...invoice, id: 'invoice-2', patientId: patientIdB, invoiceNumber: 'INV-2', totalAmount: 2000, balanceAmount: 2000 } as Invoice;
const draftInvoice = { ...invoice, id: 'draft-1', status: 'draft' } as Invoice;
const item = { id: 'item-1', tenantId, patientId, invoiceId: invoice.id, serviceName: 'Smoke cashier service', quantity: 1, unitPrice: 1000, totalAmount: 1000, status: 'active' } as InvoiceItem;
const draftItem = { ...item, id: 'item-draft', invoiceId: draftInvoice.id } as InvoiceItem;
const payment = { id: 'payment-1', tenantId, patientId, status: 'allocated', paymentMethod: 'cash', amount: 1000, currency: 'KZT', receivedAt: '2026-06-27T10:00:00Z', externalReference: 'SMOKE', cashierOperationKey: 'operation-1', cashierOperationFingerprint: 'fingerprint-1' } as Payment;
const allocation = { id: 'allocation-1', tenantId, patientId, paymentId: payment.id, invoiceId: invoice.id, invoiceItemId: null, status: 'active', amount: 1000, currency: 'KZT', allocatedAt: '2026-06-27T10:01:00Z' } as PaymentAllocation;

function operationResult(overrides: Partial<CashierPaymentOperationResult> = {}): CashierPaymentOperationResult {
  return {
    status: 'completed', operationId: 'operation-1', tenantId, patientId, payment,
    allocations: [allocation], issuedInvoiceIds: [], requestedAmount: 1000,
    allocatedAmount: 1000, unallocatedAmount: 0, remainingPatientDebt: 0,
    ...overrides,
  };
}

function createRepository(overrides: Partial<FinanceRepository> = {}): FinanceRepository {
  return {
    getPatientFinanceSummary: vi.fn().mockResolvedValue(summary),
    listInvoices: vi.fn().mockResolvedValue([invoice]),
    listInvoiceItems: vi.fn().mockResolvedValue([item]),
    listPayments: vi.fn().mockResolvedValue([]),
    listPaymentAllocations: vi.fn().mockResolvedValue([]),
    listRefunds: vi.fn().mockResolvedValue([]),
    listFinancialAdjustments: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as FinanceRepository;
}

function createRpcClient(overrides: Partial<FinanceRpcClient> = {}): FinanceRpcClient {
  return {
    createInvoice: vi.fn(), addInvoiceItem: vi.fn(), issueInvoice: vi.fn(), voidInvoice: vi.fn(),
    recordPayment: vi.fn(), allocatePayment: vi.fn(), voidPaymentAllocation: vi.fn(), voidPayment: vi.fn(),
    recordAndAllocatePayment: vi.fn().mockResolvedValue(operationResult()),
    getCashierPaymentOperation: vi.fn().mockResolvedValue(operationResult()),
    requestRefund: vi.fn(), approveRefund: vi.fn(), completeRefund: vi.fn(), rejectRefund: vi.fn(), voidRefund: vi.fn(),
    requestInvoiceWriteOff: vi.fn(), approveInvoiceWriteOff: vi.fn(), rejectInvoiceWriteOff: vi.fn(), voidInvoiceWriteOff: vi.fn(),
    ...overrides,
  } as unknown as FinanceRpcClient;
}

let hook: ReturnType<typeof useCashierPaymentFlow>;
function Harness({ tenant = tenantId, patient = patientId, repository, rpcClient }: { tenant?: string | null; patient?: string | null; repository: FinanceRepository; rpcClient: FinanceRpcClient }) {
  const current = useCashierPaymentFlow({ tenantId: tenant, patientId: patient, repository, rpcClient });
  useEffect(() => { hook = current; }, [current]);
  return null;
}

async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }

describe('useCashierPaymentFlow hardening', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); document.body.removeChild(container); vi.restoreAllMocks(); });

  async function renderHook(options: { tenant?: string | null; patient?: string | null; repository?: FinanceRepository; rpcClient?: FinanceRpcClient } = {}) {
    const repository = options.repository ?? createRepository();
    const rpcClient = options.rpcClient ?? createRpcClient();
    await act(async () => { root.render(<Harness tenant={'tenant' in options ? options.tenant : tenantId} patient={'patient' in options ? options.patient : patientId} repository={repository} rpcClient={rpcClient} />); });
    await flush();
    return { repository, rpcClient };
  }

  it('does not fetch without tenant or patient', async () => {
    const repository = createRepository();
    await renderHook({ tenant: null, repository });
    expect(repository.getPatientFinanceSummary).not.toHaveBeenCalled();
    await act(async () => { root.render(<Harness tenant={tenantId} patient={null} repository={repository} rpcClient={createRpcClient()} />); });
    expect(repository.getPatientFinanceSummary).not.toHaveBeenCalled();
  });

  it('loads tenant/patient-scoped finance facts', async () => {
    const { repository } = await renderHook();
    expect(repository.getPatientFinanceSummary).toHaveBeenCalledWith({ tenantId, patientId });
    expect(hook.summary?.balanceAmount).toBe(1000);
    expect(hook.openInvoices.map((row) => row.id)).toEqual(['invoice-1']);
  });

  it('filters draft invoices without items out of open invoices', async () => {
    const repository = createRepository({ listInvoices: vi.fn().mockResolvedValue([{ ...draftInvoice, id: 'draft-empty' }]), listInvoiceItems: vi.fn().mockResolvedValue([]) });
    await renderHook({ repository });
    expect(hook.openInvoices).toEqual([]);
  });

  it('submits one atomic RPC with selected invoices and a stable operation key', async () => {
    const { rpcClient } = await renderHook();
    act(() => hook.selectInvoice(invoice.id, true));
    let result!: Awaited<ReturnType<typeof hook.recordAndAllocatePayment>>;
    await act(async () => { result = await hook.recordAndAllocatePayment({ amount: 1000, paymentMethod: 'cash', externalReference: 'SMOKE' }); });
    expect(rpcClient.recordAndAllocatePayment).toHaveBeenCalledOnce();
    expect(rpcClient.recordAndAllocatePayment).toHaveBeenCalledWith(expect.objectContaining({ tenantId, patientId, amount: 1000, invoiceIds: [invoice.id], idempotencyKey: expect.stringContaining(`cashier-payment:${tenantId}:${patientId}:`) }));
    expect(rpcClient.recordPayment).not.toHaveBeenCalled();
    expect(rpcClient.allocatePayment).not.toHaveBeenCalled();
    expect(result.allocatedAmount).toBe(1000);
    expect(hook.result?.patientId).toBe(patientId);
  });

  it('passes draft invoices to the atomic RPC instead of issuing them client-side', async () => {
    const repository = createRepository({ listInvoices: vi.fn().mockResolvedValue([draftInvoice]), listInvoiceItems: vi.fn().mockResolvedValue([draftItem]) });
    const rpcClient = createRpcClient();
    await renderHook({ repository, rpcClient });
    act(() => hook.selectInvoice(draftInvoice.id, true));
    await act(async () => { await hook.recordAndAllocatePayment({ amount: 1000, paymentMethod: 'cash' }); });
    expect(rpcClient.issueInvoice).not.toHaveBeenCalled();
    expect(rpcClient.recordAndAllocatePayment).toHaveBeenCalledWith(expect.objectContaining({ invoiceIds: [draftInvoice.id] }));
  });

  it('rapid double submit shares one in-flight backend call', async () => {
    const pending = deferred<CashierPaymentOperationResult>();
    const rpcClient = createRpcClient({ recordAndAllocatePayment: vi.fn().mockReturnValue(pending.promise) });
    await renderHook({ rpcClient });
    act(() => hook.selectInvoice(invoice.id, true));
    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => { first = hook.recordAndAllocatePayment({ amount: 1000, paymentMethod: 'cash' }); second = hook.recordAndAllocatePayment({ amount: 1000, paymentMethod: 'cash' }); });
    expect(rpcClient.recordAndAllocatePayment).toHaveBeenCalledOnce();
    pending.resolve(operationResult());
    await act(async () => { await Promise.all([first, second]); });
    expect(rpcClient.recordAndAllocatePayment).toHaveBeenCalledOnce();
  });

  it('safe retry reuses the same operation key', async () => {
    const rpc = vi.fn()
      .mockRejectedValueOnce(new FinanceRpcClientError({ operation: 'recordAndAllocatePayment', category: 'operation_failed', message: 'Оплата не была создана.' }))
      .mockResolvedValueOnce(operationResult({ status: 'already_completed' }));
    const rpcClient = createRpcClient({ recordAndAllocatePayment: rpc });
    await renderHook({ rpcClient });
    act(() => hook.selectInvoice(invoice.id, true));
    await act(async () => { await expect(hook.recordAndAllocatePayment({ amount: 1000, paymentMethod: 'cash' })).rejects.toThrow('Оплата не была создана.'); });
    await act(async () => { await hook.retryOperation(); });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(vi.mocked(rpc).mock.calls[0][0].idempotencyKey).toBe(vi.mocked(rpc).mock.calls[1][0].idempotencyKey);
    expect(hook.result?.wasAlreadyCompleted).toBe(true);
  });

  it('uncertain submit automatically reconciles without recording again', async () => {
    const rpcClient = createRpcClient({
      recordAndAllocatePayment: vi.fn().mockRejectedValue(new FinanceRpcClientError({ operation: 'recordAndAllocatePayment', category: 'operation_uncertain', message: 'network' })),
      getCashierPaymentOperation: vi.fn().mockResolvedValue(operationResult()),
    });
    await renderHook({ rpcClient });
    act(() => hook.selectInvoice(invoice.id, true));
    await act(async () => { await hook.recordAndAllocatePayment({ amount: 1000, paymentMethod: 'cash' }); });
    expect(rpcClient.recordAndAllocatePayment).toHaveBeenCalledOnce();
    expect(rpcClient.getCashierPaymentOperation).toHaveBeenCalledOnce();
    expect(hook.result?.payment.id).toBe(payment.id);
    expect(hook.operationStatus).toBe('succeeded');
  });

  it('keeps confirmed success when post-write refresh fails', async () => {
    const getSummary = vi.fn().mockResolvedValueOnce(summary).mockRejectedValueOnce(new Error('raw database error'));
    const repository = createRepository({ getPatientFinanceSummary: getSummary });
    await renderHook({ repository });
    act(() => hook.selectInvoice(invoice.id, true));
    await act(async () => { await hook.recordAndAllocatePayment({ amount: 1000, paymentMethod: 'cash' }); });
    expect(hook.result?.payment.id).toBe(payment.id);
    expect(hook.operationStatus).toBe('succeeded');
    expect(hook.refreshWarning).toBe('Оплата сохранена, но данные не удалось обновить. Обновите страницу.');
  });

  it('patient change immediately hides old result, selection and finance state', async () => {
    await renderHook();
    act(() => hook.selectInvoice(invoice.id, true));
    await act(async () => { await hook.recordAndAllocatePayment({ amount: 1000, paymentMethod: 'cash' }); });
    expect(hook.result).not.toBeNull();
    await act(async () => { root.render(<Harness tenant={tenantId} patient={patientIdB} repository={createRepository({ getPatientFinanceSummary: vi.fn().mockResolvedValue(summaryB), listInvoices: vi.fn().mockResolvedValue([invoiceB]), listInvoiceItems: vi.fn().mockResolvedValue([{ ...item, patientId: patientIdB, invoiceId: invoiceB.id }]) })} rpcClient={createRpcClient()} />); });
    expect(hook.result).toBeNull();
    expect(hook.selectedInvoiceIds).toEqual([]);
    expect(hook.summary?.patientId).not.toBe(patientId);
    await flush();
    expect(hook.summary?.patientId).toBe(patientIdB);
  });

  it('slow patient A response cannot overwrite faster patient B', async () => {
    const slowA = deferred<PatientFinanceSummary>();
    const repository = createRepository({
      getPatientFinanceSummary: vi.fn(({ patientId: requested }: { patientId: string }) => requested === patientId ? slowA.promise : Promise.resolve(summaryB)),
      listInvoices: vi.fn(({ patientId: requested }: { patientId?: string }) => Promise.resolve(requested === patientId ? [invoice] : [invoiceB])),
      listInvoiceItems: vi.fn(({ patientId: requested }: { patientId?: string }) => Promise.resolve(requested === patientId ? [item] : [{ ...item, patientId: patientIdB, invoiceId: invoiceB.id }])),
    });
    const rpcClient = createRpcClient();
    await act(async () => { root.render(<Harness tenant={tenantId} patient={patientId} repository={repository} rpcClient={rpcClient} />); });
    await act(async () => { root.render(<Harness tenant={tenantId} patient={patientIdB} repository={repository} rpcClient={rpcClient} />); });
    await flush();
    expect(hook.summary?.patientId).toBe(patientIdB);
    slowA.resolve(summary);
    await flush();
    expect(hook.summary?.patientId).toBe(patientIdB);
    expect(hook.openInvoices.map((row) => row.id)).toEqual([invoiceB.id]);
  });

  it('mismatched backend patient result is never exposed', async () => {
    const wrongPayment = { ...payment, patientId: patientIdB } as Payment;
    const rpcClient = createRpcClient({ recordAndAllocatePayment: vi.fn().mockResolvedValue(operationResult({ patientId: patientIdB, payment: wrongPayment })) });
    await renderHook({ rpcClient });
    act(() => hook.selectInvoice(invoice.id, true));
    await act(async () => { await expect(hook.recordAndAllocatePayment({ amount: 1000, paymentMethod: 'cash' })).rejects.toThrow('Пациент изменился'); });
    expect(hook.result).toBeNull();
  });

  it('blocks over-allocation before backend writes', async () => {
    const rpcClient = createRpcClient();
    await renderHook({ rpcClient });
    act(() => hook.selectInvoice(invoice.id, true));
    await expect(hook.recordAndAllocatePayment({ amount: 2000, paymentMethod: 'cash' })).rejects.toThrow('Сумма превышает долг по выбранным счетам.');
    expect(rpcClient.recordAndAllocatePayment).not.toHaveBeenCalled();
  });

  it('source avoids forbidden persistence and clinical boundaries', () => {
    const source = String(useCashierPaymentFlow);
    expect(source).not.toContain('completed_services');
    expect(source).not.toContain('patients.balance');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('service_role');
    expect(source).not.toMatch(/\bsupabase\.from\(|\bclient\.from\(/);
  });
});
