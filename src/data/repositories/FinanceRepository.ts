import { supabase as defaultSupabase } from '../../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'voided' | 'written_off' | 'archived';
export type InvoiceItemStatus = 'active' | 'voided' | 'adjusted' | 'archived';
export type PaymentStatus = 'received' | 'allocated' | 'partially_allocated' | 'refunded' | 'partially_refunded' | 'voided' | 'archived';
export type PaymentMethod = 'cash' | 'kaspi' | 'halyk_terminal' | 'card' | 'bank_transfer' | 'insurance' | 'osms' | 'mixed' | 'other';
export type RefundStatus = 'pending' | 'approved' | 'completed' | 'rejected' | 'voided' | 'archived';
export type RefundMethod = 'cash' | 'kaspi' | 'halyk_terminal' | 'card' | 'bank_transfer' | 'other';
export type FinancialAdjustmentType = 'discount' | 'correction' | 'write_off' | 'surcharge' | 'void';
export type FinancialAdjustmentStatus = 'active' | 'approved' | 'rejected' | 'voided' | 'archived';

export interface Invoice {
  id: string;
  tenantId: string;
  patientId: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
  subtotalAmount: number;
  discountAmount: number;
  adjustmentAmount: number;
  totalAmount: number;
  paidAmount: number;
  refundedAmount: number;
  writtenOffAmount: number;
  balanceAmount: number;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  issuedBy: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  issuedAt: string | null;
  voidedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  tenantId: string;
  invoiceId: string;
  patientId: string;
  completedServiceId: string | null;
  serviceName: string;
  serviceCode: string | null;
  toothNumber: string | null;
  toothSurface: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  adjustmentAmount: number;
  totalAmount: number;
  status: InvoiceItemStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  voidedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  patientId: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  amount: number;
  currency: string;
  receivedAt: string;
  externalReference: string | null;
  payerName: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  receivedBy: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  voidedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAllocation {
  id: string;
  tenantId: string;
  patientId: string;
  paymentId: string;
  invoiceId: string | null;
  invoiceItemId: string | null;
  amount: number;
  currency: string;
  status: 'active' | 'voided' | 'archived';
  allocatedAt: string;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Refund {
  id: string;
  tenantId: string;
  patientId: string;
  paymentId: string;
  status: RefundStatus;
  refundMethod: RefundMethod;
  amount: number;
  currency: string;
  reason: string;
  requestedBy: string | null;
  approvedBy: string | null;
  completedBy: string | null;
  requestedAt: string;
  approvedAt: string | null;
  completedAt: string | null;
  rejectedAt: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  externalReference: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialAdjustment {
  id: string;
  tenantId: string;
  patientId: string;
  invoiceId: string | null;
  invoiceItemId: string | null;
  paymentId: string | null;
  adjustmentType: FinancialAdjustmentType;
  status: FinancialAdjustmentStatus;
  amount: number;
  currency: string;
  reason: string;
  approvedBy: string | null;
  createdBy: string | null;
  voidedBy: string | null;
  approvedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PatientFinanceFacts {
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  payments: Payment[];
  paymentAllocations: PaymentAllocation[];
  refunds: Refund[];
  financialAdjustments: FinancialAdjustment[];
}

export interface PatientFinanceSummary {
  tenantId: string;
  patientId: string;
  invoiceTotalAmount: number;
  paidAmount: number;
  allocatedPaymentAmount: number;
  refundedAmount: number;
  discountAmount: number;
  writeOffAmount: number;
  adjustmentAmount: number;
  balanceAmount: number;
  creditAmount: number;
  openInvoiceCount: number;
  unpaidInvoiceCount: number;
  partiallyPaidInvoiceCount: number;
  lastPaymentAt: string | null;
}

export interface ListInvoicesOptions {
  tenantId: string;
  patientId?: string;
  status?: InvoiceStatus | InvoiceStatus[];
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface GetInvoiceByIdOptions {
  tenantId: string;
  invoiceId: string;
}

export interface ListInvoiceItemsOptions {
  tenantId: string;
  invoiceId?: string;
  patientId?: string;
  completedServiceId?: string;
  status?: InvoiceItemStatus | InvoiceItemStatus[];
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListPaymentsOptions {
  tenantId: string;
  patientId?: string;
  status?: PaymentStatus | PaymentStatus[];
  paymentMethod?: PaymentMethod | PaymentMethod[];
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface GetPaymentByIdOptions {
  tenantId: string;
  paymentId: string;
}

export interface ListPaymentAllocationsOptions {
  tenantId: string;
  paymentId?: string;
  invoiceId?: string;
  invoiceItemId?: string;
  patientId?: string;
  includeVoided?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListRefundsOptions {
  tenantId: string;
  patientId?: string;
  paymentId?: string;
  status?: RefundStatus | RefundStatus[];
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListFinancialAdjustmentsOptions {
  tenantId: string;
  patientId?: string;
  invoiceId?: string;
  invoiceItemId?: string;
  paymentId?: string;
  adjustmentType?: FinancialAdjustmentType | FinancialAdjustmentType[];
  status?: FinancialAdjustmentStatus | FinancialAdjustmentStatus[];
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface PatientFinanceOptions {
  tenantId: string;
  patientId: string;
}

export interface FinanceRepository {
  listInvoices(options: ListInvoicesOptions): Promise<Invoice[]>;
  getInvoiceById(options: GetInvoiceByIdOptions): Promise<Invoice | null>;
  listInvoiceItems(options: ListInvoiceItemsOptions): Promise<InvoiceItem[]>;
  listPayments(options: ListPaymentsOptions): Promise<Payment[]>;
  getPaymentById(options: GetPaymentByIdOptions): Promise<Payment | null>;
  listPaymentAllocations(options: ListPaymentAllocationsOptions): Promise<PaymentAllocation[]>;
  listRefunds(options: ListRefundsOptions): Promise<Refund[]>;
  listFinancialAdjustments(options: ListFinancialAdjustmentsOptions): Promise<FinancialAdjustment[]>;
  getPatientFinanceFacts(options: PatientFinanceOptions): Promise<PatientFinanceFacts>;
  getPatientFinanceSummary(options: PatientFinanceOptions): Promise<PatientFinanceSummary>;
}

export type FinanceRepositoryBackend = 'supabase' | 'local';

export interface CreateFinanceRepositoryOptions {
  backend: FinanceRepositoryBackend;
  client?: SupabaseClient;
}

export const ACTIVE_CLINIC_REQUIRED_FOR_FINANCE_ERROR = 'Active clinic is required for finance access.';
export const PATIENT_REQUIRED_FOR_FINANCE_ERROR = 'Patient is required for finance access.';
export const RECORD_ID_REQUIRED_FOR_FINANCE_ERROR = 'Record id is required for finance access.';
export const DEFAULT_FINANCE_LIMIT = 50;
export const MAX_FINANCE_LIMIT = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function metadataObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function requiredString(value: unknown, fieldName: string): string {
  if (value === null || value === undefined) throw new Error(`Finance row is missing required field: ${fieldName}`);
  const text = String(value);
  if (text.trim().length === 0) throw new Error(`Finance row has empty required field: ${fieldName}`);
  return text;
}

function requiredNumber(value: unknown, fieldName: string): number {
  if (value === null || value === undefined) throw new Error(`Finance row is missing required field: ${fieldName}`);
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) throw new Error(`Finance row has invalid numeric field: ${fieldName}`);
  return numberValue;
}

function requireTenantId(tenantId: string | null | undefined): string {
  if (!tenantId || tenantId.trim().length === 0) throw new Error(ACTIVE_CLINIC_REQUIRED_FOR_FINANCE_ERROR);
  return tenantId;
}

function requirePatientId(patientId: string | null | undefined): string {
  if (!patientId || patientId.trim().length === 0) throw new Error(PATIENT_REQUIRED_FOR_FINANCE_ERROR);
  return patientId;
}

function requireRecordId(id: string | null | undefined): string {
  if (!id || id.trim().length === 0) throw new Error(RECORD_ID_REQUIRED_FOR_FINANCE_ERROR);
  return id;
}

function toArray<T extends string>(value?: T | T[]): T[] | null {
  if (!value) return null;
  return Array.isArray(value) ? value : [value];
}

export function normalizeFinanceLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_FINANCE_LIMIT;
  return Math.max(1, Math.min(MAX_FINANCE_LIMIT, Math.floor(limit)));
}

export function normalizeFinanceOffset(offset?: number): number {
  if (offset === undefined || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.floor(offset));
}

export function mapInvoiceRow(row: Record<string, unknown>): Invoice {
  return {
    id: requiredString(row.id, 'id'),
    tenantId: requiredString(row.tenant_id, 'tenant_id'),
    patientId: requiredString(row.patient_id, 'patient_id'),
    invoiceNumber: nullableString(row.invoice_number),
    status: requiredString(row.status, 'status') as InvoiceStatus,
    currency: requiredString(row.currency, 'currency'),
    issueDate: nullableString(row.issue_date),
    dueDate: nullableString(row.due_date),
    subtotalAmount: requiredNumber(row.subtotal_amount, 'subtotal_amount'),
    discountAmount: requiredNumber(row.discount_amount, 'discount_amount'),
    adjustmentAmount: requiredNumber(row.adjustment_amount, 'adjustment_amount'),
    totalAmount: requiredNumber(row.total_amount, 'total_amount'),
    paidAmount: requiredNumber(row.paid_amount, 'paid_amount'),
    refundedAmount: requiredNumber(row.refunded_amount, 'refunded_amount'),
    writtenOffAmount: requiredNumber(row.written_off_amount, 'written_off_amount'),
    balanceAmount: requiredNumber(row.balance_amount, 'balance_amount'),
    notes: nullableString(row.notes),
    metadata: metadataObject(row.metadata),
    createdBy: nullableString(row.created_by),
    issuedBy: nullableString(row.issued_by),
    voidedBy: nullableString(row.voided_by),
    voidReason: nullableString(row.void_reason),
    issuedAt: nullableString(row.issued_at),
    voidedAt: nullableString(row.voided_at),
    archivedAt: nullableString(row.archived_at),
    createdAt: requiredString(row.created_at, 'created_at'),
    updatedAt: requiredString(row.updated_at, 'updated_at'),
  };
}

export function mapInvoiceItemRow(row: Record<string, unknown>): InvoiceItem {
  return {
    id: requiredString(row.id, 'id'),
    tenantId: requiredString(row.tenant_id, 'tenant_id'),
    invoiceId: requiredString(row.invoice_id, 'invoice_id'),
    patientId: requiredString(row.patient_id, 'patient_id'),
    completedServiceId: nullableString(row.completed_service_id),
    serviceName: requiredString(row.service_name, 'service_name'),
    serviceCode: nullableString(row.service_code),
    toothNumber: nullableString(row.tooth_number),
    toothSurface: nullableString(row.tooth_surface),
    quantity: requiredNumber(row.quantity, 'quantity'),
    unitPrice: requiredNumber(row.unit_price, 'unit_price'),
    discountAmount: requiredNumber(row.discount_amount, 'discount_amount'),
    adjustmentAmount: requiredNumber(row.adjustment_amount, 'adjustment_amount'),
    totalAmount: requiredNumber(row.total_amount, 'total_amount'),
    status: requiredString(row.status, 'status') as InvoiceItemStatus,
    notes: nullableString(row.notes),
    metadata: metadataObject(row.metadata),
    createdBy: nullableString(row.created_by),
    voidedBy: nullableString(row.voided_by),
    voidReason: nullableString(row.void_reason),
    voidedAt: nullableString(row.voided_at),
    archivedAt: nullableString(row.archived_at),
    createdAt: requiredString(row.created_at, 'created_at'),
    updatedAt: requiredString(row.updated_at, 'updated_at'),
  };
}

export function mapPaymentRow(row: Record<string, unknown>): Payment {
  return {
    id: requiredString(row.id, 'id'),
    tenantId: requiredString(row.tenant_id, 'tenant_id'),
    patientId: requiredString(row.patient_id, 'patient_id'),
    status: requiredString(row.status, 'status') as PaymentStatus,
    paymentMethod: requiredString(row.payment_method, 'payment_method') as PaymentMethod,
    amount: requiredNumber(row.amount, 'amount'),
    currency: requiredString(row.currency, 'currency'),
    receivedAt: requiredString(row.received_at, 'received_at'),
    externalReference: nullableString(row.external_reference),
    payerName: nullableString(row.payer_name),
    notes: nullableString(row.notes),
    metadata: metadataObject(row.metadata),
    receivedBy: nullableString(row.received_by),
    voidedBy: nullableString(row.voided_by),
    voidReason: nullableString(row.void_reason),
    voidedAt: nullableString(row.voided_at),
    archivedAt: nullableString(row.archived_at),
    createdAt: requiredString(row.created_at, 'created_at'),
    updatedAt: requiredString(row.updated_at, 'updated_at'),
  };
}

export function mapPaymentAllocationRow(row: Record<string, unknown>): PaymentAllocation {
  return {
    id: requiredString(row.id, 'id'),
    tenantId: requiredString(row.tenant_id, 'tenant_id'),
    patientId: requiredString(row.patient_id, 'patient_id'),
    paymentId: requiredString(row.payment_id, 'payment_id'),
    invoiceId: nullableString(row.invoice_id),
    invoiceItemId: nullableString(row.invoice_item_id),
    amount: requiredNumber(row.amount, 'amount'),
    currency: requiredString(row.currency, 'currency'),
    status: requiredString(row.status, 'status') as PaymentAllocation['status'],
    allocatedAt: requiredString(row.allocated_at, 'allocated_at'),
    metadata: metadataObject(row.metadata),
    createdBy: nullableString(row.created_by),
    voidedBy: nullableString(row.voided_by),
    voidReason: nullableString(row.void_reason),
    voidedAt: nullableString(row.voided_at),
    createdAt: requiredString(row.created_at, 'created_at'),
    updatedAt: requiredString(row.updated_at, 'updated_at'),
  };
}

export function mapRefundRow(row: Record<string, unknown>): Refund {
  return {
    id: requiredString(row.id, 'id'),
    tenantId: requiredString(row.tenant_id, 'tenant_id'),
    patientId: requiredString(row.patient_id, 'patient_id'),
    paymentId: requiredString(row.payment_id, 'payment_id'),
    status: requiredString(row.status, 'status') as RefundStatus,
    refundMethod: requiredString(row.refund_method, 'refund_method') as RefundMethod,
    amount: requiredNumber(row.amount, 'amount'),
    currency: requiredString(row.currency, 'currency'),
    reason: requiredString(row.reason, 'reason'),
    requestedBy: nullableString(row.requested_by),
    approvedBy: nullableString(row.approved_by),
    completedBy: nullableString(row.completed_by),
    requestedAt: requiredString(row.requested_at, 'requested_at'),
    approvedAt: nullableString(row.approved_at),
    completedAt: nullableString(row.completed_at),
    rejectedAt: nullableString(row.rejected_at),
    voidedAt: nullableString(row.voided_at),
    voidedBy: nullableString(row.voided_by),
    voidReason: nullableString(row.void_reason),
    externalReference: nullableString(row.external_reference),
    metadata: metadataObject(row.metadata),
    createdAt: requiredString(row.created_at, 'created_at'),
    updatedAt: requiredString(row.updated_at, 'updated_at'),
  };
}

export function mapFinancialAdjustmentRow(row: Record<string, unknown>): FinancialAdjustment {
  return {
    id: requiredString(row.id, 'id'),
    tenantId: requiredString(row.tenant_id, 'tenant_id'),
    patientId: requiredString(row.patient_id, 'patient_id'),
    invoiceId: nullableString(row.invoice_id),
    invoiceItemId: nullableString(row.invoice_item_id),
    paymentId: nullableString(row.payment_id),
    adjustmentType: requiredString(row.adjustment_type, 'adjustment_type') as FinancialAdjustmentType,
    status: requiredString(row.status, 'status') as FinancialAdjustmentStatus,
    amount: requiredNumber(row.amount, 'amount'),
    currency: requiredString(row.currency, 'currency'),
    reason: requiredString(row.reason, 'reason'),
    approvedBy: nullableString(row.approved_by),
    createdBy: nullableString(row.created_by),
    voidedBy: nullableString(row.voided_by),
    approvedAt: nullableString(row.approved_at),
    voidedAt: nullableString(row.voided_at),
    voidReason: nullableString(row.void_reason),
    metadata: metadataObject(row.metadata),
    createdAt: requiredString(row.created_at, 'created_at'),
    updatedAt: requiredString(row.updated_at, 'updated_at'),
  };
}

function isActiveStatus(status: string): boolean {
  return status !== 'voided' && status !== 'archived' && status !== 'rejected';
}

function sumBy<T>(rows: T[], selector: (row: T) => number): number {
  return Number(rows.reduce((total, row) => total + selector(row), 0).toFixed(2));
}

function latestDate(values: Array<string | null | undefined>): string | null {
  const dates = values.filter((value): value is string => Boolean(value));
  if (dates.length === 0) return null;
  return dates.sort().at(-1) ?? null;
}

export function computePatientFinanceSummary(
  tenantId: string,
  patientId: string,
  facts: PatientFinanceFacts,
): PatientFinanceSummary {
  const activeInvoices = facts.invoices.filter((invoice) => invoice.status !== 'voided' && invoice.status !== 'archived');
  const activePayments = facts.payments.filter((payment) => payment.status !== 'voided' && payment.status !== 'archived');
  const activeAllocations = facts.paymentAllocations.filter((allocation) => isActiveStatus(allocation.status));
  const completedRefunds = facts.refunds.filter((refund) => refund.status === 'completed');
  const activeAdjustments = facts.financialAdjustments.filter((adjustment) => isActiveStatus(adjustment.status));

  const invoiceTotalAmount = sumBy(activeInvoices, (invoice) => invoice.totalAmount);
  const paidAmount = sumBy(activePayments, (payment) => payment.amount);
  const allocatedPaymentAmount = sumBy(activeAllocations, (allocation) => allocation.amount);
  const refundedAmount = sumBy(completedRefunds, (refund) => refund.amount);
  const discountAmount = sumBy(activeAdjustments.filter((adjustment) => adjustment.adjustmentType === 'discount'), (adjustment) => adjustment.amount);
  const writeOffAmount = sumBy(activeAdjustments.filter((adjustment) => adjustment.adjustmentType === 'write_off'), (adjustment) => adjustment.amount);
  const surchargeAmount = sumBy(activeAdjustments.filter((adjustment) => adjustment.adjustmentType === 'surcharge'), (adjustment) => adjustment.amount);
  const correctionAmount = sumBy(activeAdjustments.filter((adjustment) => adjustment.adjustmentType === 'correction'), (adjustment) => adjustment.amount);
  const adjustmentAmount = Number((surchargeAmount + correctionAmount - discountAmount - writeOffAmount).toFixed(2));
  const amountDue = Number((invoiceTotalAmount + surchargeAmount + correctionAmount + refundedAmount - allocatedPaymentAmount - discountAmount - writeOffAmount).toFixed(2));
  const balanceAmount = Math.max(0, amountDue);
  const creditAmount = Math.max(0, Number((-amountDue).toFixed(2)));

  return {
    tenantId,
    patientId,
    invoiceTotalAmount,
    paidAmount,
    allocatedPaymentAmount,
    refundedAmount,
    discountAmount,
    writeOffAmount,
    adjustmentAmount,
    balanceAmount,
    creditAmount,
    openInvoiceCount: activeInvoices.filter((invoice) => ['draft', 'issued', 'partially_paid', 'written_off'].includes(invoice.status)).length,
    unpaidInvoiceCount: activeInvoices.filter((invoice) => invoice.balanceAmount > 0 && invoice.status !== 'paid').length,
    partiallyPaidInvoiceCount: activeInvoices.filter((invoice) => invoice.status === 'partially_paid').length,
    lastPaymentAt: latestDate(activePayments.map((payment) => payment.receivedAt)),
  };
}

export class SupabaseFinanceRepository implements FinanceRepository {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async listInvoices(options: ListInvoicesOptions): Promise<Invoice[]> {
    const tenantId = requireTenantId(options.tenantId);
    const limit = normalizeFinanceLimit(options.limit);
    const offset = normalizeFinanceOffset(options.offset);

    let query = this.client.from('invoices').select('*').eq('tenant_id', tenantId);
    if (options.patientId) query = query.eq('patient_id', options.patientId);
    const statuses = toArray(options.status);
    if (statuses?.length) query = query.in('status', statuses);
    if (!options.includeArchived) query = query.neq('status', 'archived');

    const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapInvoiceRow);
  }

  async getInvoiceById(options: GetInvoiceByIdOptions): Promise<Invoice | null> {
    const tenantId = requireTenantId(options.tenantId);
    const invoiceId = requireRecordId(options.invoiceId);
    const { data, error } = await this.client
      .from('invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', invoiceId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapInvoiceRow(data as Record<string, unknown>) : null;
  }

  async listInvoiceItems(options: ListInvoiceItemsOptions): Promise<InvoiceItem[]> {
    const tenantId = requireTenantId(options.tenantId);
    const limit = normalizeFinanceLimit(options.limit);
    const offset = normalizeFinanceOffset(options.offset);

    let query = this.client.from('invoice_items').select('*').eq('tenant_id', tenantId);
    if (options.invoiceId) query = query.eq('invoice_id', options.invoiceId);
    if (options.patientId) query = query.eq('patient_id', options.patientId);
    if (options.completedServiceId) query = query.eq('completed_service_id', options.completedServiceId);
    const statuses = toArray(options.status);
    if (statuses?.length) query = query.in('status', statuses);
    if (!options.includeArchived) query = query.neq('status', 'archived');

    const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapInvoiceItemRow);
  }

  async listPayments(options: ListPaymentsOptions): Promise<Payment[]> {
    const tenantId = requireTenantId(options.tenantId);
    const limit = normalizeFinanceLimit(options.limit);
    const offset = normalizeFinanceOffset(options.offset);

    let query = this.client.from('payments').select('*').eq('tenant_id', tenantId);
    if (options.patientId) query = query.eq('patient_id', options.patientId);
    const statuses = toArray(options.status);
    if (statuses?.length) query = query.in('status', statuses);
    const methods = toArray(options.paymentMethod);
    if (methods?.length) query = query.in('payment_method', methods);
    if (!options.includeArchived) query = query.neq('status', 'archived');

    const { data, error } = await query.order('received_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapPaymentRow);
  }

  async getPaymentById(options: GetPaymentByIdOptions): Promise<Payment | null> {
    const tenantId = requireTenantId(options.tenantId);
    const paymentId = requireRecordId(options.paymentId);
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', paymentId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapPaymentRow(data as Record<string, unknown>) : null;
  }

  async listPaymentAllocations(options: ListPaymentAllocationsOptions): Promise<PaymentAllocation[]> {
    const tenantId = requireTenantId(options.tenantId);
    const limit = normalizeFinanceLimit(options.limit);
    const offset = normalizeFinanceOffset(options.offset);

    let query = this.client.from('payment_allocations').select('*').eq('tenant_id', tenantId);
    if (options.paymentId) query = query.eq('payment_id', options.paymentId);
    if (options.invoiceId) query = query.eq('invoice_id', options.invoiceId);
    if (options.invoiceItemId) query = query.eq('invoice_item_id', options.invoiceItemId);
    if (options.patientId) query = query.eq('patient_id', options.patientId);
    if (!options.includeVoided) {
      query = query.neq('status', 'voided').neq('status', 'archived');
    }

    const { data, error } = await query.order('allocated_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapPaymentAllocationRow);
  }

  async listRefunds(options: ListRefundsOptions): Promise<Refund[]> {
    const tenantId = requireTenantId(options.tenantId);
    const limit = normalizeFinanceLimit(options.limit);
    const offset = normalizeFinanceOffset(options.offset);

    let query = this.client.from('refunds').select('*').eq('tenant_id', tenantId);
    if (options.patientId) query = query.eq('patient_id', options.patientId);
    if (options.paymentId) query = query.eq('payment_id', options.paymentId);
    const statuses = toArray(options.status);
    if (statuses?.length) query = query.in('status', statuses);
    if (!options.includeArchived) query = query.neq('status', 'archived');

    const { data, error } = await query.order('requested_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapRefundRow);
  }

  async listFinancialAdjustments(options: ListFinancialAdjustmentsOptions): Promise<FinancialAdjustment[]> {
    const tenantId = requireTenantId(options.tenantId);
    const limit = normalizeFinanceLimit(options.limit);
    const offset = normalizeFinanceOffset(options.offset);

    let query = this.client.from('financial_adjustments').select('*').eq('tenant_id', tenantId);
    if (options.patientId) query = query.eq('patient_id', options.patientId);
    if (options.invoiceId) query = query.eq('invoice_id', options.invoiceId);
    if (options.invoiceItemId) query = query.eq('invoice_item_id', options.invoiceItemId);
    if (options.paymentId) query = query.eq('payment_id', options.paymentId);
    const types = toArray(options.adjustmentType);
    if (types?.length) query = query.in('adjustment_type', types);
    const statuses = toArray(options.status);
    if (statuses?.length) query = query.in('status', statuses);
    if (!options.includeArchived) query = query.neq('status', 'archived');

    const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapFinancialAdjustmentRow);
  }

  async getPatientFinanceFacts(options: PatientFinanceOptions): Promise<PatientFinanceFacts> {
    const tenantId = requireTenantId(options.tenantId);
    const patientId = requirePatientId(options.patientId);
    const [invoices, invoiceItems, payments, paymentAllocations, refunds, financialAdjustments] = await Promise.all([
      this.listInvoices({ tenantId, patientId, includeArchived: true, limit: MAX_FINANCE_LIMIT }),
      this.listInvoiceItems({ tenantId, patientId, includeArchived: true, limit: MAX_FINANCE_LIMIT }),
      this.listPayments({ tenantId, patientId, includeArchived: true, limit: MAX_FINANCE_LIMIT }),
      this.listPaymentAllocations({ tenantId, patientId, includeVoided: true, limit: MAX_FINANCE_LIMIT }),
      this.listRefunds({ tenantId, patientId, includeArchived: true, limit: MAX_FINANCE_LIMIT }),
      this.listFinancialAdjustments({ tenantId, patientId, includeArchived: true, limit: MAX_FINANCE_LIMIT }),
    ]);
    return { invoices, invoiceItems, payments, paymentAllocations, refunds, financialAdjustments };
  }

  async getPatientFinanceSummary(options: PatientFinanceOptions): Promise<PatientFinanceSummary> {
    const tenantId = requireTenantId(options.tenantId);
    const patientId = requirePatientId(options.patientId);
    const facts = await this.getPatientFinanceFacts({ tenantId, patientId });
    return computePatientFinanceSummary(tenantId, patientId, facts);
  }
}

export function createFinanceRepository(options: CreateFinanceRepositoryOptions): FinanceRepository {
  if (options.backend === 'local') {
    throw new Error('Finance repository requires Supabase backend.');
  }
  const client = options.client ?? defaultSupabase;
  if (!client) {
    throw new Error('Supabase client is not configured for finance access.');
  }
  return new SupabaseFinanceRepository(client as SupabaseClient);
}
