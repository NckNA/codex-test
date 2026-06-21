import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ACTIVE_CLINIC_REQUIRED_FOR_FINANCE_ERROR,
  PATIENT_REQUIRED_FOR_FINANCE_ERROR,
  RECORD_ID_REQUIRED_FOR_FINANCE_ERROR,
  SupabaseFinanceRepository,
  computePatientFinanceSummary,
  createFinanceRepository,
  mapFinancialAdjustmentRow,
  mapInvoiceItemRow,
  mapInvoiceRow,
  mapPaymentAllocationRow,
  mapPaymentRow,
  mapRefundRow,
  normalizeFinanceLimit,
  normalizeFinanceOffset,
  type PatientFinanceFacts,
} from './FinanceRepository';

type QueryResult = {
  data: Record<string, unknown>[] | null;
  error: Error | null;
};

type SingleQueryResult = {
  data: Record<string, unknown> | null;
  error: Error | null;
};

type QueryCall = {
  table?: string;
  method: string;
  args: unknown[];
};

type RepositoryFixture = {
  repository: SupabaseFinanceRepository;
  client: {
    from: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  };
  calls: QueryCall[];
};

function createRepository(
  resultsByTable: Record<string, QueryResult> = {},
  singleByTable: Record<string, SingleQueryResult> = {},
): RepositoryFixture {
  const calls: QueryCall[] = [];

  const client = {
    from: vi.fn((tableName: string) => {
      calls.push({ table: tableName, method: 'from', args: [tableName] });
      const chain = {
        select: vi.fn(),
        eq: vi.fn(),
        neq: vi.fn(),
        in: vi.fn(),
        order: vi.fn(),
        range: vi.fn(),
        maybeSingle: vi.fn(),
      };

      chain.select.mockImplementation((...args: unknown[]) => {
        calls.push({ table: tableName, method: 'select', args });
        return chain;
      });
      chain.eq.mockImplementation((...args: unknown[]) => {
        calls.push({ table: tableName, method: 'eq', args });
        return chain;
      });
      chain.neq.mockImplementation((...args: unknown[]) => {
        calls.push({ table: tableName, method: 'neq', args });
        return chain;
      });
      chain.in.mockImplementation((...args: unknown[]) => {
        calls.push({ table: tableName, method: 'in', args });
        return chain;
      });
      chain.order.mockImplementation((...args: unknown[]) => {
        calls.push({ table: tableName, method: 'order', args });
        return chain;
      });
      chain.range.mockImplementation(async (...args: unknown[]) => {
        calls.push({ table: tableName, method: 'range', args });
        return resultsByTable[tableName] ?? { data: [], error: null };
      });
      chain.maybeSingle.mockImplementation(async (...args: unknown[]) => {
        calls.push({ table: tableName, method: 'maybeSingle', args });
        return singleByTable[tableName] ?? { data: null, error: null };
      });
      return chain;
    }),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    rpc: vi.fn(),
  };

  return {
    repository: new SupabaseFinanceRepository(client as unknown as SupabaseClient),
    client,
    calls,
  };
}

function expectCall(calls: QueryCall[], table: string, method: string, ...args: unknown[]) {
  expect(calls).toContainEqual({ table, method, args });
}

function expectNoWriteCalls(client: RepositoryFixture['client']) {
  expect(client.insert).not.toHaveBeenCalled();
  expect(client.update).not.toHaveBeenCalled();
  expect(client.delete).not.toHaveBeenCalled();
  expect(client.upsert).not.toHaveBeenCalled();
  expect(client.rpc).not.toHaveBeenCalled();
}

const tenantId = '11111111-1111-1111-1111-111111111111';
const patientId = '22222222-2222-2222-2222-222222222222';
const invoiceId = '33333333-3333-3333-3333-333333333333';
const invoiceItemId = '44444444-4444-4444-4444-444444444444';
const paymentId = '55555555-5555-5555-5555-555555555555';
const completedServiceId = '66666666-6666-6666-6666-666666666666';

