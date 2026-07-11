import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import {
  createFinanceRpcClient,
  SupabaseFinanceRpcClient,
  type CreateInvoiceInput,
  type IssueInvoiceInput,
  type VoidInvoiceInput,
} from './FinanceRpcClient';
import type { PaymentMethod } from './FinanceRepository';

type RpcResult = { data: unknown; error: PostgrestError | Error | null };
type RpcCall = { rpcName: string; params: Record<string, unknown> };

type ClientMock = {
  rpc: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
};

function createClientMock(rpcResult: RpcResult) {
  const rpcCalls: RpcCall[] = [];
  const client: ClientMock = {
    rpc: vi.fn(async (rpcName: string, params: Record<string, unknown>) => {
      rpcCalls.push({ rpcName, params });
      return rpcResult;
    }),
    from: vi.fn(() => {
      throw new Error('Direct table access is forbidden');
    }),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
  };
  const rpcClient = new SupabaseFinanceRpcClient(client as unknown as SupabaseClient);
  return { rpcClient, client, rpcCalls };
}

const MOJIBAKE_FRAGMENTS = ['Рќ', 'Рџ', 'СЃ', 'С‚'];

async function expectFinanceClientError(promise: Promise<unknown>, message: string) {
  try {
    await promise;
    throw new Error('Expected FinanceRpcClientError to be thrown');
  } catch (error) {
    expect(error).toMatchObject({ name: 'FinanceRpcClientError', message });
    const actualMessage = error instanceof Error ? error.message : String(error);
    for (const fragment of MOJIBAKE_FRAGMENTS) {
      expect(actualMessage).not.toContain(fragment);
    }
  }
}

function expectNoDirectWriteCalls(client: ClientMock) {
  expect(client.from).not.toHaveBeenCalled();
  expect(client.insert).not.toHaveBeenCalled();
  expect(client.update).not.toHaveBeenCalled();
  expect(client.delete).not.toHaveBeenCalled();
  expect(client.upsert).not.toHaveBeenCalled();
}

const tenantId = '11111111-1111-1111-1111-111111111111';
const patientId = '22222222-2222-2222-2222-222222222222';
const invoiceId = '33333333-3333-3333-3333-333333333333';
const invoiceItemId = '44444444-4444-4444-4444-444444444444';
const paymentId = '55555555-5555-5555-5555-555555555555';
const allocationId = '66666666-6666-6666-6666-666666666666';
const completedServiceId = '77777777-7777-7777-7777-777777777777';

const invoiceRow = {
  id: invoiceId,
  tenant_id: tenantId,
  patient_id: patientId,
  invoice_number: 'INV-1',
  status: 'issued',
  currency: 'KZT',
  issue_date: '2026-06-21T00:00:00Z',
  due_date: null,
  subtotal_amount: '12000.00',
  discount_amount: '1000.00',
  adjustment_amount: '0.00',
  total_amount: '11000.00',
  paid_amount: '4000.00',
  refunded_amount: '0.00',
  written_off_amount: '0.00',
  balance_amount: '7000.00',
  notes: null,
  metadata: { source: 'test' },
  created_by: 'user-1',
  issued_by: 'user-2',
  voided_by: null,
  void_reason: null,
  issued_at: '2026-06-21T01:00:00Z',
  voided_at: null,
  archived_at: null,
  created_at: '2026-06-21T01:00:01Z',
  updated_at: '2026-06-21T01:00:02Z',
};

const invoiceItemRow = {
  id: invoiceItemId,
  tenant_id: tenantId,
  invoice_id: invoiceId,
  patient_id: patientId,
  completed_service_id: completedServiceId,
  service_name: 'Consultation',
  service_code: null,
  tooth_number: null,
  tooth_surface: null,
  quantity: '2.00',
  unit_price: '6000.00',
  discount_amount: '1000.00',
  adjustment_amount: '0.00',
  total_amount: '11000.00',
  status: 'active',
  notes: null,
  metadata: { source: 'item' },
  created_by: 'user-1',
  voided_by: null,
  void_reason: null,
  voided_at: null,
  archived_at: null,
  created_at: '2026-06-21T01:00:01Z',
  updated_at: '2026-06-21T01:00:02Z',
};

const paymentRow = {
  id: paymentId,
  tenant_id: tenantId,
  patient_id: patientId,
  status: 'received',
  payment_method: 'cash',
  amount: '11000.00',
  currency: 'KZT',
  received_at: '2026-06-21T02:00:00Z',
  external_reference: null,
  payer_name: null,
  notes: null,
  metadata: { source: 'payment' },
  received_by: 'user-1',
  voided_by: null,
  void_reason: null,
  voided_at: null,
  archived_at: null,
  created_at: '2026-06-21T02:00:01Z',
  updated_at: '2026-06-21T02:00:02Z',
};

const paymentAllocationRow = {
  id: allocationId,
  tenant_id: tenantId,
  patient_id: patientId,
  payment_id: paymentId,
  invoice_id: invoiceId,
  invoice_item_id: null,
  amount: '11000.00',
  currency: 'KZT',
  status: 'active',
  allocated_at: '2026-06-21T03:00:00Z',
  metadata: { source: 'allocation' },
  created_by: 'user-1',
  voided_by: null,
  void_reason: null,
  voided_at: null,
  created_at: '2026-06-21T03:00:01Z',
  updated_at: '2026-06-21T03:00:02Z',
};

const refundId = '88888888-8888-8888-8888-888888888888';
const adjustmentId = '99999999-9999-9999-9999-999999999999';
const refundRow = {
  id: refundId,
  tenant_id: tenantId,
  patient_id: patientId,
  payment_id: paymentId,
  status: 'pending',
  refund_method: 'cash',
  amount: '400.00',
  currency: 'KZT',
  reason: 'Overpayment',
  requested_by: 'cashier-1',
  approved_by: null,
  completed_by: null,
  requested_at: '2026-06-21T04:00:00Z',
  approved_at: null,
  completed_at: null,
  rejected_at: null,
  voided_at: null,
  voided_by: null,
  void_reason: null,
  external_reference: null,
  idempotency_key: 'refund-1',
  metadata: { source: 'refund' },
  created_at: '2026-06-21T04:00:01Z',
  updated_at: '2026-06-21T04:00:02Z',
};

const adjustmentRow = {
  id: adjustmentId,
  tenant_id: tenantId,
  patient_id: patientId,
  invoice_id: invoiceId,
  invoice_item_id: null,
  payment_id: null,
  adjustment_type: 'write_off',
  status: 'active',
  amount: '400.00',
  currency: 'KZT',
  reason: 'Bad debt',
  approved_by: null,
  created_by: 'admin-1',
  voided_by: null,
  approved_at: null,
  voided_at: null,
  void_reason: null,
  idempotency_key: 'writeoff-1',
  metadata: { source: 'writeoff' },
  created_at: '2026-06-21T05:00:01Z',
  updated_at: '2026-06-21T05:00:02Z',
};

