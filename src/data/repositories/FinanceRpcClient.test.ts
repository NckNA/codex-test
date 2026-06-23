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

function expectFinanceClientError(promise: Promise<unknown>, message: string) {
  return expect(promise).rejects.toMatchObject({ name: 'FinanceRpcClientError', message });
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
    await expectFinanceClientError(rpcClient.createInvoice({ tenantId: '', patientId }), 'РќРµ РІС‹Р±СЂР°РЅР° РєР»РёРЅРёРєР°.');
  });

  it('createInvoice rejects missing patientId', async () => {
    const { rpcClient } = createClientMock({ data: invoiceRow, error: null });
    await expectFinanceClientError(rpcClient.createInvoice({ tenantId, patientId: '  ' }), 'РџР°С†РёРµРЅС‚ РЅРµ РІС‹Р±СЂР°РЅ.');
  });

  it('addInvoiceItem rejects empty serviceName', async () => {
    const { rpcClient } = createClientMock({ data: invoiceItemRow, error: null });
    await expectFinanceClientError(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: '' }), 'РќР°Р·РІР°РЅРёРµ СѓСЃР»СѓРіРё РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ.');
  });

  it('addInvoiceItem rejects quantity <= 0', async () => {
    const { rpcClient } = createClientMock({ data: invoiceItemRow, error: null });
    await expectFinanceClientError(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Test', quantity: 0 }), 'РљРѕР»РёС‡РµСЃС‚РІРѕ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0.');
    await expectFinanceClientError(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Test', quantity: -1 }), 'РљРѕР»РёС‡РµСЃС‚РІРѕ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0.');
  });

  it('addInvoiceItem rejects negative unitPrice', async () => {
    const { rpcClient } = createClientMock({ data: invoiceItemRow, error: null });
    await expectFinanceClientError(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Test', unitPrice: -1 }), 'Р¦РµРЅР° РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ РѕС‚СЂРёС†Р°С‚РµР»СЊРЅРѕР№.');
  });

  it('addInvoiceItem rejects negative discountAmount', async () => {
    const { rpcClient } = createClientMock({ data: invoiceItemRow, error: null });
    await expectFinanceClientError(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Test', discountAmount: -1 }), 'РЎРєРёРґРєР° РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ РѕС‚СЂРёС†Р°С‚РµР»СЊРЅРѕР№.');
  });

  it('addInvoiceItem rejects negative adjustmentAmount', async () => {
    const { rpcClient } = createClientMock({ data: invoiceItemRow, error: null });
    await expectFinanceClientError(rpcClient.addInvoiceItem({ tenantId, invoiceId, serviceName: 'Test', adjustmentAmount: -1 }), 'РљРѕСЂСЂРµРєС‚РёСЂРѕРІРєР° РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ РѕС‚СЂРёС†Р°С‚РµР»СЊРЅРѕР№.');
  });

  it('recordPayment rejects amount <= 0', async () => {
    const { rpcClient } = createClientMock({ data: paymentRow, error: null });
    await expectFinanceClientError(rpcClient.recordPayment({ tenantId, patientId, amount: 0, paymentMethod: 'cash' }), 'РЎСѓРјРјР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0.');
  });

  it('recordPayment rejects invalid paymentMethod', async () => {
    const { rpcClient } = createClientMock({ data: paymentRow, error: null });
    await expectFinanceClientError(
      rpcClient.recordPayment({ tenantId, patientId, amount: 100, paymentMethod: 'crypto' as PaymentMethod }),
      'РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ СЃРїРѕСЃРѕР± РѕРїР»Р°С‚С‹.',
    );
  });

  it('allocatePayment rejects amount <= 0', async () => {
    const { rpcClient } = createClientMock({ data: paymentAllocationRow, error: null });
    await expectFinanceClientError(rpcClient.allocatePayment({ tenantId, paymentId, amount: -1, invoiceId }), 'РЎСѓРјРјР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0.');
  });

  it('allocatePayment rejects missing invoiceId and invoiceItemId', async () => {
    const { rpcClient } = createClientMock({ data: paymentAllocationRow, error: null });
    await expectFinanceClientError(rpcClient.allocatePayment({ tenantId, paymentId, amount: 100 }), 'РќСѓР¶РЅРѕ РІС‹Р±СЂР°С‚СЊ СЃС‡С‘С‚ РёР»Рё РїРѕР·РёС†РёСЋ СЃС‡С‘С‚Р°.');
  });

  it('invoice operations reject missing invoiceId', async () => {
    const { rpcClient } = createClientMock({ data: invoiceRow, error: null });
    await expectFinanceClientError(rpcClient.issueInvoice({ tenantId, invoiceId: '' } as IssueInvoiceInput), 'РЎС‡С‘С‚ РЅРµ РІС‹Р±СЂР°РЅ.');
    await expectFinanceClientError(rpcClient.voidInvoice({ tenantId, invoiceId: ' ', reason: 'Void' } as VoidInvoiceInput), 'РЎС‡С‘С‚ РЅРµ РІС‹Р±СЂР°РЅ.');
  });

  it('voidInvoice requires reason', async () => {
    const { rpcClient } = createClientMock({ data: invoiceRow, error: null });
    await expectFinanceClientError(rpcClient.voidInvoice({ tenantId, invoiceId, reason: ' ' }), 'РџСЂРёС‡РёРЅР° РѕР±СЏР·Р°С‚РµР»СЊРЅР°.');
  });

  it('voidPaymentAllocation requires reason', async () => {
    const { rpcClient } = createClientMock({ data: paymentAllocationRow, error: null });
    await expectFinanceClientError(rpcClient.voidPaymentAllocation({ tenantId, allocationId, reason: '' }), 'РџСЂРёС‡РёРЅР° РѕР±СЏР·Р°С‚РµР»СЊРЅР°.');
  });

  it('voidPayment requires reason', async () => {
    const { rpcClient } = createClientMock({ data: paymentRow, error: null });
    await expectFinanceClientError(rpcClient.voidPayment({ tenantId, paymentId, reason: '' }), 'РџСЂРёС‡РёРЅР° РѕР±СЏР·Р°С‚РµР»СЊРЅР°.');
  });

  it('metadata must be a plain object if provided', async () => {
    const { rpcClient } = createClientMock({ data: invoiceRow, error: null });
    await expectFinanceClientError(
      rpcClient.createInvoice({ tenantId, patientId, metadata: null as unknown as Record<string, unknown> }),
      'РњРµС‚Р°РґР°РЅРЅС‹Рµ РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ РѕР±СЉРµРєС‚РѕРј.',
    );
    await expectFinanceClientError(
      rpcClient.createInvoice({ tenantId, patientId, metadata: ['bad'] as unknown as Record<string, unknown> }),
      'РњРµС‚Р°РґР°РЅРЅС‹Рµ РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ РѕР±СЉРµРєС‚РѕРј.',
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
      message: 'РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ С„РёРЅР°РЅСЃРѕРІСѓСЋ РѕРїРµСЂР°С†РёСЋ. Access denied',
    });
  });

  it('null data with no error is handled safely', async () => {
    const { rpcClient } = createClientMock({ data: null, error: null });
    await expect(rpcClient.createInvoice({ tenantId, patientId })).rejects.toMatchObject({
      name: 'FinanceRpcClientError',
      operation: 'createInvoice',
      message: 'РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ С„РёРЅР°РЅСЃРѕРІСѓСЋ РѕРїРµСЂР°С†РёСЋ.',
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

  it('client exposes only controlled invoice/payment RPC methods', () => {
    const methods = Object.getOwnPropertyNames(SupabaseFinanceRpcClient.prototype);
    expect(methods).toEqual(expect.arrayContaining([
      'createInvoice',
      'addInvoiceItem',
      'issueInvoice',
      'voidInvoice',
      'recordPayment',
      'allocatePayment',
      'voidPaymentAllocation',
      'voidPayment',
    ]));
    expect(methods.some((method) => method.toLowerCase().includes('refund'))).toBe(false);
    expect(methods.some((method) => method.toLowerCase().includes('writeoff'))).toBe(false);
  });
});

