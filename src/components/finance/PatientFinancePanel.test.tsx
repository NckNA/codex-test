// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientFinancePanel } from './PatientFinancePanel';
import type { FinanceRepository, Invoice, InvoiceItem, PatientFinanceSummary, Payment, PaymentAllocation } from '../../data/repositories/FinanceRepository';
import type { FinanceRpcClient } from '../../data/repositories/FinanceRpcClient';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const tenantId = 'tenant-1';
const patientId = 'patient-1';
const summary = {
  tenantId,
  patientId,
  asOf: '2026-07-11T00:00:00Z',
  modelVersion: 'finance-summary-v1',
  factComplete: true,
  currencies: [{
    currency: 'KZT', totalInvoiced: 1000, activeAllocatedAmount: 1000, cashReceived: 1000,
    completedRefundAmount: 0, approvedWriteOffAmount: 0, currentDebt: 0,
    grossUnallocatedAmount: 0, refundReservedAmount: 0, reservedDepositAmount: 0,
    availableCreditAmount: 0, netPositionAmount: 0, openInvoiceCount: 1,
    unpaidInvoiceCount: 0, partiallyPaidInvoiceCount: 0, lastPaymentAt: '2026-06-21T10:00:00.000Z',
  }],
  warnings: [],
} as PatientFinanceSummary;
const invoice = { id: 'invoice-1', tenantId, patientId, invoiceNumber: 'INV-1', status: 'draft', currency: 'KZT', issueDate: null, dueDate: null, totalAmount: 1000, paidAmount: 0, balanceAmount: 1000, notes: 'Invoice note' } as Invoice;
const invoiceItem = { id: 'item-1', tenantId, patientId, invoiceId: invoice.id, serviceName: 'Smoke finance service', serviceCode: 'SMK', completedServiceId: 'service-1', toothNumber: '16', toothSurface: 'O', quantity: 1, unitPrice: 1000, discountAmount: 0, adjustmentAmount: 0, totalAmount: 1000, status: 'active' } as InvoiceItem;
const payment = { id: 'payment-1', tenantId, patientId, status: 'received', paymentMethod: 'cash', amount: 1000, currency: 'KZT', receivedAt: '2026-06-21T10:00:00.000Z', payerName: 'Patient', externalReference: 'SMOKE-PATIENT-FINANCE-UI-001', notes: 'Payment note' } as Payment;
const allocation = { id: 'allocation-1', tenantId, patientId, paymentId: payment.id, invoiceId: invoice.id, invoiceItemId: null, status: 'active', amount: 1000, currency: 'KZT', allocatedAt: '2026-06-21T10:05:00.000Z' } as PaymentAllocation;
const billedService = { completedServiceId: 'service-1', serviceName: 'Already billed', serviceCode: null, toothNumber: null, toothSurface: null, quantity: 1, unitPrice: 1000, currency: 'KZT', billingState: 'billed', invoiceId: 'invoice-void', invoiceItemId: 'item-void', invoiceNumber: 'INV-VOID', invoiceStatus: 'voided', billedAt: '2026-07-11T00:00:00.000Z' } as const;
const unbilledService = { completedServiceId: 'service-2', serviceName: 'Selectable service', serviceCode: 'SEL', toothNumber: '16', toothSurface: 'O', quantity: 2, unitPrice: 1500, currency: 'KZT', billingState: 'unbilled', invoiceId: null, invoiceItemId: null, invoiceNumber: null, invoiceStatus: null, billedAt: null } as const;
const unavailableService = { completedServiceId: 'service-3', serviceName: 'Unavailable service', serviceCode: null, toothNumber: null, toothSurface: null, quantity: 1, unitPrice: 1, currency: 'KZT', billingState: 'unavailable', invoiceId: null, invoiceItemId: null, invoiceNumber: null, invoiceStatus: null, billedAt: null } as const;