const invoiceRow = {
  id: invoiceId,
  tenant_id: tenantId,
  patient_id: patientId,
  invoice_number: 'INV-1',
  status: 'issued',
  currency: 'KZT',
  issue_date: '2026-06-21T00:00:00Z',
  due_date: '2026-06-30T00:00:00Z',
  subtotal_amount: '12000.00',
  discount_amount: '1000.00',
  adjustment_amount: '0.00',
  total_amount: '11000.00',
  paid_amount: '4000.00',
  refunded_amount: '0.00',
  written_off_amount: '0.00',
  balance_amount: '7000.00',
  notes: 'Initial bill',
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
  service_code: 'CONS-1',
  tooth_number: '16',
  tooth_surface: 'occlusal',
  quantity: '1.000',
  unit_price: '12000.00',
  discount_amount: '1000.00',
  adjustment_amount: '0.00',
  total_amount: '11000.00',
  status: 'active',
  notes: null,
  metadata: { billable: true },
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
  payment_method: 'kaspi',
  amount: '5000.00',
  currency: 'KZT',
  received_at: '2026-06-21T02:00:00Z',
  external_reference: 'KSP-1',
  payer_name: 'Patient',
  notes: null,
  metadata: { terminal: 'kaspi' },
  received_by: 'cashier-1',
  voided_by: null,
  void_reason: null,
  voided_at: null,
  archived_at: null,
  created_at: '2026-06-21T02:00:01Z',
  updated_at: '2026-06-21T02:00:02Z',
};

const allocationRow = {
  id: '77777777-7777-7777-7777-777777777777',
  tenant_id: tenantId,
  patient_id: patientId,
  payment_id: paymentId,
  invoice_id: invoiceId,
  invoice_item_id: invoiceItemId,
  amount: '4000.00',
  currency: 'KZT',
  status: 'active',
  allocated_at: '2026-06-21T02:10:00Z',
  metadata: { allocation: true },
  created_by: 'cashier-1',
  voided_by: null,
  void_reason: null,
  voided_at: null,
  created_at: '2026-06-21T02:10:01Z',
  updated_at: '2026-06-21T02:10:02Z',
};

const refundRow = {
  id: '88888888-8888-8888-8888-888888888888',
  tenant_id: tenantId,
  patient_id: patientId,
  payment_id: paymentId,
  status: 'completed',
  refund_method: 'kaspi',
  amount: '500.00',
  currency: 'KZT',
  reason: 'Overpayment return',
  requested_by: 'cashier-1',
  approved_by: 'admin-1',
  completed_by: 'cashier-1',
  requested_at: '2026-06-21T03:00:00Z',
  approved_at: '2026-06-21T03:10:00Z',
  completed_at: '2026-06-21T03:20:00Z',
  rejected_at: null,
  voided_at: null,
  voided_by: null,
  void_reason: null,
  external_reference: 'RFD-1',
  metadata: { refund: true },
  created_at: '2026-06-21T03:00:01Z',
  updated_at: '2026-06-21T03:00:02Z',
};

const adjustmentRow = {
  id: '99999999-9999-9999-9999-999999999999',
  tenant_id: tenantId,
  patient_id: patientId,
  invoice_id: invoiceId,
  invoice_item_id: invoiceItemId,
  payment_id: null,
  adjustment_type: 'write_off',
  status: 'approved',
  amount: '1000.00',
  currency: 'KZT',
  reason: 'Manager approval',
  approved_by: 'admin-1',
  created_by: 'admin-1',
  voided_by: null,
  approved_at: '2026-06-21T04:00:00Z',
  voided_at: null,
  void_reason: null,
  metadata: { adjustment: true },
  created_at: '2026-06-21T04:00:01Z',
  updated_at: '2026-06-21T04:00:02Z',
};

