// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInvoiceWriteOffFlow } from './useInvoiceWriteOffFlow';
import type { FinanceRepository, FinancialAdjustment, Invoice, InvoiceWriteOffEligibility } from '../repositories/FinanceRepository';
import type { FinanceRpcClient } from '../repositories/FinanceRpcClient';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const tenantId = 'tenant-1';
const invoiceId = 'invoice-1';
const invoice = { id: invoiceId, tenantId, patientId: 'patient-1', status: 'issued', currency: 'KZT', totalAmount: 1000, paidAmount: 0, balanceAmount: 1000 } as Invoice;
const eligibility = { invoice, invoiceTotalAmount: 1000, paidAmount: 0, approvedWriteOffAmount: 0, reservedWriteOffAmount: 0, availableWriteOffAmount: 1000, eligible: true, ineligibilityReason: null, currency: 'KZT' } as InvoiceWriteOffEligibility;
const pendingWriteOff = { id: 'writeoff-1', tenantId, patientId: invoice.patientId, invoiceId, adjustmentType: 'write_off', status: 'active', amount: 400, currency: 'KZT', reason: 'Reason', createdAt: '2026-07-10T00:00:00Z' } as FinancialAdjustment;

function createRepository(overrides: Partial<FinanceRepository> = {}): FinanceRepository {
  return {
    getInvoiceWriteOffEligibility: vi.fn().mockResolvedValue(eligibility),
    listFinancialAdjustments: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as FinanceRepository;
}

function createRpcClient(overrides: Partial<FinanceRpcClient> = {}): FinanceRpcClient {
  return {
    requestInvoiceWriteOff: vi.fn().mockResolvedValue(pendingWriteOff),
    approveInvoiceWriteOff: vi.fn().mockResolvedValue({ ...pendingWriteOff, status: 'approved' }),
    rejectInvoiceWriteOff: vi.fn().mockResolvedValue({ ...pendingWriteOff, status: 'rejected' }),
    voidInvoiceWriteOff: vi.fn().mockResolvedValue({ ...pendingWriteOff, status: 'voided' }),
    ...overrides,
  } as unknown as FinanceRpcClient;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }

describe('useInvoiceWriteOffFlow', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof useInvoiceWriteOffFlow>;
  let defaultRepository: FinanceRepository;
  let defaultRpcClient: FinanceRpcClient;

  function Harness({ tenant = tenantId, invoiceValue = invoiceId, role = 'clinic_admin', repository = defaultRepository, rpcClient = defaultRpcClient }: { tenant?: string | null; invoiceValue?: string | null; role?: string; repository?: FinanceRepository; rpcClient?: FinanceRpcClient }) {
    latest = useInvoiceWriteOffFlow({ tenantId: tenant, invoiceId: invoiceValue, role, repository, rpcClient });
    return null;
  }

  beforeEach(() => { defaultRepository = createRepository(); defaultRpcClient = createRpcClient(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); document.body.removeChild(container); vi.restoreAllMocks(); });

  it('does not fetch without tenant or invoice', async () => {
    const repository = createRepository();
    await act(async () => { root.render(<Harness tenant={null} repository={repository} />); }); await flush();
    expect(repository.getInvoiceWriteOffEligibility).not.toHaveBeenCalled();
    expect(latest.eligibility).toBeNull();
  });

  it('loads eligibility and write-off history', async () => {
    const repository = createRepository({ listFinancialAdjustments: vi.fn().mockResolvedValue([pendingWriteOff]) });
    await act(async () => { root.render(<Harness repository={repository} />); }); await flush();
    expect(latest.eligibility?.availableWriteOffAmount).toBe(1000);
    expect(latest.writeOffs).toHaveLength(1);
  });

  it('allows only owner/admin mutations', async () => {
    await act(async () => { root.render(<Harness role="cashier" />); }); await flush();
    expect(latest.capabilities.canRequest).toBe(false);
    expect(latest.capabilities.canApprove).toBe(false);
    await act(async () => { root.render(<Harness role="clinic_owner" />); }); await flush();
    expect(latest.capabilities.canRequest).toBe(true);
    expect(latest.capabilities.canVoid).toBe(true);
  });

  it('validates amount and reason before request', async () => {
    const rpcClient = createRpcClient();
    await act(async () => { root.render(<Harness rpcClient={rpcClient} />); }); await flush();
    await act(async () => { await latest.requestWriteOff({ amount: 1200, reason: 'x' }); });
    expect(latest.actionMessage).toBe('Сумма превышает доступную.');
    await act(async () => { await latest.requestWriteOff({ amount: 100, reason: '   ' }); });
    expect(latest.actionMessage).toBe('Укажите причину списания.');
    expect(rpcClient.requestInvoiceWriteOff).not.toHaveBeenCalled();
  });

  it('creates request with idempotency and controlled metadata', async () => {
    const repository = createRepository();
    const rpcClient = createRpcClient();
    await act(async () => { root.render(<Harness repository={repository} rpcClient={rpcClient} />); }); await flush();
    await act(async () => { await latest.requestWriteOff({ amount: 400, reason: ' Write off ' }); });
    expect(rpcClient.requestInvoiceWriteOff).toHaveBeenCalledWith(expect.objectContaining({ tenantId, invoiceId, amount: 400, reason: 'Write off', metadata: { source: 'patient_finance_ui' } }));
    expect(latest.actionMessage).toBe('Заявка на списание создана.');
    expect(repository.getInvoiceWriteOffEligibility).toHaveBeenCalledTimes(2);
  });

  it('retains request idempotency key across retry', async () => {
    const requestInvoiceWriteOff = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(pendingWriteOff);
    const rpcClient = createRpcClient({ requestInvoiceWriteOff });
    await act(async () => { root.render(<Harness rpcClient={rpcClient} />); }); await flush();
    await act(async () => { await latest.requestWriteOff({ amount: 400, reason: 'Reason' }); });
    await act(async () => { await latest.requestWriteOff({ amount: 400, reason: 'Reason' }); });
    expect(requestInvoiceWriteOff.mock.calls[0][0].idempotencyKey).toBe(requestInvoiceWriteOff.mock.calls[1][0].idempotencyKey);
  });

  it('prevents double submit', async () => {
    const pending = deferred<FinancialAdjustment>();
    const requestInvoiceWriteOff = vi.fn().mockReturnValue(pending.promise);
    const rpcClient = createRpcClient({ requestInvoiceWriteOff });
    await act(async () => { root.render(<Harness rpcClient={rpcClient} />); }); await flush();
    let first!: Promise<unknown>; let second!: Promise<unknown>;
    act(() => {
      first = latest.requestWriteOff({ amount: 400, reason: 'Reason' });
      second = latest.requestWriteOff({ amount: 400, reason: 'Reason' });
    });
    expect(requestInvoiceWriteOff).toHaveBeenCalledOnce();
    pending.resolve(pendingWriteOff);
    await act(async () => { await Promise.all([first, second]); });
  });

  it('runs approve reject and void for admin', async () => {
    const rpcClient = createRpcClient();
    await act(async () => { root.render(<Harness rpcClient={rpcClient} />); }); await flush();
    await act(async () => { await latest.approveWriteOff('writeoff-1'); await latest.rejectWriteOff('writeoff-1', 'No'); await latest.voidWriteOff('writeoff-1', 'Reopen'); });
    expect(rpcClient.approveInvoiceWriteOff).toHaveBeenCalledOnce();
    expect(rpcClient.rejectInvoiceWriteOff).toHaveBeenCalledOnce();
    expect(rpcClient.voidInvoiceWriteOff).toHaveBeenCalledOnce();
  });

  it('clears old invoice data and ignores stale response', async () => {
    const slow = deferred<InvoiceWriteOffEligibility | null>();
    const repository = createRepository({
      getInvoiceWriteOffEligibility: vi.fn(({ invoiceId: requested }) => requested === invoiceId ? slow.promise : Promise.resolve({ ...eligibility, invoice: { ...invoice, id: 'invoice-2' }, availableWriteOffAmount: 600 })),
    });
    await act(async () => { root.render(<Harness invoiceValue={invoiceId} repository={repository} />); });
    await act(async () => { root.render(<Harness invoiceValue="invoice-2" repository={repository} />); });
    await flush();
    expect(latest.eligibility?.invoice.id).toBe('invoice-2');
    slow.resolve(eligibility);
    await flush();
    expect(latest.eligibility?.invoice.id).toBe('invoice-2');
  });

  it('never exposes raw errors', async () => {
    const repository = createRepository({ getInvoiceWriteOffEligibility: vi.fn().mockRejectedValue(new Error('SQLSTATE approve_invoice_write_off secret')) });
    await act(async () => { root.render(<Harness repository={repository} />); }); await flush();
    expect(latest.error?.message).toBe('Не удалось загрузить данные списания.');
    expect(latest.error?.message).not.toContain('SQLSTATE');
  });
});