function createRepository({ empty = false }: { empty?: boolean } = {}): FinanceRepository {
  return {
    getPatientFinanceSummary: vi.fn().mockResolvedValue(summary),
    listInvoices: vi.fn().mockResolvedValue(empty ? [] : [invoice]),
    listInvoiceItems: vi.fn().mockResolvedValue(empty ? [] : [invoiceItem]),
    listPayments: vi.fn().mockResolvedValue(empty ? [] : [payment]),
    listPaymentAllocations: vi.fn().mockResolvedValue(empty ? [] : [allocation]),
    listRefunds: vi.fn().mockResolvedValue([]),
    listFinancialAdjustments: vi.fn().mockResolvedValue([]),
    getCompletedServiceBillingEligibility: vi.fn().mockResolvedValue([]),
    getPatientFundReservations: vi.fn().mockResolvedValue([]),
    getPaymentFundCapacity: vi.fn().mockResolvedValue(null),
    getPaymentRefundability: vi.fn().mockResolvedValue({ payment, paymentAmount: 1000, activeAllocatedAmount: 1000, completedRefundAmount: 0, reservedRefundAmount: 0, refundableAmount: 0, hasActiveAllocations: true, refundCount: 0, currency: 'KZT' }),
    getInvoiceWriteOffEligibility: vi.fn().mockResolvedValue({ invoice, invoiceTotalAmount: 1000, paidAmount: 0, approvedWriteOffAmount: 0, reservedWriteOffAmount: 0, availableWriteOffAmount: 0, eligible: false, ineligibilityReason: 'Invoice status draft is not eligible for write-off.', currency: 'KZT' }),
  } as unknown as FinanceRepository;
}