describe('FinanceRepository', () => {
  it('requires tenantId before querying finance tables', async () => {
    const { repository, client } = createRepository();

    await expect(repository.listInvoices({ tenantId: '' })).rejects.toThrow(ACTIVE_CLINIC_REQUIRED_FOR_FINANCE_ERROR);
    await expect(repository.listPayments({ tenantId: '' })).rejects.toThrow(ACTIVE_CLINIC_REQUIRED_FOR_FINANCE_ERROR);
    await expect(repository.getInvoiceById({ tenantId: '', invoiceId })).rejects.toThrow(ACTIVE_CLINIC_REQUIRED_FOR_FINANCE_ERROR);
    await expect(repository.getPaymentById({ tenantId: '', paymentId })).rejects.toThrow(ACTIVE_CLINIC_REQUIRED_FOR_FINANCE_ERROR);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('requires patientId for patient finance facts and summary', async () => {
    const { repository } = createRepository();

    await expect(repository.getPatientFinanceFacts({ tenantId, patientId: '' })).rejects.toThrow(PATIENT_REQUIRED_FOR_FINANCE_ERROR);
    await expect(repository.getPatientFinanceSummary({ tenantId, patientId: '' })).rejects.toThrow(PATIENT_REQUIRED_FOR_FINANCE_ERROR);
  });

  it('requires ids for get methods', async () => {
    const { repository } = createRepository();

    await expect(repository.getInvoiceById({ tenantId, invoiceId: '' })).rejects.toThrow(RECORD_ID_REQUIRED_FOR_FINANCE_ERROR);
    await expect(repository.getPaymentById({ tenantId, paymentId: '' })).rejects.toThrow(RECORD_ID_REQUIRED_FOR_FINANCE_ERROR);
  });

  it('maps finance rows from snake_case to camelCase and preserves nulls/metadata', () => {
    expect(mapInvoiceRow(invoiceRow)).toMatchObject({
      id: invoiceId,
      tenantId,
      patientId,
      invoiceNumber: 'INV-1',
      totalAmount: 11000,
      voidedBy: null,
      metadata: { source: 'test' },
    });
    expect(mapInvoiceItemRow(invoiceItemRow)).toMatchObject({ completedServiceId, serviceName: 'Consultation', unitPrice: 12000 });
    expect(mapPaymentRow(paymentRow)).toMatchObject({ paymentMethod: 'kaspi', receivedAt: '2026-06-21T02:00:00Z' });
    expect(mapPaymentAllocationRow(allocationRow)).toMatchObject({ invoiceId, invoiceItemId, amount: 4000 });
    expect(mapRefundRow(refundRow)).toMatchObject({ reason: 'Overpayment return', refundMethod: 'kaspi', status: 'completed' });
    expect(mapFinancialAdjustmentRow(adjustmentRow)).toMatchObject({ adjustmentType: 'write_off', reason: 'Manager approval' });
  });

  it('listInvoices is tenant-bound, excludes archived by default, filters and paginates', async () => {
    const { repository, calls, client } = createRepository({ invoices: { data: [invoiceRow], error: null } });

    const invoices = await repository.listInvoices({ tenantId, patientId, status: ['issued', 'partially_paid'], limit: 10, offset: 5 });

    expect(client.from).toHaveBeenCalledWith('invoices');
    expectCall(calls, 'invoices', 'select', '*');
    expectCall(calls, 'invoices', 'eq', 'tenant_id', tenantId);
    expectCall(calls, 'invoices', 'eq', 'patient_id', patientId);
    expectCall(calls, 'invoices', 'in', 'status', ['issued', 'partially_paid']);
    expectCall(calls, 'invoices', 'neq', 'status', 'archived');
    expectCall(calls, 'invoices', 'order', 'created_at', { ascending: false });
    expectCall(calls, 'invoices', 'range', 5, 14);
    expect(invoices).toHaveLength(1);
    expectNoWriteCalls(client);
  });

  it('getInvoiceById filters by id and tenant_id and returns null when missing', async () => {
    const found = createRepository({}, { invoices: { data: invoiceRow, error: null } });
    await expect(found.repository.getInvoiceById({ tenantId, invoiceId })).resolves.toMatchObject({ id: invoiceId, tenantId });
    expectCall(found.calls, 'invoices', 'eq', 'tenant_id', tenantId);
    expectCall(found.calls, 'invoices', 'eq', 'id', invoiceId);
    expectCall(found.calls, 'invoices', 'maybeSingle');

    const missing = createRepository({}, { invoices: { data: null, error: null } });
    await expect(missing.repository.getInvoiceById({ tenantId, invoiceId })).resolves.toBeNull();
  });

  it('listInvoiceItems filters by invoiceId, completedServiceId, patientId and status', async () => {
    const { repository, calls } = createRepository({ invoice_items: { data: [invoiceItemRow], error: null } });

    await repository.listInvoiceItems({ tenantId, invoiceId, patientId, completedServiceId, status: 'active' });

    expectCall(calls, 'invoice_items', 'eq', 'tenant_id', tenantId);
    expectCall(calls, 'invoice_items', 'eq', 'invoice_id', invoiceId);
    expectCall(calls, 'invoice_items', 'eq', 'patient_id', patientId);
    expectCall(calls, 'invoice_items', 'eq', 'completed_service_id', completedServiceId);
    expectCall(calls, 'invoice_items', 'in', 'status', ['active']);
  });

  it('listPayments filters by patientId, paymentMethod and status', async () => {
    const { repository, calls } = createRepository({ payments: { data: [paymentRow], error: null } });

    await repository.listPayments({ tenantId, patientId, paymentMethod: 'kaspi', status: 'received' });

    expectCall(calls, 'payments', 'eq', 'tenant_id', tenantId);
    expectCall(calls, 'payments', 'eq', 'patient_id', patientId);
    expectCall(calls, 'payments', 'in', 'payment_method', ['kaspi']);
    expectCall(calls, 'payments', 'in', 'status', ['received']);
    expectCall(calls, 'payments', 'order', 'received_at', { ascending: false });
  });

  it('getPaymentById filters by id and tenant_id and returns null when missing', async () => {
    const found = createRepository({}, { payments: { data: paymentRow, error: null } });
    await expect(found.repository.getPaymentById({ tenantId, paymentId })).resolves.toMatchObject({ id: paymentId, tenantId });
    expectCall(found.calls, 'payments', 'eq', 'tenant_id', tenantId);
    expectCall(found.calls, 'payments', 'eq', 'id', paymentId);

    const missing = createRepository({}, { payments: { data: null, error: null } });
    await expect(missing.repository.getPaymentById({ tenantId, paymentId })).resolves.toBeNull();
  });

  it('listPaymentAllocations filters by payment/invoice/item/patient and excludes voided by default', async () => {
    const { repository, calls } = createRepository({ payment_allocations: { data: [allocationRow], error: null } });

    await repository.listPaymentAllocations({ tenantId, paymentId, invoiceId, invoiceItemId, patientId });

    expectCall(calls, 'payment_allocations', 'eq', 'tenant_id', tenantId);
    expectCall(calls, 'payment_allocations', 'eq', 'payment_id', paymentId);
    expectCall(calls, 'payment_allocations', 'eq', 'invoice_id', invoiceId);
    expectCall(calls, 'payment_allocations', 'eq', 'invoice_item_id', invoiceItemId);
    expectCall(calls, 'payment_allocations', 'eq', 'patient_id', patientId);
    expectCall(calls, 'payment_allocations', 'neq', 'status', 'voided');
    expectCall(calls, 'payment_allocations', 'neq', 'status', 'archived');
  });

  it('listRefunds filters by paymentId/status and orders by requested_at', async () => {
    const { repository, calls } = createRepository({ refunds: { data: [refundRow], error: null } });

    await repository.listRefunds({ tenantId, patientId, paymentId, status: 'completed' });

    expectCall(calls, 'refunds', 'eq', 'tenant_id', tenantId);
    expectCall(calls, 'refunds', 'eq', 'payment_id', paymentId);
    expectCall(calls, 'refunds', 'in', 'status', ['completed']);
    expectCall(calls, 'refunds', 'order', 'requested_at', { ascending: false });
  });

  it('listFinancialAdjustments filters by invoice/type/status', async () => {
    const { repository, calls } = createRepository({ financial_adjustments: { data: [adjustmentRow], error: null } });

    await repository.listFinancialAdjustments({ tenantId, patientId, invoiceId, invoiceItemId, adjustmentType: 'write_off', status: 'approved' });

    expectCall(calls, 'financial_adjustments', 'eq', 'tenant_id', tenantId);
    expectCall(calls, 'financial_adjustments', 'eq', 'patient_id', patientId);
    expectCall(calls, 'financial_adjustments', 'eq', 'invoice_id', invoiceId);
    expectCall(calls, 'financial_adjustments', 'eq', 'invoice_item_id', invoiceItemId);
    expectCall(calls, 'financial_adjustments', 'in', 'adjustment_type', ['write_off']);
    expectCall(calls, 'financial_adjustments', 'in', 'status', ['approved']);
  });

  it('getPatientFinanceFacts reads all finance facts tenant-bound without writes', async () => {
    const { repository, calls, client } = createRepository({
      invoices: { data: [invoiceRow], error: null },
      invoice_items: { data: [invoiceItemRow], error: null },
      payments: { data: [paymentRow], error: null },
      payment_allocations: { data: [allocationRow], error: null },
      refunds: { data: [refundRow], error: null },
      financial_adjustments: { data: [adjustmentRow], error: null },
    });

    const facts = await repository.getPatientFinanceFacts({ tenantId, patientId });

    expect(facts.invoices).toHaveLength(1);
    expect(facts.invoiceItems).toHaveLength(1);
    expect(facts.payments).toHaveLength(1);
    expect(facts.paymentAllocations).toHaveLength(1);
    expect(facts.refunds).toHaveLength(1);
    expect(facts.financialAdjustments).toHaveLength(1);
    for (const table of ['invoices', 'invoice_items', 'payments', 'payment_allocations', 'refunds', 'financial_adjustments']) {
      expectCall(calls, table, 'eq', 'tenant_id', tenantId);
      expectCall(calls, table, 'eq', 'patient_id', patientId);
    }
    expectNoWriteCalls(client);
  });

  it('getPatientFinanceSummary returns zero summary for no finance facts', async () => {
    const { repository } = createRepository();

    await expect(repository.getPatientFinanceSummary({ tenantId, patientId })).resolves.toMatchObject({
      tenantId,
      patientId,
      invoiceTotalAmount: 0,
      paidAmount: 0,
      allocatedPaymentAmount: 0,
      refundedAmount: 0,
      balanceAmount: 0,
      creditAmount: 0,
      lastPaymentAt: null,
    });
  });

  it('computePatientFinanceSummary ignores voided/archived facts and handles balance/credit conservatively', () => {
    const facts: PatientFinanceFacts = {
      invoices: [
        mapInvoiceRow({ ...invoiceRow, status: 'issued', total_amount: '10000.00', balance_amount: '6000.00' }),
        mapInvoiceRow({ ...invoiceRow, id: 'archived-invoice', status: 'archived', total_amount: '9999.00', balance_amount: '9999.00' }),
      ],
      invoiceItems: [mapInvoiceItemRow(invoiceItemRow)],
      payments: [
        mapPaymentRow({ ...paymentRow, amount: '12000.00', received_at: '2026-06-21T02:00:00Z' }),
        mapPaymentRow({ ...paymentRow, id: 'void-payment', status: 'voided', amount: '9999.00', received_at: '2026-06-22T02:00:00Z' }),
      ],
      paymentAllocations: [
        mapPaymentAllocationRow({ ...allocationRow, amount: '9000.00' }),
        mapPaymentAllocationRow({ ...allocationRow, id: 'void-allocation', status: 'voided', amount: '9999.00' }),
      ],
      refunds: [
        mapRefundRow({ ...refundRow, amount: '500.00', status: 'completed' }),
        mapRefundRow({ ...refundRow, id: 'pending-refund', status: 'pending', amount: '9999.00' }),
      ],
      financialAdjustments: [
        mapFinancialAdjustmentRow({ ...adjustmentRow, adjustment_type: 'write_off', amount: '1000.00', status: 'approved' }),
        mapFinancialAdjustmentRow({ ...adjustmentRow, id: 'discount-adjustment', adjustment_type: 'discount', amount: '500.00', status: 'active' }),
        mapFinancialAdjustmentRow({ ...adjustmentRow, id: 'archived-adjustment', adjustment_type: 'write_off', amount: '9999.00', status: 'archived' }),
      ],
    };

    const summary = computePatientFinanceSummary(tenantId, patientId, facts);

    expect(summary).toMatchObject({
      invoiceTotalAmount: 10000,
      paidAmount: 12000,
      allocatedPaymentAmount: 9000,
      refundedAmount: 500,
      discountAmount: 500,
      writeOffAmount: 1000,
      balanceAmount: 0,
      creditAmount: 0,
      unpaidInvoiceCount: 1,
      openInvoiceCount: 1,
      lastPaymentAt: '2026-06-21T02:00:00Z',
    });
  });

  it('computePatientFinanceSummary reports overpayment as credit without reading patient balance', () => {
    const facts: PatientFinanceFacts = {
      invoices: [mapInvoiceRow({ ...invoiceRow, total_amount: '3000.00', balance_amount: '0.00', status: 'paid' })],
      invoiceItems: [],
      payments: [mapPaymentRow({ ...paymentRow, amount: '5000.00' })],
      paymentAllocations: [mapPaymentAllocationRow({ ...allocationRow, amount: '5000.00' })],
      refunds: [],
      financialAdjustments: [],
    };

    const summary = computePatientFinanceSummary(tenantId, patientId, facts);

    expect(summary.balanceAmount).toBe(0);
    expect(summary.creditAmount).toBe(2000);
  });

  it('surfaces Supabase errors and empty lists safely', async () => {
    const error = new Error('read failed');
    const failing = createRepository({ invoices: { data: null, error } });
    await expect(failing.repository.listInvoices({ tenantId })).rejects.toThrow(error);

    const empty = createRepository({ invoices: { data: [], error: null } });
    await expect(empty.repository.listInvoices({ tenantId })).resolves.toEqual([]);
  });

  it('normalizes finance pagination bounds', () => {
    expect(normalizeFinanceLimit(undefined)).toBe(50);
    expect(normalizeFinanceLimit(999)).toBe(200);
    expect(normalizeFinanceLimit(0)).toBe(1);
    expect(normalizeFinanceOffset(undefined)).toBe(0);
    expect(normalizeFinanceOffset(-10)).toBe(0);
  });

  it('creates Supabase repository and rejects unsupported local backend', () => {
    const { client } = createRepository();
    expect(createFinanceRepository({ backend: 'supabase', client: client as unknown as SupabaseClient })).toBeInstanceOf(SupabaseFinanceRepository);
    expect(() => createFinanceRepository({ backend: 'local' })).toThrow('Finance repository requires Supabase backend.');
  });
});