function sourceText() {
  return [
    createFinanceRpcClient,
    SupabaseFinanceRpcClient,
    ...Object.values(Object.getOwnPropertyDescriptors(SupabaseFinanceRpcClient.prototype))
      .map((descriptor) => descriptor.value)
      .filter((value): value is (...args: never[]) => unknown => typeof value === 'function'),
  ].map((value) => value.toString()).join('\n');
}

describe('FinanceRpcClient RPC mapping', () => {
  it('createInvoice calls create_invoice with exact p_* params', async () => {
    const { rpcClient, rpcCalls, client } = createClientMock({ data: [invoiceRow], error: null });
    const input: CreateInvoiceInput = {
      tenantId,
      patientId,
      currency: 'KZT',
      dueDate: '2026-06-30T00:00:00Z',
      notes: 'Initial invoice',
      metadata: { source: 'ui' },
    };

    await rpcClient.createInvoice(input);

    expect(rpcCalls).toEqual([{ rpcName: 'create_invoice', params: {
      p_tenant_id: tenantId,
      p_patient_id: patientId,
      p_currency: 'KZT',
      p_due_date: '2026-06-30T00:00:00Z',
      p_notes: 'Initial invoice',
      p_metadata: { source: 'ui' },
    } }]);
    expectNoDirectWriteCalls(client);
  });

  it('addInvoiceItem calls add_invoice_item with exact p_* params and defaults', async () => {
    const { rpcClient, rpcCalls } = createClientMock({ data: [invoiceItemRow], error: null });
    await rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Consultation' });

    expect(rpcCalls).toEqual([{ rpcName: 'add_invoice_item', params: {
      p_tenant_id: tenantId,
      p_invoice_id: invoiceId,
      p_service_name: 'Consultation',
      p_quantity: 1,
      p_unit_price: 0,
      p_discount_amount: 0,
      p_adjustment_amount: 0,
      p_completed_service_id: null,
      p_service_code: null,
      p_tooth_number: null,
      p_tooth_surface: null,
      p_notes: null,
      p_metadata: {},
    } }]);
  });

  it('addInvoiceItem maps all optional p_* params', async () => {
    const { rpcClient, rpcCalls } = createClientMock({ data: [invoiceItemRow], error: null });
    await rpcClient.addInvoiceItem({
      tenantId,
      invoiceId,
      serviceName: 'Filling',
      quantity: 2,
      unitPrice: 5000,
      discountAmount: 500,
      adjustmentAmount: 100,
      completedServiceId,
      serviceCode: 'FILL',
      toothNumber: '16',
      toothSurface: 'O',
      notes: 'Notes',
      metadata: { tooth: true },
    });

    expect(rpcCalls[0]).toEqual({ rpcName: 'add_invoice_item', params: {
      p_tenant_id: tenantId,
      p_invoice_id: invoiceId,
      p_service_name: 'Filling',
      p_quantity: 2,
      p_unit_price: 5000,
      p_discount_amount: 500,
      p_adjustment_amount: 100,
      p_completed_service_id: completedServiceId,
      p_service_code: 'FILL',
      p_tooth_number: '16',
      p_tooth_surface: 'O',
      p_notes: 'Notes',
      p_metadata: { tooth: true },
    } });
  });

  it('maps the completed-service duplicate conflict to the safe message', async () => {
    const error = Object.assign(new Error('Эта выполненная услуга уже включена в другой счёт.'), { code: '23505' });
    const { rpcClient } = createClientMock({ data: null, error });
    await expect(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Filling', completedServiceId })).rejects.toMatchObject({
      category: 'duplicate_conflict',
      message: 'Эта выполненная услуга уже включена в другой счёт.',
    });
  });

  it('maps the plain PostgREST duplicate response used by Supabase in the browser', async () => {
    const error = {
      code: '23505',
      message: 'Эта выполненная услуга уже включена в другой счёт.',
      details: null,
      hint: null,
    } as unknown as Error;
    const { rpcClient } = createClientMock({ data: null, error });
    await expect(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Filling', completedServiceId })).rejects.toMatchObject({
      category: 'duplicate_conflict',
      message: 'Эта выполненная услуга уже включена в другой счёт.',
    });
  });

  it('does not mislabel an unrelated 23505 as a completed-service billing conflict', async () => {
    const error = Object.assign(new Error('duplicate key value violates unique constraint "some_other_unique"'), { code: '23505', constraint: 'some_other_unique' });
    const { rpcClient } = createClientMock({ data: null, error });
    await expect(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Filling', completedServiceId })).rejects.toMatchObject({
      category: undefined,
      message: 'Не удалось выполнить финансовую операцию.',
    });
  });

  it('maps the known unique index conflict safely without exposing raw SQL detail', async () => {
    const error = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505', constraint: 'uq_invoice_items_completed_service_billed_once' });
    const { rpcClient } = createClientMock({ data: null, error });
    await expect(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Filling', completedServiceId })).rejects.toMatchObject({
      category: 'duplicate_conflict',
      message: 'Эта выполненная услуга уже включена в другой счёт.',
    });
  });

  it('gets completed-service billing eligibility only through the RPC', async () => {
    const { rpcClient, rpcCalls, client } = createClientMock({ data: [{
      completed_service_id: completedServiceId, service_name: 'Consultation', service_code: null,
      tooth_number: null, tooth_surface: null, quantity: 1, unit_price: 1000, currency: 'KZT',
      billing_state: 'unbilled', invoice_id: null, invoice_item_id: null, invoice_number: null, invoice_status: null, billed_at: null,
    }], error: null });
    await expect(rpcClient.getCompletedServiceBillingEligibility({ tenantId, patientId })).resolves.toEqual([expect.objectContaining({ completedServiceId, billingState: 'unbilled' })]);
    expect(rpcCalls).toEqual([{ rpcName: 'get_completed_service_billing_eligibility', params: { p_tenant_id: tenantId, p_patient_id: patientId } }]);
    expectNoDirectWriteCalls(client);
  });

  it('issueInvoice calls issue_invoice', async () => {
    const { rpcClient, rpcCalls } = createClientMock({ data: invoiceRow, error: null });
    await rpcClient.issueInvoice({ tenantId, invoiceId });
    expect(rpcCalls).toEqual([{ rpcName: 'issue_invoice', params: { p_tenant_id: tenantId, p_invoice_id: invoiceId } }]);
  });

  it('voidInvoice calls void_invoice', async () => {
    const { rpcClient, rpcCalls } = createClientMock({ data: invoiceRow, error: null });
    await rpcClient.voidInvoice({ tenantId, invoiceId, reason: 'Wrong patient' });
    expect(rpcCalls).toEqual([{ rpcName: 'void_invoice', params: { p_tenant_id: tenantId, p_invoice_id: invoiceId, p_reason: 'Wrong patient' } }]);
  });

  it('recordPayment calls record_payment with exact p_* params', async () => {
    const { rpcClient, rpcCalls } = createClientMock({ data: [paymentRow], error: null });
    await rpcClient.recordPayment({
      tenantId,
      patientId,
      amount: 11000,
      paymentMethod: 'kaspi',
      currency: 'KZT',
      receivedAt: '2026-06-21T02:00:00Z',
      externalReference: 'KSP-1',
      payerName: 'Patient',
      notes: 'Paid',
      metadata: { terminal: true },
    });

    expect(rpcCalls).toEqual([{ rpcName: 'record_payment', params: {
      p_tenant_id: tenantId,
      p_patient_id: patientId,
      p_amount: 11000,
      p_payment_method: 'kaspi',
      p_currency: 'KZT',
      p_received_at: '2026-06-21T02:00:00Z',
      p_external_reference: 'KSP-1',
      p_payer_name: 'Patient',
      p_notes: 'Paid',
      p_metadata: { terminal: true },
    } }]);
  });

  it('allocatePayment calls allocate_payment', async () => {
    const { rpcClient, rpcCalls } = createClientMock({ data: [paymentAllocationRow], error: null });
    await rpcClient.allocatePayment({ tenantId, paymentId, amount: 11000, invoiceId, metadata: { allocation: true } });
    expect(rpcCalls).toEqual([{ rpcName: 'allocate_payment', params: {
      p_tenant_id: tenantId,
      p_payment_id: paymentId,
      p_amount: 11000,
      p_invoice_id: invoiceId,
      p_invoice_item_id: null,
      p_metadata: { allocation: true },
    } }]);
  });

  it('voidPaymentAllocation calls void_payment_allocation', async () => {
    const { rpcClient, rpcCalls } = createClientMock({ data: [paymentAllocationRow], error: null });
    await rpcClient.voidPaymentAllocation({ tenantId, allocationId, reason: 'Correction' });
    expect(rpcCalls).toEqual([{ rpcName: 'void_payment_allocation', params: {
      p_tenant_id: tenantId,
      p_allocation_id: allocationId,
      p_reason: 'Correction',
    } }]);
  });

  it('voidPayment calls void_payment', async () => {
    const { rpcClient, rpcCalls } = createClientMock({ data: [paymentRow], error: null });
    await rpcClient.voidPayment({ tenantId, paymentId, reason: 'Duplicate' });
    expect(rpcCalls).toEqual([{ rpcName: 'void_payment', params: {
      p_tenant_id: tenantId,
      p_payment_id: paymentId,
      p_reason: 'Duplicate',
    } }]);
  });
});