function createRpcClient(): FinanceRpcClient {
  return {
    createInvoice: vi.fn().mockResolvedValue(invoice),
    addInvoiceItem: vi.fn().mockResolvedValue(invoiceItem),
    issueInvoice: vi.fn().mockResolvedValue({ ...invoice, status: 'issued' }),
    voidInvoice: vi.fn().mockResolvedValue({ ...invoice, status: 'voided' }),
    recordPayment: vi.fn().mockResolvedValue(payment),
    allocatePayment: vi.fn().mockResolvedValue(allocation),
    voidPaymentAllocation: vi.fn().mockResolvedValue({ ...allocation, status: 'voided' }),
    voidPayment: vi.fn().mockResolvedValue({ ...payment, status: 'voided' }),
    createPatientFundReservation: vi.fn(),
    releasePatientFundReservation: vi.fn(),
    allocateReservedCredit: vi.fn(),
    requestRefund: vi.fn(),
    approveRefund: vi.fn(),
    completeRefund: vi.fn(),
    rejectRefund: vi.fn(),
    voidRefund: vi.fn(),
    requestInvoiceWriteOff: vi.fn(),
    approveInvoiceWriteOff: vi.fn(),
    rejectInvoiceWriteOff: vi.fn(),
    voidInvoiceWriteOff: vi.fn(),
  } as unknown as FinanceRpcClient;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

describe('PatientFinancePanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  async function renderPanel({ role = 'clinic_admin', repository = createRepository(), rpcClient = createRpcClient(), tenant = tenantId }: { role?: string | null; repository?: FinanceRepository; rpcClient?: FinanceRpcClient; tenant?: string | null } = {}) {
    await act(async () => {
      root.render(<PatientFinancePanel tenantId={tenant} patientId={patientId} role={role} repository={repository} rpcClient={rpcClient} />);
    });
    await flush();
    return { repository, rpcClient };
  }

  it('renders loading and then empty finance state', async () => {
    const invoicesResult = deferred<Invoice[]>();
    const repository = createRepository({ empty: true });
    vi.mocked(repository.listInvoices).mockReturnValueOnce(invoicesResult.promise);

    await act(async () => {
      root.render(<PatientFinancePanel tenantId={tenantId} patientId={patientId} role="clinic_admin" repository={repository} rpcClient={createRpcClient()} />);
    });
    expect(container.querySelector('[data-testid="patient-finance-loading"]')).not.toBeNull();

    invoicesResult.resolve([]);
    await flush();
    expect(container.querySelector('[data-testid="patient-finance-empty"]')).not.toBeNull();
  });

  it('renders summary, invoices, items, payments and allocations', async () => {
    await renderPanel();
    expect(container.querySelector('[data-testid="patient-finance-summary-card"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="patient-fund-reservations-panel"]')).not.toBeNull();
    expect(container.textContent).toContain('Кредит и депозиты');
    expect(container.querySelector('[data-testid="finance-invoice-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="finance-invoice-item-item-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="finance-payment-card-payment-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="finance-allocation-card-allocation-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="refund-actions-panel-payment-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="writeoff-actions-panel-invoice-1"]')).not.toBeNull();
    expect(container.textContent).toContain('Текущий долг');
    expect(container.textContent).toContain('Smoke finance service');
    expect(container.textContent).not.toContain('metadata');
  });

  it('admin sees create, issue, record, allocate and void actions', async () => {
    await renderPanel({ role: 'clinic_admin' });
    expect(container.querySelector('[data-testid="finance-create-invoice-form"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="finance-issue-invoice-invoice-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="finance-record-payment-form"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="finance-allocation-form"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="finance-void-invoice-invoice-1"]')).not.toBeNull();
  });

  it('cashier can mutate finance but cannot see void actions', async () => {
    await renderPanel({ role: 'cashier' });
    expect(container.querySelector('[data-testid="finance-create-invoice-form"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="finance-record-payment-form"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="finance-allocation-form"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="finance-void-invoice-invoice-1"]')).toBeNull();
    expect(container.querySelector('[data-testid="finance-void-payment-box"]')).toBeNull();
  });

  it('doctor and registrar see no mutation actions', async () => {
    await renderPanel({ role: 'doctor' });
    expect(container.querySelector('[data-testid="finance-create-invoice-form"]')).toBeNull();
    expect(container.querySelector('[data-testid="finance-record-payment-form"]')).toBeNull();
    await act(async () => { root.render(<PatientFinancePanel tenantId={tenantId} patientId={patientId} role="registrar" repository={createRepository()} rpcClient={createRpcClient()} />); });
    await flush();
    expect(container.querySelector('[data-testid="finance-allocation-form"]')).toBeNull();
  });

  it('renders no-tenant blocked state', async () => {
    await renderPanel({ tenant: null });
    expect(container.querySelector('[data-testid="patient-finance-no-tenant"]')).not.toBeNull();
  });

  it('create invoice form calls action', async () => {
    const { rpcClient } = await renderPanel();
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="finance-create-invoice-submit"]')?.click(); });
    expect(rpcClient.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ tenantId, patientId }));
  });

  it('add item form validates serviceName and amount', async () => {
    const { rpcClient } = await renderPanel();
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="finance-add-item-submit"]')?.click(); });
    expect(container.textContent).toContain('Название услуги обязательно.');
    expect(rpcClient.addInvoiceItem).not.toHaveBeenCalled();
  });

  it('renders billed services disabled with their historical invoice number while keeping manual items available', async () => {
    const repository = createRepository();
    vi.mocked(repository.getCompletedServiceBillingEligibility).mockResolvedValue([billedService]);
    await renderPanel({ repository });
    const select = container.querySelector<HTMLSelectElement>('[data-testid="finance-completed-service-select"]');
    expect(select?.options[0]?.text).toContain('Ручная позиция');
    expect(select?.options[1]?.disabled).toBe(true);
    expect(select?.options[1]?.text).toContain('Уже включено в счёт');
    expect(select?.options[1]?.text).toContain('INV-VOID');
  });

  it('keeps unavailable services disabled and fills a selectable completed service while preserving manual', async () => {
    const repository = createRepository();
    vi.mocked(repository.getCompletedServiceBillingEligibility).mockResolvedValue([unbilledService, unavailableService]);
    await renderPanel({ repository });
    const select = container.querySelector<HTMLSelectElement>('[data-testid="finance-completed-service-select"]');
    expect(select?.options[0]?.value).toBe('');
    expect(select?.options[2]?.disabled).toBe(true);
    await act(async () => {
      if (!select) return;
      select.value = unbilledService.completedServiceId;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector<HTMLInputElement>('[data-testid="finance-item-service-name"]')?.value).toBe('Selectable service');
    expect(container.querySelector<HTMLInputElement>('[data-testid="finance-item-service-code"]')?.value).toBe('SEL');
    expect(container.querySelector<HTMLInputElement>('[data-testid="finance-item-tooth-number"]')?.value).toBe('16');
    expect(container.querySelector<HTMLInputElement>('[data-testid="finance-item-tooth-surface"]')?.value).toBe('O');
    expect(container.querySelector<HTMLInputElement>('[data-testid="finance-item-quantity"]')?.value).toBe('2');
    expect(container.querySelector<HTMLInputElement>('[data-testid="finance-item-unit-price"]')?.value).toBe('1500');
  });

  it('refreshes and displays the safe duplicate message after the backend rejects a selected service', async () => {
    const repository = createRepository();
    const rpcClient = createRpcClient();
    vi.mocked(repository.getCompletedServiceBillingEligibility).mockResolvedValue([unbilledService]);
    vi.mocked(rpcClient.addInvoiceItem).mockRejectedValueOnce(new Error('Эта выполненная услуга уже включена в другой счёт.'));
    await renderPanel({ repository, rpcClient });
    const select = container.querySelector<HTMLSelectElement>('[data-testid="finance-completed-service-select"]');
    await act(async () => {
      if (!select) return;
      select.value = unbilledService.completedServiceId;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="finance-add-item-submit"]')?.click(); });
    expect(rpcClient.addInvoiceItem).toHaveBeenCalledWith(expect.objectContaining({ completedServiceId: unbilledService.completedServiceId }));
    expect(repository.getPatientFinanceSummary).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Услуга уже была включена в другой счёт. Данные обновлены.');
  });

  it('disables a pending item submission so a second click does not repeat the RPC', async () => {
    const repository = createRepository();
    const rpcClient = createRpcClient();
    const pending = deferred<InvoiceItem>();
    vi.mocked(repository.getCompletedServiceBillingEligibility).mockResolvedValue([unbilledService]);
    vi.mocked(rpcClient.addInvoiceItem).mockReturnValueOnce(pending.promise);
    await renderPanel({ repository, rpcClient });
    const select = container.querySelector<HTMLSelectElement>('[data-testid="finance-completed-service-select"]');
    await act(async () => {
      if (!select) return;
      select.value = unbilledService.completedServiceId;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="finance-add-item-submit"]')?.click(); });
    const submit = container.querySelector<HTMLButtonElement>('[data-testid="finance-add-item-submit"]');
    expect(submit?.disabled).toBe(true);
    await act(async () => { submit?.click(); });
    expect(rpcClient.addInvoiceItem).toHaveBeenCalledTimes(1);
    pending.resolve(invoiceItem);
    await flush();
  });

  it('record payment and allocation forms validate required fields', async () => {
    const { rpcClient } = await renderPanel();
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="finance-record-payment-submit"]')?.click(); });
    expect(container.textContent).toContain('Сумма должна быть больше 0.');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="finance-allocation-submit"]')?.click(); });
    expect(container.textContent).toContain('Платёж не выбран.');
    expect(rpcClient.recordPayment).not.toHaveBeenCalled();
    expect(rpcClient.allocatePayment).not.toHaveBeenCalled();
  });
});
