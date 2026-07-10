// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WriteOffActions } from './WriteOffActions';
import type { FinanceRepository, FinancialAdjustment, Invoice, InvoiceWriteOffEligibility } from '../../data/repositories/FinanceRepository';
import type { FinanceRpcClient } from '../../data/repositories/FinanceRpcClient';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const tenantId = 'tenant-1';
const invoiceId = 'invoice-1';
const invoice = { id: invoiceId, tenantId, patientId: 'patient-1', status: 'issued', currency: 'KZT', totalAmount: 1000, paidAmount: 0, balanceAmount: 1000 } as Invoice;
const eligibility = { invoice, invoiceTotalAmount: 1000, paidAmount: 0, approvedWriteOffAmount: 100, reservedWriteOffAmount: 200, availableWriteOffAmount: 700, eligible: true, ineligibilityReason: null, currency: 'KZT' } as InvoiceWriteOffEligibility;
const pending = { id: 'writeoff-pending', tenantId, patientId: invoice.patientId, invoiceId, adjustmentType: 'write_off', status: 'active', amount: 200, currency: 'KZT', reason: 'Reason', createdAt: '2026-07-10T00:00:00Z' } as FinancialAdjustment;
const approved = { ...pending, id: 'writeoff-approved', status: 'approved', approvedAt: '2026-07-10T01:00:00Z' } as FinancialAdjustment;

function createRepository(data: InvoiceWriteOffEligibility = eligibility, writeOffs: FinancialAdjustment[] = [pending, approved]): FinanceRepository {
  return { getInvoiceWriteOffEligibility: vi.fn().mockResolvedValue(data), listFinancialAdjustments: vi.fn().mockResolvedValue(writeOffs) } as unknown as FinanceRepository;
}
function createRpcClient(): FinanceRpcClient {
  return {
    requestInvoiceWriteOff: vi.fn().mockResolvedValue(pending), approveInvoiceWriteOff: vi.fn().mockResolvedValue(approved), rejectInvoiceWriteOff: vi.fn().mockResolvedValue({ ...pending, status: 'rejected' }), voidInvoiceWriteOff: vi.fn().mockResolvedValue({ ...approved, status: 'voided' }),
  } as unknown as FinanceRpcClient;
}
async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('WriteOffActions', () => {
  let container: HTMLDivElement; let root: Root;
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); document.body.removeChild(container); vi.restoreAllMocks(); });

  async function render(role = 'clinic_admin', repository = createRepository(), rpcClient = createRpcClient(), tenant: string | null = tenantId) {
    await act(async () => { root.render(<WriteOffActions tenantId={tenant} invoiceId={invoiceId} role={role} repository={repository} rpcClient={rpcClient} />); });
    await flush();
    return { repository, rpcClient };
  }

  it('shows safe no-tenant state', async () => {
    await render('clinic_admin', createRepository(), createRpcClient(), null);
    expect(container.querySelector('[data-testid="writeoff-no-tenant"]')).not.toBeNull();
  });

  it('renders total, paid, approved, reserved and available amounts', async () => {
    await render();
    expect(container.textContent).toContain('Сумма счёта');
    expect(container.textContent).toContain('Оплачено');
    expect(container.textContent).toContain('Уже списано');
    expect(container.textContent).toContain('Зарезервировано под списание');
    expect(container.textContent).toContain('Доступно к списанию');
    expect(container.textContent).toContain('700 KZT');
  });

  it('cashier sees history but no mutation controls', async () => {
    await render('cashier');
    expect(container.querySelector('[data-testid="writeoff-history"]')).not.toBeNull();
    expect(container.querySelector(`[data-testid="writeoff-request-open-${invoiceId}"]`)).toBeNull();
    expect(container.querySelector('[data-testid="writeoff-approve-writeoff-pending"]')).toBeNull();
    expect(container.querySelector('[data-testid="writeoff-void-writeoff-approved"]')).toBeNull();
  });

  it('admin can request approve reject and void', async () => {
    await render('clinic_admin');
    expect(container.querySelector(`[data-testid="writeoff-request-open-${invoiceId}"]`)).not.toBeNull();
    expect(container.querySelector('[data-testid="writeoff-approve-writeoff-pending"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="writeoff-reject-writeoff-pending"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="writeoff-void-writeoff-pending"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="writeoff-void-writeoff-approved"]')).not.toBeNull();
  });

  it('shows safe reason and hides request when invoice is ineligible', async () => {
    const blocked = { ...eligibility, eligible: false, availableWriteOffAmount: 0, ineligibilityReason: 'Invoice is paid' };
    await render('clinic_admin', createRepository(blocked));
    expect(container.querySelector(`[data-testid="writeoff-request-open-${invoiceId}"]`)).toBeNull();
    expect(container.textContent).toContain('Оплаченный счёт нельзя списать.');
  });

  it('validates request and creates pending write-off without payment language', async () => {
    const { rpcClient } = await render();
    await act(async () => { container.querySelector<HTMLButtonElement>(`[data-testid="writeoff-request-open-${invoiceId}"]`)!.click(); });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="writeoff-request-submit"]')!.click(); });
    expect(container.textContent).toContain('Сумма должна быть больше 0.');
    setValue(container.querySelector<HTMLInputElement>('[data-testid="writeoff-request-amount"]')!, '400');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="writeoff-request-submit"]')!.click(); });
    expect(container.textContent).toContain('Укажите причину списания.');
    setValue(container.querySelector<HTMLTextAreaElement>('[data-testid="writeoff-request-reason"]')!, 'Debt forgiveness');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="writeoff-request-submit"]')!.click(); });
    await flush();
    expect(rpcClient.requestInvoiceWriteOff).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('Заявка на списание создана.');
    expect(container.textContent).not.toContain('Долг списан');
  });

  it('warns that voiding approved write-off reopens debt', async () => {
    await render();
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="writeoff-void-writeoff-approved"]')!.click(); });
    expect(container.textContent).toContain('Отмена одобренного списания восстановит задолженность.');
  });

  it('does not render raw database errors or metadata', async () => {
    const repository = { getInvoiceWriteOffEligibility: vi.fn().mockRejectedValue(new Error('SQLSTATE request_invoice_write_off secret')), listFinancialAdjustments: vi.fn().mockResolvedValue([]) } as unknown as FinanceRepository;
    await render('clinic_admin', repository);
    expect(container.textContent).toContain('Не удалось загрузить данные списания.');
    expect(container.textContent).not.toContain('SQLSTATE');
    expect(container.textContent).not.toContain('metadata');
  });

  it('source contains no direct Supabase writes or adjacent integrations', () => {
    const source = String(WriteOffActions);
    expect(source).not.toContain('supabase.rpc');
    expect(source).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
    expect(source).not.toContain('service_role');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('completed_services');
    expect(source).not.toContain('appointments');
    expect(source).not.toContain('PatientTimeline');
  });
});
