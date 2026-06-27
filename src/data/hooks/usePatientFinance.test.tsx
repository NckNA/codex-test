// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePatientFinance, type UsePatientFinanceResult } from './usePatientFinance';
import type { FinanceRepository, Invoice, PatientFinanceSummary, Payment, PaymentAllocation } from '../repositories/FinanceRepository';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const tenantId = 'tenant-1';
const patientId = 'patient-1';
const summary = {
  tenantId,
  patientId,
  invoiceTotalAmount: 1000,
  paidAmount: 1000,
  allocatedPaymentAmount: 1000,
  refundedAmount: 0,
  discountAmount: 0,
  writeOffAmount: 0,
  adjustmentAmount: 0,
  balanceAmount: 0,
  creditAmount: 0,
  openInvoiceCount: 1,
  unpaidInvoiceCount: 0,
  partiallyPaidInvoiceCount: 0,
  lastPaymentAt: '2026-06-21T10:00:00.000Z',
} as PatientFinanceSummary;
const invoice = { id: 'invoice-1', tenantId, patientId, invoiceNumber: 'INV-1', status: 'issued', currency: 'KZT', totalAmount: 1000, paidAmount: 0, balanceAmount: 1000 } as Invoice;
const payment = { id: 'payment-1', tenantId, patientId, status: 'received', paymentMethod: 'cash', amount: 1000, currency: 'KZT', receivedAt: '2026-06-21T10:00:00.000Z' } as Payment;
const allocation = { id: 'allocation-1', tenantId, patientId, paymentId: payment.id, invoiceId: invoice.id, invoiceItemId: null, status: 'active', amount: 1000, currency: 'KZT', allocatedAt: '2026-06-21T10:05:00.000Z' } as PaymentAllocation;

function createRepository(): FinanceRepository {
  return {
    getPatientFinanceSummary: vi.fn().mockResolvedValue(summary),
    listInvoices: vi.fn().mockResolvedValue([invoice]),
    listInvoiceItems: vi.fn().mockResolvedValue([]),
    listPayments: vi.fn().mockResolvedValue([payment]),
    listPaymentAllocations: vi.fn().mockResolvedValue([allocation]),
    listRefunds: vi.fn().mockResolvedValue([]),
    listFinancialAdjustments: vi.fn().mockResolvedValue([]),
  } as unknown as FinanceRepository;
}

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

describe('usePatientFinance', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UsePatientFinanceResult | null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  function Probe({ tenant = tenantId, patient = patientId, repository }: { tenant?: string | null; patient?: string | null; repository: FinanceRepository }) {
    latest = usePatientFinance({ tenantId: tenant, patientId: patient, repository });
    return null;
  }

  it('does not fetch without tenantId', async () => {
    const repository = createRepository();
    await act(async () => { root.render(<Probe tenant={null} repository={repository} />); });
    await flush();
    expect(repository.getPatientFinanceSummary).not.toHaveBeenCalled();
    expect(latest?.invoices).toEqual([]);
  });

  it('does not fetch without patientId', async () => {
    const repository = createRepository();
    await act(async () => { root.render(<Probe patient={null} repository={repository} />); });
    await flush();
    expect(repository.getPatientFinanceSummary).not.toHaveBeenCalled();
  });

  it('loads finance summary and lists through FinanceRepository', async () => {
    const repository = createRepository();
    await act(async () => { root.render(<Probe repository={repository} />); });
    await flush();
    expect(repository.getPatientFinanceSummary).toHaveBeenCalledWith({ tenantId, patientId });
    expect(repository.listInvoices).toHaveBeenCalledWith(expect.objectContaining({ tenantId, patientId }));
    expect(latest?.summary?.balanceAmount).toBe(0);
    expect(latest?.payments).toEqual([payment]);
    expect(latest?.paymentAllocations).toEqual([allocation]);
  });

  it('refresh reloads finance data', async () => {
    const repository = createRepository();
    await act(async () => { root.render(<Probe repository={repository} />); });
    await flush();
    await act(async () => { await latest?.refresh(); });
    expect(repository.getPatientFinanceSummary).toHaveBeenCalledTimes(2);
  });

  it('surfaces repository errors safely', async () => {
    const repository = createRepository();
    vi.mocked(repository.getPatientFinanceSummary).mockRejectedValueOnce(new Error('repository failed'));
    await act(async () => { root.render(<Probe repository={repository} />); });
    await flush();
    expect(latest?.isError).toBe(true);
    expect(latest?.error?.message).toBe('repository failed');
  });
});