describe('FinanceRpcClient validation', () => {
  it('createInvoice rejects missing tenantId', async () => {
    const { rpcClient } = createClientMock({ data: invoiceRow, error: null });
    await expectFinanceClientError(rpcClient.createInvoice({ tenantId: '', patientId }), 'Не выбрана клиника.');
  });

  it('createInvoice rejects missing patientId', async () => {
    const { rpcClient } = createClientMock({ data: invoiceRow, error: null });
    await expectFinanceClientError(rpcClient.createInvoice({ tenantId, patientId: '  ' }), 'Пациент не выбран.');
  });

  it('addInvoiceItem rejects empty serviceName', async () => {
    const { rpcClient } = createClientMock({ data: invoiceItemRow, error: null });
    await expectFinanceClientError(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: '' }), 'Название услуги обязательно.');
  });

  it('addInvoiceItem rejects quantity <= 0', async () => {
    const { rpcClient } = createClientMock({ data: invoiceItemRow, error: null });
    await expectFinanceClientError(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Test', quantity: 0 }), 'Количество должно быть больше 0.');
    await expectFinanceClientError(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Test', quantity: -1 }), 'Количество должно быть больше 0.');
  });

  it('addInvoiceItem rejects negative unitPrice', async () => {
    const { rpcClient } = createClientMock({ data: invoiceItemRow, error: null });
    await expectFinanceClientError(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Test', unitPrice: -1 }), 'Цена не может быть отрицательной.');
  });

  it('addInvoiceItem rejects negative discountAmount', async () => {
    const { rpcClient } = createClientMock({ data: invoiceItemRow, error: null });
    await expectFinanceClientError(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Test', discountAmount: -1 }), 'Скидка не может быть отрицательной.');
  });

  it('addInvoiceItem rejects negative adjustmentAmount', async () => {
    const { rpcClient } = createClientMock({ data: invoiceItemRow, error: null });
    await expectFinanceClientError(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Test', adjustmentAmount: -1 }), 'Корректировка не может быть отрицательной.');
  });

  it('recordPayment rejects amount <= 0', async () => {
    const { rpcClient } = createClientMock({ data: paymentRow, error: null });
    await expectFinanceClientError(rpcClient.recordPayment({ tenantId, patientId, amount: 0, paymentMethod: 'cash' }), 'Сумма должна быть больше 0.');
  });

  it('recordPayment rejects invalid paymentMethod', async () => {
    const { rpcClient } = createClientMock({ data: paymentRow, error: null });
    await expectFinanceClientError(
      rpcClient.recordPayment({ tenantId, patientId, amount: 100, paymentMethod: 'crypto' as PaymentMethod }),
      'Некорректный способ оплаты.',
    );
  });

  it('allocatePayment rejects amount <= 0', async () => {
    const { rpcClient } = createClientMock({ data: paymentAllocationRow, error: null });
    await expectFinanceClientError(rpcClient.allocatePayment({ tenantId, paymentId, amount: -1, invoiceId }), 'Сумма должна быть больше 0.');
  });

  it('allocatePayment rejects missing invoiceId and invoiceItemId', async () => {
    const { rpcClient } = createClientMock({ data: paymentAllocationRow, error: null });
    await expectFinanceClientError(rpcClient.allocatePayment({ tenantId, paymentId, amount: 100 }), 'Нужно выбрать счёт или позицию счёта.');
  });

  it('invoice operations reject missing invoiceId', async () => {
    const { rpcClient } = createClientMock({ data: invoiceRow, error: null });
    await expectFinanceClientError(rpcClient.issueInvoice({ tenantId, invoiceId: '' } as IssueInvoiceInput), 'Счёт не выбран.');
    await expectFinanceClientError(rpcClient.voidInvoice({ tenantId, invoiceId: ' ', reason: 'Void' } as VoidInvoiceInput), 'Счёт не выбран.');
  });

  it('voidInvoice requires reason', async () => {
    const { rpcClient } = createClientMock({ data: invoiceRow, error: null });
    await expectFinanceClientError(rpcClient.voidInvoice({ tenantId, invoiceId, reason: ' ' }), 'Причина обязательна.');
  });

  it('voidPaymentAllocation requires reason', async () => {
    const { rpcClient } = createClientMock({ data: paymentAllocationRow, error: null });
    await expectFinanceClientError(rpcClient.voidPaymentAllocation({ tenantId, allocationId, reason: '' }), 'Причина обязательна.');
  });

  it('voidPayment requires reason', async () => {
    const { rpcClient } = createClientMock({ data: paymentRow, error: null });
    await expectFinanceClientError(rpcClient.voidPayment({ tenantId, paymentId, reason: '' }), 'Причина обязательна.');
  });

  it('metadata must be a plain object if provided', async () => {
    const { rpcClient } = createClientMock({ data: invoiceRow, error: null });
    await expectFinanceClientError(
      rpcClient.createInvoice({ tenantId, patientId, metadata: null as unknown as Record<string, unknown> }),
      'Метаданные должны быть объектом.',
    );
    await expectFinanceClientError(
      rpcClient.createInvoice({ tenantId, patientId, metadata: ['bad'] as unknown as Record<string, unknown> }),
      'Метаданные должны быть объектом.',
    );
  });
});

describe('FinanceRpcClient result mapping', () => {
  it('createInvoice maps returned invoice row to camelCase', async () => {
    const { rpcClient } = createClientMock({ data: [invoiceRow], error: null });
    const invoice = await rpcClient.createInvoice({ tenantId, patientId });
    expect(invoice.tenantId).toBe(tenantId);
    expect(invoice.patientId).toBe(patientId);
    expect(invoice.invoiceNumber).toBe('INV-1');
    expect(invoice.balanceAmount).toBe(7000);
  });

  it('addInvoiceItem maps returned invoice item row to camelCase', async () => {
    const { rpcClient } = createClientMock({ data: [invoiceItemRow], error: null });
    const item = await rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Consultation' });
    expect(item.invoiceId).toBe(invoiceId);
    expect(item.completedServiceId).toBe(completedServiceId);
    expect(item.serviceName).toBe('Consultation');
    expect(item.totalAmount).toBe(11000);
  });

  it('recordPayment maps returned payment row to camelCase', async () => {
    const { rpcClient } = createClientMock({ data: [paymentRow], error: null });
    const payment = await rpcClient.recordPayment({ tenantId, patientId, amount: 11000, paymentMethod: 'cash' });
    expect(payment.paymentMethod).toBe('cash');
    expect(payment.externalReference).toBeNull();
    expect(payment.amount).toBe(11000);
  });

  it('allocatePayment maps returned allocation row to camelCase', async () => {
    const { rpcClient } = createClientMock({ data: [paymentAllocationRow], error: null });
    const allocation = await rpcClient.allocatePayment({ tenantId, paymentId, invoiceId, amount: 11000 });
    expect(allocation.paymentId).toBe(paymentId);
    expect(allocation.invoiceId).toBe(invoiceId);
    expect(allocation.invoiceItemId).toBeNull();
    expect(allocation.amount).toBe(11000);
  });

  it('nullable fields are preserved', async () => {
    const { rpcClient } = createClientMock({ data: [invoiceRow], error: null });
    const invoice = await rpcClient.createInvoice({ tenantId, patientId });
    expect(invoice.dueDate).toBeNull();
    expect(invoice.notes).toBeNull();
    expect(invoice.voidedAt).toBeNull();
  });

  it('metadata objects are preserved', async () => {
    const { rpcClient } = createClientMock({ data: [paymentAllocationRow], error: null });
    const allocation = await rpcClient.allocatePayment({ tenantId, paymentId, invoiceId, amount: 11000 });
    expect(allocation.metadata).toEqual({ source: 'allocation' });
  });
});

describe('FinanceRpcClient error behavior', () => {
  it('normalizes Supabase RPC errors with operation context', async () => {
    const error = Object.assign(new Error('Access denied'), { code: '42501' });
    const { rpcClient } = createClientMock({ data: null, error });

    await expect(rpcClient.createInvoice({ tenantId, patientId })).rejects.toMatchObject({
      name: 'FinanceRpcClientError',
      operation: 'createInvoice',
      code: '42501',
      message: 'Не удалось выполнить финансовую операцию. Access denied',
    });
  });

  it('hides raw structured Supabase error dumps', async () => {
    const error = Object.assign(new Error('{"message":"denied","details":{"secret":"hidden"}}'), { code: '42501' });
    const { rpcClient } = createClientMock({ data: null, error });
    await expect(rpcClient.createInvoice({ tenantId, patientId })).rejects.toMatchObject({
      name: 'FinanceRpcClientError',
      operation: 'createInvoice',
      code: '42501',
      message: 'Не удалось выполнить финансовую операцию.',
    });
  });

  it('null data with no error is handled safely', async () => {
    const { rpcClient } = createClientMock({ data: null, error: null });
    await expect(rpcClient.createInvoice({ tenantId, patientId })).rejects.toMatchObject({
      name: 'FinanceRpcClientError',
      operation: 'createInvoice',
      message: 'Не удалось выполнить финансовую операцию.',
    });
  });
});

describe('FinanceRpcClient safety boundaries', () => {
  it('factory creates a Supabase-backed client and rejects local backend', () => {
    const client = { rpc: vi.fn() } as unknown as SupabaseClient;
    expect(createFinanceRpcClient({ backend: 'supabase', client })).toBeInstanceOf(SupabaseFinanceRpcClient);
    expect(() => createFinanceRpcClient({ backend: 'local', client })).toThrow('Finance RPC client requires Supabase backend.');
  });

  it('client never calls from/insert/update/delete/upsert during a write operation', async () => {
    const { rpcClient, client } = createClientMock({ data: [paymentRow], error: null });
    await rpcClient.recordPayment({ tenantId, patientId, amount: 100, paymentMethod: 'cash' });
    expect(client.rpc).toHaveBeenCalledOnce();
    expectNoDirectWriteCalls(client);
  });

  it('source has no raw direct table write calls', () => {
    const source = sourceText();
    expect(source).not.toContain('.from(');
    expect(source).not.toContain('.insert(');
    expect(source).not.toContain('.update(');
    expect(source).not.toContain('.delete(');
    expect(source).not.toContain('.upsert(');
  });

  it('source does not use localStorage or privileged service keys', () => {
    const source = sourceText();
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('service_role');
    expect(source).not.toContain('SERVICE_ROLE');
  });

  it('source does not import React or UI modules', () => {
    const source = sourceText();
    expect(source).not.toContain('react');
    expect(source).not.toContain('src/components');
    expect(source).not.toContain('src/pages');
    expect(source).not.toContain('data/hooks');
  });

  it('source does not mutate completed services or patient balance', () => {
    const source = sourceText();
    expect(source).not.toContain('completed_services');
    expect(source).not.toContain('patients.balance');
    expect(source).not.toContain('balance =');
  });

  it('client exposes controlled invoice, payment, refund, and write-off RPC methods', () => {
    const methods = Object.getOwnPropertyNames(SupabaseFinanceRpcClient.prototype);
    expect(methods).toEqual(expect.arrayContaining([
      'createInvoice',
      'addInvoiceItem',
      'getCompletedServiceBillingEligibility',
      'issueInvoice',
      'voidInvoice',
      'recordPayment',
      'recordAndAllocatePayment',
      'getCashierPaymentOperation',
      'allocatePayment',
      'voidPaymentAllocation',
      'voidPayment',
      'requestRefund',
      'approveRefund',
      'completeRefund',
      'rejectRefund',
      'voidRefund',
      'requestInvoiceWriteOff',
      'approveInvoiceWriteOff',
      'rejectInvoiceWriteOff',
      'voidInvoiceWriteOff',
    ]));
  });
});



describe('FinanceRpcClient refund and write-off lifecycle', () => {
  it('maps all refund RPC names and exact p_* arguments', async () => {
    const request = createClientMock({ data: [refundRow], error: null });
    await request.rpcClient.requestRefund({ tenantId, paymentId, amount: 400, refundMethod: 'cash', reason: 'Overpayment', idempotencyKey: ' refund-1 ', metadata: { source: 'ui' } });
    expect(request.rpcCalls).toEqual([{ rpcName: 'request_refund', params: {
      p_tenant_id: tenantId, p_payment_id: paymentId, p_amount: 400, p_refund_method: 'cash',
      p_reason: 'Overpayment', p_idempotency_key: 'refund-1', p_metadata: { source: 'ui' },
    } }]);

    const approve = createClientMock({ data: [refundRow], error: null });
    await approve.rpcClient.approveRefund({ tenantId, refundId });
    expect(approve.rpcCalls[0]).toEqual({ rpcName: 'approve_refund', params: { p_tenant_id: tenantId, p_refund_id: refundId } });

    const complete = createClientMock({ data: [refundRow], error: null });
    await complete.rpcClient.completeRefund({ tenantId, refundId, externalReference: 'EXT-1', metadata: { provider: false } });
    expect(complete.rpcCalls[0]).toEqual({ rpcName: 'complete_refund', params: {
      p_tenant_id: tenantId, p_refund_id: refundId, p_external_reference: 'EXT-1', p_metadata: { provider: false },
    } });

    const reject = createClientMock({ data: [refundRow], error: null });
    await reject.rpcClient.rejectRefund({ tenantId, refundId, reason: 'Not approved' });
    expect(reject.rpcCalls[0]).toEqual({ rpcName: 'reject_refund', params: { p_tenant_id: tenantId, p_refund_id: refundId, p_reason: 'Not approved' } });

    const voided = createClientMock({ data: [refundRow], error: null });
    await voided.rpcClient.voidRefund({ tenantId, refundId, reason: 'Cancelled' });
    expect(voided.rpcCalls[0]).toEqual({ rpcName: 'void_refund', params: { p_tenant_id: tenantId, p_refund_id: refundId, p_reason: 'Cancelled' } });
  });

  it('maps all write-off RPC names and exact p_* arguments', async () => {
    const request = createClientMock({ data: [adjustmentRow], error: null });
    await request.rpcClient.requestInvoiceWriteOff({ tenantId, invoiceId, amount: 400, reason: 'Bad debt', idempotencyKey: ' writeoff-1 ', metadata: { source: 'ui' } });
    expect(request.rpcCalls[0]).toEqual({ rpcName: 'request_invoice_write_off', params: {
      p_tenant_id: tenantId, p_invoice_id: invoiceId, p_amount: 400, p_reason: 'Bad debt',
      p_idempotency_key: 'writeoff-1', p_metadata: { source: 'ui' },
    } });

    const approve = createClientMock({ data: [adjustmentRow], error: null });
    await approve.rpcClient.approveInvoiceWriteOff({ tenantId, adjustmentId });
    expect(approve.rpcCalls[0]).toEqual({ rpcName: 'approve_invoice_write_off', params: { p_tenant_id: tenantId, p_adjustment_id: adjustmentId } });

    const reject = createClientMock({ data: [adjustmentRow], error: null });
    await reject.rpcClient.rejectInvoiceWriteOff({ tenantId, adjustmentId, reason: 'No evidence' });
    expect(reject.rpcCalls[0]).toEqual({ rpcName: 'reject_invoice_write_off', params: { p_tenant_id: tenantId, p_adjustment_id: adjustmentId, p_reason: 'No evidence' } });

    const voided = createClientMock({ data: [adjustmentRow], error: null });
    await voided.rpcClient.voidInvoiceWriteOff({ tenantId, adjustmentId, reason: 'Reversed' });
    expect(voided.rpcCalls[0]).toEqual({ rpcName: 'void_invoice_write_off', params: { p_tenant_id: tenantId, p_adjustment_id: adjustmentId, p_reason: 'Reversed' } });
  });

  it('maps refund and write-off results including idempotency keys', async () => {
    const refund = createClientMock({ data: [refundRow], error: null });
    await expect(refund.rpcClient.requestRefund({ tenantId, paymentId, amount: 400, refundMethod: 'cash', reason: 'Overpayment' }))
      .resolves.toMatchObject({ id: refundId, paymentId, amount: 400, idempotencyKey: 'refund-1' });
    const adjustment = createClientMock({ data: [adjustmentRow], error: null });
    await expect(adjustment.rpcClient.requestInvoiceWriteOff({ tenantId, invoiceId, amount: 400, reason: 'Bad debt' }))
      .resolves.toMatchObject({ id: adjustmentId, invoiceId, amount: 400, idempotencyKey: 'writeoff-1' });
  });

  it('validates refund and write-off IDs, amounts, methods, reasons, metadata, and idempotency keys', async () => {
    const refund = createClientMock({ data: [refundRow], error: null }).rpcClient;
    await expectFinanceClientError(refund.requestRefund({ tenantId, paymentId, amount: 0, refundMethod: 'cash', reason: 'x' }), 'Сумма возврата должна быть больше 0.');
    await expectFinanceClientError(refund.requestRefund({ tenantId, paymentId, amount: 1, refundMethod: 'crypto' as never, reason: 'x' }), 'Некорректный способ возврата.');
    await expectFinanceClientError(refund.requestRefund({ tenantId, paymentId, amount: 1, refundMethod: 'cash', reason: ' ' }), 'Причина возврата обязательна.');
    await expectFinanceClientError(refund.requestRefund({ tenantId, paymentId, amount: 1, refundMethod: 'cash', reason: 'x', idempotencyKey: ' ' }), 'Ключ идемпотентности не должен быть пустым.');
    await expectFinanceClientError(refund.completeRefund({ tenantId, refundId, metadata: [] as never }), 'Метаданные должны быть объектом.');
    await expectFinanceClientError(refund.approveRefund({ tenantId, refundId: '' }), 'Возврат не выбран.');

    const writeOff = createClientMock({ data: [adjustmentRow], error: null }).rpcClient;
    await expectFinanceClientError(writeOff.requestInvoiceWriteOff({ tenantId, invoiceId, amount: -1, reason: 'x' }), 'Сумма списания должна быть больше 0.');
    await expectFinanceClientError(writeOff.requestInvoiceWriteOff({ tenantId, invoiceId, amount: 1, reason: '' }), 'Причина списания обязательна.');
    await expectFinanceClientError(writeOff.requestInvoiceWriteOff({ tenantId, invoiceId, amount: 1, reason: 'x', metadata: null as never }), 'Метаданные должны быть объектом.');
    await expectFinanceClientError(writeOff.approveInvoiceWriteOff({ tenantId, adjustmentId: '' }), 'Списание не выбрано.');
  });
});


describe('FinanceRpcClient atomic cashier payment operation', () => {
  const cashierOperationRow = {
    status: 'completed',
    operation_id: 'cashier-payment-operation-1',
    tenant_id: tenantId,
    patient_id: patientId,
    payment: { ...paymentRow, status: 'allocated', cashier_operation_key: 'cashier-payment-operation-1', cashier_operation_fingerprint: 'fingerprint-1' },
    allocations: [paymentAllocationRow],
    issued_invoice_ids: [invoiceId],
    requested_amount: '11000.00',
    allocated_amount: '11000.00',
    unallocated_amount: '0.00',
    remaining_patient_debt: '0.00',
  };

  it('calls record_and_allocate_payment with exact p_* arguments and maps the composite result', async () => {
    const { rpcClient, rpcCalls, client } = createClientMock({ data: cashierOperationRow, error: null });
    const result = await rpcClient.recordAndAllocatePayment({
      tenantId,
      patientId,
      amount: 11000,
      paymentMethod: 'cash',
      currency: 'KZT',
      receivedAt: '2026-06-21T02:00:00Z',
      externalReference: 'EXT-1',
      payerName: 'Patient',
      notes: 'Atomic payment',
      invoiceIds: [invoiceId],
      idempotencyKey: ' cashier-payment-operation-1 ',
      metadata: { source: 'cashier' },
    });

    expect(rpcCalls).toEqual([{ rpcName: 'record_and_allocate_payment', params: {
      p_tenant_id: tenantId,
      p_patient_id: patientId,
      p_amount: 11000,
      p_payment_method: 'cash',
      p_currency: 'KZT',
      p_received_at: '2026-06-21T02:00:00Z',
      p_external_reference: 'EXT-1',
      p_payer_name: 'Patient',
      p_notes: 'Atomic payment',
      p_invoice_ids: [invoiceId],
      p_idempotency_key: 'cashier-payment-operation-1',
      p_metadata: { source: 'cashier' },
    } }]);
    expect(result).toMatchObject({
      status: 'completed', operationId: 'cashier-payment-operation-1', tenantId, patientId,
      requestedAmount: 11000, allocatedAmount: 11000, unallocatedAmount: 0,
      remainingPatientDebt: 0, issuedInvoiceIds: [invoiceId],
    });
    expect(result.payment?.cashierOperationKey).toBe('cashier-payment-operation-1');
    expect(result.allocations).toHaveLength(1);
    expectNoDirectWriteCalls(client);
  });

  it('calls get_cashier_payment_operation with tenant and operation key', async () => {
    const { rpcClient, rpcCalls } = createClientMock({ data: { ...cashierOperationRow, status: 'already_completed' }, error: null });
    const result = await rpcClient.getCashierPaymentOperation({ tenantId, idempotencyKey: ' cashier-payment-operation-1 ' });
    expect(rpcCalls).toEqual([{ rpcName: 'get_cashier_payment_operation', params: {
      p_tenant_id: tenantId,
      p_idempotency_key: 'cashier-payment-operation-1',
    } }]);
    expect(result.status).toBe('already_completed');
  });

  it('maps a tenant-scoped not_found reconciliation result without inventing a payment', async () => {
    const { rpcClient } = createClientMock({ data: {
      status: 'not_found', operation_id: 'missing-key', tenant_id: tenantId, patient_id: null,
      payment: null, allocations: [], issued_invoice_ids: [], requested_amount: 0,
      allocated_amount: 0, unallocated_amount: 0, remaining_patient_debt: 0,
    }, error: null });
    await expect(rpcClient.getCashierPaymentOperation({ tenantId, idempotencyKey: 'missing-key' })).resolves.toMatchObject({
      status: 'not_found', operationId: 'missing-key', tenantId, patientId: null, payment: null,
    });
  });

  it('requires an idempotency key and validates invoice IDs', async () => {
    const { rpcClient } = createClientMock({ data: cashierOperationRow, error: null });
    const base = { tenantId, patientId, amount: 100, paymentMethod: 'cash' as const };
    await expectFinanceClientError(rpcClient.recordAndAllocatePayment({ ...base, invoiceIds: [invoiceId], idempotencyKey: '' }), 'Ключ идемпотентности не должен быть пустым.');
    await expectFinanceClientError(rpcClient.recordAndAllocatePayment({ ...base, invoiceIds: [], idempotencyKey: 'key-1' }), 'Нужно выбрать хотя бы один счёт.');
    await expectFinanceClientError(rpcClient.recordAndAllocatePayment({ ...base, invoiceIds: [invoiceId, invoiceId], idempotencyKey: 'key-1' }), 'Один и тот же счёт выбран несколько раз.');
    await expectFinanceClientError(rpcClient.recordAndAllocatePayment({ ...base, invoiceIds: [''], idempotencyKey: 'key-1' }), 'Счёт не выбран.');
  });

  it('validates cashier amount, method, and metadata before RPC', async () => {
    const { rpcClient, client } = createClientMock({ data: cashierOperationRow, error: null });
    const base = { tenantId, patientId, invoiceIds: [invoiceId], idempotencyKey: 'key-1' };
    await expectFinanceClientError(rpcClient.recordAndAllocatePayment({ ...base, amount: 0, paymentMethod: 'cash' }), 'Сумма должна быть больше 0.');
    await expectFinanceClientError(rpcClient.recordAndAllocatePayment({ ...base, amount: 100, paymentMethod: 'crypto' as PaymentMethod }), 'Некорректный способ оплаты.');
    await expectFinanceClientError(rpcClient.recordAndAllocatePayment({ ...base, amount: 100, paymentMethod: 'cash', metadata: [] as never }), 'Метаданные должны быть объектом.');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('normalizes permission and idempotency conflict errors to safe Russian messages', async () => {
    const permission = createClientMock({ data: null, error: Object.assign(new Error('Access denied: insufficient finance permissions for this tenant'), { code: '42501' }) }).rpcClient;
    await expect(permission.recordAndAllocatePayment({ tenantId, patientId, amount: 100, paymentMethod: 'cash', invoiceIds: [invoiceId], idempotencyKey: 'key-1' })).rejects.toMatchObject({
      category: 'permission', message: 'Недостаточно прав для кассовой операции.',
    });

    const conflict = createClientMock({ data: null, error: new Error('CASHIER_IDEMPOTENCY_CONFLICT: operation key was reused with different payment details') }).rpcClient;
    await expect(conflict.recordAndAllocatePayment({ tenantId, patientId, amount: 100, paymentMethod: 'cash', invoiceIds: [invoiceId], idempotencyKey: 'key-1' })).rejects.toMatchObject({
      category: 'duplicate_conflict', message: 'Ключ операции уже использован для другой оплаты.',
    });
  });

  it('treats an unclassified transport failure as operation_uncertain without raw details', async () => {
    const { rpcClient } = createClientMock({ data: null, error: new Error('{"socket":"closed","secret":"hidden"}') });
    await expect(rpcClient.recordAndAllocatePayment({ tenantId, patientId, amount: 100, paymentMethod: 'cash', invoiceIds: [invoiceId], idempotencyKey: 'key-1' })).rejects.toMatchObject({
      category: 'operation_uncertain',
      message: 'Не удалось получить ответ сервера. Проверяем, была ли оплата сохранена.',
    });
  });
});


describe('FinanceRpcClient patient fund reservation operations', () => {
  const reservationId = '88888888-8888-8888-8888-888888888888';
  const reservationRow = {
    id: reservationId,
    tenant_id: tenantId,
    patient_id: patientId,
    payment_id: paymentId,
    currency: 'KZT',
    purpose_type: 'appointment',
    purpose_label: 'Visit deposit',
    appointment_id: '99999999-9999-9999-9999-999999999999',
    treatment_plan_id: null,
    original_amount: '300.00',
    consumed_amount: '100.00',
    released_amount: '0.00',
    remaining_amount: '200.00',
    status: 'partially_used',
    expires_at: null,
    notes: null,
    created_at: '2026-07-11T00:00:00Z',
    updated_at: '2026-07-11T00:01:00Z',
    released_at: null,
    archived_at: null,
  };
  const capacity = {
    paymentId,
    patientId,
    currency: 'KZT',
    paymentAmount: '1000.00',
    activeAllocatedAmount: '100.00',
    completedRefundAmount: '50.00',
    refundReservedAmount: '100.00',
    reservedDepositAmount: '200.00',
    grossUnallocatedAmount: '850.00',
    availableCreditAmount: '550.00',
  };
  const operationResult = {
    status: 'completed',
    reservation: reservationRow,
    allocation: null,
    capacity,
  };

  it('calls create_patient_fund_reservation with exact parameters and preserves the idempotency key', async () => {
    const { rpcClient, rpcCalls, client } = createClientMock({ data: operationResult, error: null });
    const result = await rpcClient.createPatientFundReservation({
      tenantId,
      patientId,
      paymentId,
      amount: 300,
      purposeType: 'appointment',
      purposeLabel: ' Visit deposit ',
      appointmentId: '99999999-9999-9999-9999-999999999999',
      treatmentPlanId: null,
      expiresAt: null,
      notes: ' Reserve for visit ',
      metadata: { source: 'test' },
      idempotencyKey: ' create-reservation-1 ',
    });
    expect(rpcCalls).toEqual([{ rpcName: 'create_patient_fund_reservation', params: {
      p_tenant_id: tenantId,
      p_patient_id: patientId,
      p_payment_id: paymentId,
      p_amount: 300,
      p_purpose_type: 'appointment',
      p_purpose_label: 'Visit deposit',
      p_appointment_id: '99999999-9999-9999-9999-999999999999',
      p_treatment_plan_id: null,
      p_expires_at: null,
      p_notes: 'Reserve for visit',
      p_metadata: { source: 'test' },
      p_idempotency_key: 'create-reservation-1',
    } }]);
    expect(result).toMatchObject({
      status: 'completed',
      reservation: { id: reservationId, purposeType: 'appointment', originalAmount: 300, remainingAmount: 200 },
      allocation: null,
      capacity: { paymentAmount: 1000, reservedDepositAmount: 200, availableCreditAmount: 550 },
    });
    expectNoDirectWriteCalls(client);
  });

  it('calls release_patient_fund_reservation with exact parameters', async () => {
    const released = {
      ...operationResult,
      reservation: { ...reservationRow, status: 'released', consumed_amount: '0.00', released_amount: '300.00', remaining_amount: '0.00', released_at: '2026-07-11T01:00:00Z' },
    };
    const { rpcClient, rpcCalls } = createClientMock({ data: released, error: null });
    await expect(rpcClient.releasePatientFundReservation({
      tenantId, reservationId, amount: null, reason: ' Patient changed mind ', idempotencyKey: ' release-1 ',
    })).resolves.toMatchObject({ reservation: { status: 'released', releasedAmount: 300, remainingAmount: 0 } });
    expect(rpcCalls).toEqual([{ rpcName: 'release_patient_fund_reservation', params: {
      p_tenant_id: tenantId,
      p_reservation_id: reservationId,
      p_amount: null,
      p_reason: 'Patient changed mind',
      p_idempotency_key: 'release-1',
    } }]);
  });

  it('calls allocate_reserved_credit and maps the allocation, reservation and capacity', async () => {
    const allocationResult = {
      ...operationResult,
      status: 'already_completed',
      allocation: { ...paymentAllocationRow, patient_fund_reservation_id: reservationId, reservation_operation_key: 'consume-1' },
    };
    const { rpcClient, rpcCalls, client } = createClientMock({ data: allocationResult, error: null });
    const result = await rpcClient.allocateReservedCredit({
      tenantId, patientId, reservationId, invoiceId, amount: 100, idempotencyKey: ' consume-1 ',
    });
    expect(rpcCalls).toEqual([{ rpcName: 'allocate_reserved_credit', params: {
      p_tenant_id: tenantId,
      p_patient_id: patientId,
      p_reservation_id: reservationId,
      p_invoice_id: invoiceId,
      p_amount: 100,
      p_idempotency_key: 'consume-1',
    } }]);
    expect(result).toMatchObject({
      status: 'already_completed',
      allocation: { id: allocationId, patientFundReservationId: reservationId, reservationOperationKey: 'consume-1' },
      reservation: { id: reservationId, remainingAmount: 200 },
    });
    expectNoDirectWriteCalls(client);
  });

  it('validates amounts, IDs, metadata and idempotency keys before calling RPC', async () => {
    const rpcClient = createClientMock({ data: operationResult, error: null }).rpcClient;
    await expect(rpcClient.createPatientFundReservation({ tenantId, patientId, paymentId, amount: 0, purposeType: 'general', idempotencyKey: 'x' })).rejects.toThrow();
    await expect(rpcClient.createPatientFundReservation({ tenantId, patientId, paymentId, amount: 1, purposeType: 'general', metadata: [] as never, idempotencyKey: 'x' })).rejects.toThrow();
    await expect(rpcClient.createPatientFundReservation({ tenantId, patientId, paymentId, amount: 1, purposeType: 'general', idempotencyKey: ' ' })).rejects.toThrow();
    await expect(rpcClient.releasePatientFundReservation({ tenantId, reservationId: '', reason: 'x', idempotencyKey: 'x' })).rejects.toThrow();
    await expect(rpcClient.allocateReservedCredit({ tenantId, patientId, reservationId, invoiceId, amount: -1, idempotencyKey: 'x' })).rejects.toThrow();
  });

  it('maps safe reservation errors and hides raw database details', async () => {
    const insufficient = createClientMock({ data: null, error: { code: 'P0001', message: 'Недостаточно доступного кредита для создания депозита.', details: null, hint: null } as unknown as PostgrestError });
    await expect(insufficient.rpcClient.createPatientFundReservation({ tenantId, patientId, paymentId, amount: 900, purposeType: 'general', idempotencyKey: 'x' }))
      .rejects.toMatchObject({ category: 'validation', message: 'Недостаточно доступного кредита для создания депозита.' });

    const conflict = createClientMock({ data: null, error: { code: 'P0001', message: 'Release idempotency key is already used with different details', details: 'sensitive SQL', hint: null } as unknown as PostgrestError });
    await expect(conflict.rpcClient.releasePatientFundReservation({ tenantId, reservationId, reason: 'x', idempotencyKey: 'same' }))
      .rejects.toMatchObject({ category: 'duplicate_conflict', message: 'Операция уже была выполнена или параметры изменились.' });

    const raw = createClientMock({ data: null, error: { code: 'XX000', message: 'duplicate key on private_index with table details', details: 'secret', hint: null } as unknown as PostgrestError });
    await raw.rpcClient.allocateReservedCredit({ tenantId, patientId, reservationId, invoiceId, amount: 1, idempotencyKey: 'x' }).catch((error: Error) => {
      expect(error.message).toBe('Не удалось выполнить финансовую операцию.');
      expect(error.message).not.toContain('private_index');
    });
  });

  it('maps terminal, invoice-unavailable and permission reservation failures to exact safe messages', async () => {
    const terminal = createClientMock({ data: null, error: { code: 'P0001', message: 'Fully used reservation cannot be released', details: null, hint: null } as unknown as PostgrestError }).rpcClient;
    await expect(terminal.releasePatientFundReservation({ tenantId, reservationId, reason: 'x', idempotencyKey: 'release-terminal' }))
      .rejects.toMatchObject({ category: 'validation', message: 'Этот депозит больше нельзя изменить.' });

    const unavailableInvoice = createClientMock({ data: null, error: { code: 'P0001', message: 'Invoice is not available for reserved allocation', details: 'private details', hint: null } as unknown as PostgrestError }).rpcClient;
    await expect(unavailableInvoice.allocateReservedCredit({ tenantId, patientId, reservationId, invoiceId, amount: 1, idempotencyKey: 'consume-unavailable' }))
      .rejects.toMatchObject({ category: 'validation', message: 'Выбранный счёт недоступен для использования депозита.' });

    const denied = createClientMock({ data: null, error: { code: '42501', message: 'access denied', details: null, hint: null } as unknown as PostgrestError }).rpcClient;
    await expect(denied.createPatientFundReservation({ tenantId, patientId, paymentId, amount: 1, purposeType: 'general', idempotencyKey: 'create-denied' }))
      .rejects.toMatchObject({ category: 'permission', message: 'Недостаточно прав для этой операции.' });
  });

  it('maps reserved-deposit allocation, refund, and payment-void failures to exact safe messages', async () => {
    const depositError = { code: 'P0001', message: 'Часть средств зарезервирована как депозит. Сначала освободите резерв.', details: null, hint: null } as unknown as PostgrestError;
    const allocation = createClientMock({ data: null, error: depositError }).rpcClient;
    await expect(allocation.allocatePayment({ tenantId, paymentId, invoiceId, amount: 1 }))
      .rejects.toMatchObject({ category: 'validation', message: 'Часть средств зарезервирована как депозит. Сначала освободите резерв.' });
    const refund = createClientMock({ data: null, error: depositError }).rpcClient;
    await expect(refund.requestRefund({ tenantId, paymentId, amount: 1, refundMethod: 'cash', reason: 'x' }))
      .rejects.toMatchObject({ category: 'validation', message: 'Часть средств зарезервирована как депозит. Сначала освободите резерв.' });
    const voided = createClientMock({ data: null, error: { code: 'P0001', message: 'Нельзя аннулировать платёж с активным депозитом.', details: null, hint: null } as unknown as PostgrestError }).rpcClient;
    await expect(voided.voidPayment({ tenantId, paymentId, reason: 'x' }))
      .rejects.toMatchObject({ category: 'validation', message: 'Нельзя аннулировать платёж с активным депозитом.' });
  });

  it('does not expose direct table writes, service_role, or patients.balance in reservation client code', () => {
    const source = SupabaseFinanceRpcClient.toString();
    expect(source).not.toContain("from('patient_fund_reservations')");
    expect(source).not.toContain('service_role');
    expect(source).not.toContain('patients.balance');
  });
});
