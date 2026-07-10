// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CashierPaymentPanel } from './CashierPaymentPanel';
import { CashierPaymentForm } from './CashierPaymentForm';
import { useCashierPaymentFlow } from '../../data/hooks/useCashierPaymentFlow';
import type { FinanceRepository, Invoice, InvoiceItem, PatientFinanceSummary, Payment, PaymentAllocation } from '../../data/repositories/FinanceRepository';
import type { FinanceRpcClient } from '../../data/repositories/FinanceRpcClient';
import type { PatientRepository } from '../../data/repositories/PatientRepository';
import type { Patient } from '../../types';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const tenantId = 'tenant-1';
const patientId = 'patient-1';
const patient = { id: patientId, fullName: 'Smoke Cashier Patient CASHIER-PAYMENT-FLOW-001', phone: '+7001', source: 'phone', status: 'active', createdAt: '2026-06-27T00:00:00Z' } as Patient;
const summary = { tenantId, patientId, invoiceTotalAmount: 1000, paidAmount: 0, allocatedPaymentAmount: 0, refundedAmount: 0, discountAmount: 0, writeOffAmount: 0, adjustmentAmount: 0, balanceAmount: 1000, creditAmount: 0, openInvoiceCount: 1, unpaidInvoiceCount: 1, partiallyPaidInvoiceCount: 0, lastPaymentAt: null } as PatientFinanceSummary;
const invoice = { id: 'invoice-1', tenantId, patientId, invoiceNumber: 'INV-1', status: 'issued', currency: 'KZT', issueDate: null, dueDate: null, totalAmount: 1000, paidAmount: 0, balanceAmount: 1000, notes: 'Smoke cashier invoice CASHIER-PAYMENT-FLOW-001' } as Invoice;
const item = { id: 'item-1', tenantId, patientId, invoiceId: invoice.id, serviceName: 'Smoke cashier service CASHIER-PAYMENT-FLOW-001', quantity: 1, unitPrice: 1000, totalAmount: 1000, status: 'active' } as InvoiceItem;
const payment = { id: 'payment-1', tenantId, patientId, status: 'received', paymentMethod: 'cash', amount: 1000, currency: 'KZT', receivedAt: '2026-06-27T10:00:00Z', externalReference: 'SMOKE-CASHIER-PAYMENT-FLOW-001' } as Payment;
const allocation = { id: 'allocation-1', tenantId, patientId, paymentId: payment.id, invoiceId: invoice.id, invoiceItemId: null, status: 'active', amount: 1000, currency: 'KZT', allocatedAt: '2026-06-27T10:01:00Z' } as PaymentAllocation;

function createPatientRepo(): PatientRepository {
  return { listPatients: vi.fn().mockResolvedValue([patient]), getPatientById: vi.fn(), updatePatient: vi.fn(), createPatient: vi.fn() } as unknown as PatientRepository;
}
function createFinanceRepo(): FinanceRepository {
  return { getPatientFinanceSummary: vi.fn().mockResolvedValue(summary), listInvoices: vi.fn().mockResolvedValue([invoice]), listInvoiceItems: vi.fn().mockResolvedValue([item]), listPayments: vi.fn().mockResolvedValue([]), listPaymentAllocations: vi.fn().mockResolvedValue([]), listRefunds: vi.fn().mockResolvedValue([]), listFinancialAdjustments: vi.fn().mockResolvedValue([]) } as unknown as FinanceRepository;
}
function createRpcClient(): FinanceRpcClient {
  return { createInvoice: vi.fn(), addInvoiceItem: vi.fn(), issueInvoice: vi.fn().mockResolvedValue(invoice), voidInvoice: vi.fn(), recordPayment: vi.fn().mockResolvedValue(payment), allocatePayment: vi.fn().mockResolvedValue(allocation), voidPaymentAllocation: vi.fn(), voidPayment: vi.fn() } as unknown as FinanceRpcClient;
}

async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }

describe('CashierPaymentPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); document.body.removeChild(container); vi.restoreAllMocks(); });

  async function renderPanel(role: string | null = 'cashier', repos = { patientRepository: createPatientRepo(), financeRepository: createFinanceRepo(), rpcClient: createRpcClient() }) {
    await act(async () => { root.render(<CashierPaymentPanel tenantId={tenantId} role={role} {...repos} />); });
    await flush();
    return repos;
  }

  async function searchAndSelect(repos = { patientRepository: createPatientRepo(), financeRepository: createFinanceRepo(), rpcClient: createRpcClient() }) {
    await renderPanel('cashier', repos);
    const query = container.querySelector<HTMLInputElement>('[data-testid="cashier-patient-query"]')!;
    query.value = 'Smoke';
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="cashier-patient-search-submit"]')!.click(); });
    await flush();
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="cashier-select-patient-patient-1"]')!.click(); });
    await flush();
    return repos;
  }

  it('renders no-tenant state', async () => {
    await act(async () => { root.render(<CashierPaymentPanel tenantId={null} role="cashier" />); });
    expect(container.querySelector('[data-testid="cashier-no-tenant"]')).not.toBeNull();
  });

  it('blocks doctor, registrar and unknown roles', async () => {
    await renderPanel('doctor');
    expect(container.querySelector('[data-testid="cashier-no-access"]')).not.toBeNull();
    await act(async () => { root.render(<CashierPaymentPanel tenantId={tenantId} role="registrar" />); });
    expect(container.querySelector('[data-testid="cashier-payment-form"]')).toBeNull();
    await act(async () => { root.render(<CashierPaymentPanel tenantId={tenantId} role="unknown" />); });
    expect(container.querySelector('[data-testid="cashier-no-access"]')).not.toBeNull();
  });

  it('cashier can search and select patient', async () => {
    const { patientRepository } = await searchAndSelect();
    expect(patientRepository.listPatients).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="cashier-selected-patient"]')?.textContent).toContain(patient.fullName);
  });

  it('renders finance summary, open invoice list, allocation preview and payment form', async () => {
    await searchAndSelect();
    expect(container.querySelector('[data-testid="cashier-finance-summary"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cashier-open-invoice-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cashier-allocation-preview"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cashier-payment-form"]')).not.toBeNull();
    expect(container.textContent).toContain('Smoke cashier service');
  });

  it('payment form validates amount after invoice selection', async () => {
    await searchAndSelect();
    await act(async () => { container.querySelector<HTMLInputElement>('[data-testid="cashier-select-invoice-invoice-1"]')!.click(); });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="cashier-payment-submit"]')!.click(); });
    expect(container.textContent).toContain('Сумма должна быть больше 0.');
  });

  it('successful submit calls record/allocate action and renders result panel', async () => {
    const repos = await searchAndSelect();
    await act(async () => { container.querySelector<HTMLInputElement>('[data-testid="cashier-select-invoice-invoice-1"]')!.click(); });
    const amount = container.querySelector<HTMLInputElement>('[data-testid="cashier-payment-amount"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(amount, '1000');
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    amount.dispatchEvent(new Event('change', { bubbles: true }));
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="cashier-payment-submit"]')!.click(); });
    await flush();
    expect(repos.rpcClient.recordPayment).toHaveBeenCalled();
    expect(repos.rpcClient.allocatePayment).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="cashier-payment-result"]')).not.toBeNull();
  });

  it('cashier does not see void controls or legal receipt/fiscal wording', async () => {
    await searchAndSelect();
    expect(container.textContent).not.toContain('Аннулировать');
    expect(container.textContent).not.toContain('Фискальный чек');
    expect(container.textContent).not.toContain('Официальная квитанция');
    expect(container.textContent).not.toContain('metadata');
  });

  it('admin and owner can access cashier page', async () => {
    await renderPanel('clinic_admin');
    expect(container.querySelector('[data-testid="cashier-patient-search"]')).not.toBeNull();
    await act(async () => { root.render(<CashierPaymentPanel tenantId={tenantId} role="clinic_owner" patientRepository={createPatientRepo()} financeRepository={createFinanceRepo()} rpcClient={createRpcClient()} />); });
    expect(container.querySelector('[data-testid="cashier-patient-search"]')).not.toBeNull();
  });

  it('cashier source avoids forbidden direct data and adjacent domains', () => {
    const sources = [String(CashierPaymentPanel), String(CashierPaymentForm), String(useCashierPaymentFlow)];
    for (const source of sources) {
      expect(source).not.toContain('supabase.rpc');
      expect(source).not.toMatch(/\bsupabase\.from\(|\bclient\.from\(/);
      expect(source).not.toContain('.insert(');
      expect(source).not.toContain('.update(');
      expect(source).not.toContain('.delete(');
      expect(source).not.toContain('.upsert(');
      expect(source).not.toContain('service_role');
      expect(source).not.toContain('PatientTimelineAggregator');
    }
  });
});
