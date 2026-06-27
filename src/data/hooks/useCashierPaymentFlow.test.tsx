// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCashierPaymentFlow } from './useCashierPaymentFlow';
import type { FinanceRepository, Invoice, InvoiceItem, PatientFinanceSummary, Payment, PaymentAllocation } from '../repositories/FinanceRepository';
import type { FinanceRpcClient } from '../repositories/FinanceRpcClient';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const tenantId = 'tenant-1';
const patientId = 'patient-1';
const summary = { tenantId, patientId, invoiceTotalAmount: 1000, paidAmount: 0, allocatedPaymentAmount: 0, refundedAmount: 0, discountAmount: 0, writeOffAmount: 0, adjustmentAmount: 0, balanceAmount: 1000, creditAmount: 0, openInvoiceCount: 1, unpaidInvoiceCount: 1, partiallyPaidInvoiceCount: 0, lastPaymentAt: null } as PatientFinanceSummary;
const invoice = { id: 'invoice-1', tenantId, patientId, invoiceNumber: 'INV-1', status: 'issued', currency: 'KZT', issueDate: '2026-06-27T00:00:00Z', dueDate: null, totalAmount: 1000, paidAmount: 0, balanceAmount: 1000, notes: 'Smoke cashier invoice' } as Invoice;
const draftInvoice = { ...invoice, id: 'draft-1', status: 'draft' } as Invoice;
const item = { id: 'item-1', tenantId, patientId, invoiceId: invoice.id, serviceName: 'Smoke cashier service', quantity: 1, unitPrice: 1000, totalAmount: 1000, status: 'active' } as InvoiceItem;
const draftItem = { ...item, id: 'item-draft', invoiceId: draftInvoice.id } as InvoiceItem;
const payment = { id: 'payment-1', tenantId, patientId, status: 'received', paymentMethod: 'cash', amount: 1000, currency: 'KZT', receivedAt: '2026-06-27T10:00:00Z', externalReference: 'SMOKE-CASHIER-PAYMENT-FLOW-001' } as Payment;
const allocation = { id: 'allocation-1', tenantId, patientId, paymentId: payment.id, invoiceId: invoice.id, invoiceItemId: null, status: 'active', amount: 1000, currency: 'KZT', allocatedAt: '2026-06-27T10:01:00Z' } as PaymentAllocation;

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

function createRpcClient(): FinanceRpcClient {
  return {
    createInvoice: vi.fn(),
    addInvoiceItem: vi.fn(),
    issueInvoice: vi.fn().mockResolvedValue({ ...invoice, status: 'issued' }),
    voidInvoice: vi.fn(),
    recordPayment: vi.fn().mockResolvedValue(payment),
    allocatePayment: vi.fn().mockResolvedValue(allocation),
    voidPaymentAllocation: vi.fn(),
    voidPayment: vi.fn(),
  } as unknown as FinanceRpcClient;
}

let hook: ReturnType<typeof useCashierPaymentFlow>;
function Harness({ tenant = tenantId, patient = patientId, repository, rpcClient }: { tenant?: string | null; patient?: string | null; repository: FinanceRepository; rpcClient: FinanceRpcClient }) {
  const current = useCashierPaymentFlow({ tenantId: tenant, patientId: patient, repository, rpcClient });
  useEffect(() => { hook = current; }, [current]);
  return null;
}

async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }

describe('useCashierPaymentFlow', () => {
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

  it('does not fetch without tenantId', async () => {
    const repository = createRepository();
    await renderHook({ tenant: null, repository });
    expect(repository.getPatientFinanceSummary).not.toHaveBeenCalled();
  });

  it('does not fetch without patientId', async () => {
    const repository = createRepository();
    await renderHook({ patient: null, repository });
    expect(repository.getPatientFinanceSummary).not.toHaveBeenCalled();
  });

  it('loads finance summary and open invoices through FinanceRepository', async () => {
    const { repository } = await renderHook();
    expect(repository.getPatientFinanceSummary).toHaveBeenCalledWith({ tenantId, patientId });
    expect(repository.listInvoices).toHaveBeenCalledWith(expect.objectContaining({ tenantId, patientId }));
    expect(hook.summary?.balanceAmount).toBe(1000);
    expect(hook.openInvoices.map((item) => item.id)).toEqual(['invoice-1']);
  });

  it('filters draft invoices without items out of open invoices', async () => {
    const repository = createRepository({ listInvoices: vi.fn().mockResolvedValue([{ ...draftInvoice, id: 'draft-empty' }]), listInvoiceItems: vi.fn().mockResolvedValue([]) } as Partial<FinanceRepository>);
    await renderHook({ repository });
    expect(hook.openInvoices).toEqual([]);
  });

  it('recordAndAllocatePayment calls FinanceRpcClient.recordPayment and allocatePayment', async () => {
    const { rpcClient } = await renderHook();
    act(() => hook.selectInvoice('invoice-1', true));
    await act(async () => { await hook.recordAndAllocatePayment({ amount: 1000, paymentMethod: 'cash', externalReference: 'SMOKE-CASHIER-PAYMENT-FLOW-001' }); });
    expect(rpcClient.recordPayment).toHaveBeenCalledWith(expect.objectContaining({ tenantId, patientId, amount: 1000, paymentMethod: 'cash' }));
    expect(rpcClient.allocatePayment).toHaveBeenCalledWith(expect.objectContaining({ tenantId, paymentId: payment.id, invoiceId: invoice.id, amount: 1000 }));
    expect(hook.result?.allocatedAmount).toBe(1000);
  });

  it('issues draft invoices before payment allocation', async () => {
    const repository = createRepository({ listInvoices: vi.fn().mockResolvedValue([draftInvoice]), listInvoiceItems: vi.fn().mockResolvedValue([draftItem]) } as Partial<FinanceRepository>);
    const rpcClient = createRpcClient();
    await renderHook({ repository, rpcClient });
    act(() => hook.selectInvoice('draft-1', true));
    await act(async () => { await hook.recordAndAllocatePayment({ amount: 1000, paymentMethod: 'cash' }); });
    expect(rpcClient.issueInvoice).toHaveBeenCalledWith({ tenantId, invoiceId: 'draft-1' });
  });

  it('failed payment surfaces safe error', async () => {
    const rpcClient = createRpcClient();
    vi.mocked(rpcClient.recordPayment).mockRejectedValueOnce(new Error('{"stack":"raw"}'));
    await renderHook({ rpcClient });
    act(() => hook.selectInvoice('invoice-1', true));
    await expect(hook.recordAndAllocatePayment({ amount: 1000, paymentMethod: 'cash' })).rejects.toThrow('Не удалось сохранить оплату.');
  });

  it('over-allocation is blocked before RPC writes', async () => {
    const rpcClient = createRpcClient();
    await renderHook({ rpcClient });
    act(() => hook.selectInvoice('invoice-1', true));
    await expect(hook.recordAndAllocatePayment({ amount: 2000, paymentMethod: 'cash' })).rejects.toThrow('Сумма распределения превышает доступную сумму оплаты.');
    expect(rpcClient.recordPayment).not.toHaveBeenCalled();
  });

  it('source avoids forbidden direct persistence boundaries', () => {
    const source = String(useCashierPaymentFlow);
    expect(source).not.toContain('completed_services');
    expect(source).not.toContain('patients.balance');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('service_role');
    expect(source).not.toMatch(/\bsupabase\.from\(|\bclient\.from\(/);
  });
});
