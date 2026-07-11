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
export type PatientFundReservationStatus = 'active' | 'partially_used' | 'fully_used' | 'released' | 'refunded' | 'archived';
export type PatientFundReservationPurpose = 'general' | 'appointment' | 'treatment_plan' | 'service' | 'other';

export interface PatientFundReservation {
  id: string;
  tenantId: string;
  patientId: string;
  paymentId: string;
  currency: string;
  purposeType: PatientFundReservationPurpose;
  purposeLabel: string | null;
  appointmentId: string | null;
  treatmentPlanId: string | null;
  originalAmount: number;
  consumedAmount: number;
  releasedAmount: number;
  remainingAmount: number;
  status: PatientFundReservationStatus;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  releasedAt: string | null;
  archivedAt: string | null;
}

export interface PaymentFundCapacity {
  paymentId: string;
  patientId: string;
  currency: string;
  paymentAmount: number;
  activeAllocatedAmount: number;
  completedRefundAmount: number;
  refundReservedAmount: number;
  reservedDepositAmount: number;
  grossUnallocatedAmount: number;
  availableCreditAmount: number;
}

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

export type CompletedServiceBillingState = 'unbilled' | 'billed' | 'unavailable';

export interface CompletedServiceBillingEligibility {
  completedServiceId: string;
  serviceName: string;
  serviceCode: string | null;
  toothNumber: string | null;
  toothSurface: string | null;
  quantity: number;
  unitPrice: number | null;
  currency: string;
  billingState: CompletedServiceBillingState;
  invoiceId: string | null;
  invoiceItemId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: InvoiceStatus | null;
  billedAt: string | null;
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
  cashierOperationKey: string | null;
  cashierOperationFingerprint: string | null;
  creditIntakeOperationKey: string | null;
  creditIntakeOperationFingerprint: string | null;
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
  patientFundReservationId: string | null;
  reservationOperationKey: string | null;
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
  idempotencyKey: string | null;
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
  idempotencyKey: string | null;
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

export type FinanceSummaryWarningCode =
  | 'PAYMENT_OVERCONSUMED'
  | 'REFUND_RESERVATION_EXCEEDS_CAPACITY'
  | 'DEPOSIT_RESERVATION_EXCEEDS_CAPACITY'
  | 'INVOICE_NEGATIVE_BALANCE'
  | 'INVOICE_PAID_MISMATCH'
  | 'INVOICE_WRITEOFF_MISMATCH'
  | 'INVOICE_STATUS_MISMATCH'
  | 'PAYMENT_STATUS_MISMATCH'
  | 'MULTIPLE_CURRENCIES';

export interface FinanceSummaryWarning {
  code: FinanceSummaryWarningCode;
  currency: string | null;
  entityType: 'invoice' | 'payment' | 'patient' | null;
  entityId: string | null;
  details: Record<string, string | number | boolean | null>;
}

export interface PatientFinanceCurrencySummary {
  currency: string;
  totalInvoiced: number;
  activeAllocatedAmount: number;
  cashReceived: number;
  completedRefundAmount: number;
  approvedWriteOffAmount: number;
  currentDebt: number;
  grossUnallocatedAmount: number;
  refundReservedAmount: number;
  reservedDepositAmount: number;
  availableCreditAmount: number;
  netPositionAmount: number;
  openInvoiceCount: number;
  unpaidInvoiceCount: number;
  partiallyPaidInvoiceCount: number;
  lastPaymentAt: string | null;
}

export interface PatientFinanceSummary {
  tenantId: string;
  patientId: string;
  asOf: string;
  modelVersion: string;
  currencies: PatientFinanceCurrencySummary[];
  factComplete: boolean;
  warnings: FinanceSummaryWarning[];
}

export interface PaymentRefundability {
  payment: Payment;
  paymentAmount: number;
  activeAllocatedAmount: number;
  completedRefundAmount: number;
  reservedRefundAmount: number;
  refundableAmount: number;
  hasActiveAllocations: boolean;
  refundCount: number;
  currency: string;
}

export interface InvoiceWriteOffEligibility {
  invoice: Invoice;
  invoiceTotalAmount: number;
  paidAmount: number;
  approvedWriteOffAmount: number;
  reservedWriteOffAmount: number;
  availableWriteOffAmount: number;
  eligible: boolean;
  ineligibilityReason: string | null;
  currency: string;
}

export interface GetPaymentRefundabilityOptions {
  tenantId: string;
  paymentId: string;
}

export interface GetInvoiceWriteOffEligibilityOptions {
  tenantId: string;
  invoiceId: string;
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
export interface GetPatientFundReservationsOptions extends PatientFinanceOptions {
  paymentId?: string;
}

export interface GetPaymentFundCapacityOptions extends PatientFinanceOptions {
  paymentId: string;
}

export interface GetCompletedServiceBillingEligibilityOptions {
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
  getPaymentRefundability(options: GetPaymentRefundabilityOptions): Promise<PaymentRefundability | null>;
  getInvoiceWriteOffEligibility(options: GetInvoiceWriteOffEligibilityOptions): Promise<InvoiceWriteOffEligibility | null>;
  getCompletedServiceBillingEligibility(options: GetCompletedServiceBillingEligibilityOptions): Promise<CompletedServiceBillingEligibility[]>;
  getPatientFinanceFacts(options: PatientFinanceOptions): Promise<PatientFinanceFacts>;
  getPatientFinanceSummary(options: PatientFinanceOptions): Promise<PatientFinanceSummary>;
  getPatientFundReservations(options: GetPatientFundReservationsOptions): Promise<PatientFundReservation[]>;
  getPaymentFundCapacity(options: GetPaymentFundCapacityOptions): Promise<PaymentFundCapacity | null>;
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

export function mapCompletedServiceBillingEligibilityRow(row: Record<string, unknown>): CompletedServiceBillingEligibility {
  const billingState = requiredString(row.billing_state, 'billing_state') as CompletedServiceBillingState;
  if (!['unbilled', 'billed', 'unavailable'].includes(billingState)) {
    throw new Error('Finance billing eligibility row has invalid billing_state');
  }
  const invoiceStatus = nullableString(row.invoice_status);
  if (invoiceStatus !== null && !['draft', 'issued', 'partially_paid', 'paid', 'voided', 'written_off', 'archived'].includes(invoiceStatus)) {
    throw new Error('Finance billing eligibility row has invalid invoice_status');
  }
  return {
    completedServiceId: requiredString(row.completed_service_id, 'completed_service_id'),
    serviceName: requiredString(row.service_name, 'service_name'),
    serviceCode: nullableString(row.service_code),
    toothNumber: nullableString(row.tooth_number),
    toothSurface: nullableString(row.tooth_surface),
    quantity: requiredNumber(row.quantity, 'quantity'),
    unitPrice: row.unit_price === null || row.unit_price === undefined ? null : requiredNumber(row.unit_price, 'unit_price'),
    currency: requiredString(row.currency, 'currency'),
    billingState,
    invoiceId: nullableString(row.invoice_id),
    invoiceItemId: nullableString(row.invoice_item_id),
    invoiceNumber: nullableString(row.invoice_number),
    invoiceStatus: invoiceStatus as InvoiceStatus | null,
    billedAt: nullableString(row.billed_at),
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
    cashierOperationKey: nullableString(row.cashier_operation_key),
    cashierOperationFingerprint: nullableString(row.cashier_operation_fingerprint),
    creditIntakeOperationKey: nullableString(row.credit_intake_operation_key),
    creditIntakeOperationFingerprint: nullableString(row.credit_intake_operation_fingerprint),
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
    patientFundReservationId: nullableString(row.patient_fund_reservation_id),
    reservationOperationKey: nullableString(row.reservation_operation_key),
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
    idempotencyKey: nullableString(row.idempotency_key),
    metadata: metadataObject(row.metadata),
    createdAt: requiredString(row.created_at, 'created_at'),
    updatedAt: requiredString(row.updated_at, 'updated_at'),
  };
}

const PATIENT_FUND_RESERVATION_STATUSES: PatientFundReservationStatus[] = [
  'active', 'partially_used', 'fully_used', 'released', 'refunded', 'archived',
];
const PATIENT_FUND_RESERVATION_PURPOSES: PatientFundReservationPurpose[] = [
  'general', 'appointment', 'treatment_plan', 'service', 'other',
];

export function mapPatientFundReservationRow(row: Record<string, unknown>): PatientFundReservation {
  const status = requiredString(row.status, 'status') as PatientFundReservationStatus;
  if (!PATIENT_FUND_RESERVATION_STATUSES.includes(status)) {
    throw new Error('Finance reservation row has invalid status');
  }
  const purposeType = requiredString(row.purpose_type, 'purpose_type') as PatientFundReservationPurpose;
  if (!PATIENT_FUND_RESERVATION_PURPOSES.includes(purposeType)) {
    throw new Error('Finance reservation row has invalid purpose_type');
  }
  return {
    id: requiredString(row.id, 'id'),
    tenantId: requiredString(row.tenant_id, 'tenant_id'),
    patientId: requiredString(row.patient_id, 'patient_id'),
    paymentId: requiredString(row.payment_id, 'payment_id'),
    currency: requiredString(row.currency, 'currency'),
    purposeType,
    purposeLabel: nullableString(row.purpose_label),
    appointmentId: nullableString(row.appointment_id),
    treatmentPlanId: nullableString(row.treatment_plan_id),
    originalAmount: requiredNumber(row.original_amount, 'original_amount'),
    consumedAmount: requiredNumber(row.consumed_amount, 'consumed_amount'),
    releasedAmount: requiredNumber(row.released_amount, 'released_amount'),
    remainingAmount: requiredNumber(row.remaining_amount, 'remaining_amount'),
    status,
    expiresAt: nullableString(row.expires_at),
    notes: nullableString(row.notes),
    createdAt: requiredString(row.created_at, 'created_at'),
    updatedAt: nullableString(row.updated_at),
    releasedAt: nullableString(row.released_at),
    archivedAt: nullableString(row.archived_at),
  };
}

export function mapPaymentFundCapacityRow(row: Record<string, unknown>): PaymentFundCapacity {
  return {
    paymentId: requiredString(row.payment_id, 'payment_id'),
    patientId: requiredString(row.patient_id, 'patient_id'),
    currency: normalizeCurrency(requiredString(row.currency, 'currency')),
    paymentAmount: requiredNumber(row.payment_amount, 'payment_amount'),
    activeAllocatedAmount: requiredNumber(row.active_allocated_amount, 'active_allocated_amount'),
    completedRefundAmount: requiredNumber(row.completed_refund_amount, 'completed_refund_amount'),
    refundReservedAmount: requiredNumber(row.refund_reserved_amount, 'refund_reserved_amount'),
    reservedDepositAmount: requiredNumber(row.reserved_deposit_amount, 'reserved_deposit_amount'),
    grossUnallocatedAmount: requiredNumber(row.gross_unallocated_amount, 'gross_unallocated_amount'),
    availableCreditAmount: requiredNumber(row.available_credit_amount, 'available_credit_amount'),
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
    idempotencyKey: nullableString(row.idempotency_key),
    metadata: metadataObject(row.metadata),
    createdAt: requiredString(row.created_at, 'created_at'),
    updatedAt: requiredString(row.updated_at, 'updated_at'),
  };
}


function requiredBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Finance summary has invalid boolean field: ${fieldName}`);
  return value;
}

function requiredArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Finance summary has invalid array field: ${fieldName}`);
  return value;
}

function normalizeCurrency(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!currency) throw new Error('Finance summary has empty currency.');
  return currency;
}

function safeWarningDetails(value: unknown): Record<string, string | number | boolean | null> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string | number | boolean | null] => {
      const detail = entry[1];
      return detail === null || ['string', 'number', 'boolean'].includes(typeof detail);
    }),
  );
}

export function mapPatientFinanceSummaryPayload(payload: unknown): PatientFinanceSummary {
  if (!isRecord(payload)) throw new Error('Finance summary RPC returned an invalid payload.');
  const currencies = requiredArray(payload.currencies, 'currencies').map((value, index) => {
    if (!isRecord(value)) throw new Error(`Finance summary currency bucket ${index} is invalid.`);
    return {
      currency: normalizeCurrency(requiredString(value.currency, `currencies[${index}].currency`)),
      totalInvoiced: requiredNumber(value.totalInvoiced, `currencies[${index}].totalInvoiced`),
      activeAllocatedAmount: requiredNumber(value.activeAllocatedAmount, `currencies[${index}].activeAllocatedAmount`),
      cashReceived: requiredNumber(value.cashReceived, `currencies[${index}].cashReceived`),
      completedRefundAmount: requiredNumber(value.completedRefundAmount, `currencies[${index}].completedRefundAmount`),
      approvedWriteOffAmount: requiredNumber(value.approvedWriteOffAmount, `currencies[${index}].approvedWriteOffAmount`),
      currentDebt: requiredNumber(value.currentDebt, `currencies[${index}].currentDebt`),
      grossUnallocatedAmount: requiredNumber(value.grossUnallocatedAmount, `currencies[${index}].grossUnallocatedAmount`),
      refundReservedAmount: requiredNumber(value.refundReservedAmount, `currencies[${index}].refundReservedAmount`),
      reservedDepositAmount: requiredNumber(value.reservedDepositAmount, `currencies[${index}].reservedDepositAmount`),
      availableCreditAmount: requiredNumber(value.availableCreditAmount, `currencies[${index}].availableCreditAmount`),
      netPositionAmount: requiredNumber(value.netPositionAmount, `currencies[${index}].netPositionAmount`),
      openInvoiceCount: requiredNumber(value.openInvoiceCount, `currencies[${index}].openInvoiceCount`),
      unpaidInvoiceCount: requiredNumber(value.unpaidInvoiceCount, `currencies[${index}].unpaidInvoiceCount`),
      partiallyPaidInvoiceCount: requiredNumber(value.partiallyPaidInvoiceCount, `currencies[${index}].partiallyPaidInvoiceCount`),
      lastPaymentAt: nullableString(value.lastPaymentAt),
    } satisfies PatientFinanceCurrencySummary;
  });

  const allowedCodes: FinanceSummaryWarningCode[] = [
    'PAYMENT_OVERCONSUMED', 'REFUND_RESERVATION_EXCEEDS_CAPACITY', 'DEPOSIT_RESERVATION_EXCEEDS_CAPACITY', 'INVOICE_NEGATIVE_BALANCE',
    'INVOICE_PAID_MISMATCH', 'INVOICE_WRITEOFF_MISMATCH', 'INVOICE_STATUS_MISMATCH',
    'PAYMENT_STATUS_MISMATCH', 'MULTIPLE_CURRENCIES',
  ];
  const warnings = requiredArray(payload.warnings, 'warnings').map((value, index) => {
    if (!isRecord(value)) throw new Error(`Finance summary warning ${index} is invalid.`);
    const code = requiredString(value.code, `warnings[${index}].code`) as FinanceSummaryWarningCode;
    if (!allowedCodes.includes(code)) throw new Error(`Finance summary warning ${index} has an unknown code.`);
    const entityType = value.entityType == null ? null : requiredString(value.entityType, `warnings[${index}].entityType`);
    if (entityType !== null && !['invoice', 'payment', 'patient'].includes(entityType)) {
      throw new Error(`Finance summary warning ${index} has an invalid entity type.`);
    }
    return {
      code,
      currency: value.currency == null ? null : normalizeCurrency(String(value.currency)),
      entityType: entityType as FinanceSummaryWarning['entityType'],
      entityId: nullableString(value.entityId),
      details: safeWarningDetails(value.details),
    } satisfies FinanceSummaryWarning;
  });

  return {
    tenantId: requiredString(payload.tenantId, 'tenantId'),
    patientId: requiredString(payload.patientId, 'patientId'),
    asOf: requiredString(payload.asOf, 'asOf'),
    modelVersion: requiredString(payload.modelVersion, 'modelVersion'),
    currencies,
    factComplete: requiredBoolean(payload.factComplete, 'factComplete'),
    warnings,
  };
}

export function getPatientFinanceCurrencySummaries(summary: PatientFinanceSummary | null | undefined): PatientFinanceCurrencySummary[] {
  return summary?.currencies ?? [];
}

function sumBy<T>(rows: T[], selector: (row: T) => number): number {
  return Number(rows.reduce((total, row) => total + selector(row), 0).toFixed(2));
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

  async getCompletedServiceBillingEligibility(options: GetCompletedServiceBillingEligibilityOptions): Promise<CompletedServiceBillingEligibility[]> {
    const tenantId = requireTenantId(options.tenantId);
    const patientId = requirePatientId(options.patientId);
    const { data, error } = await this.client.rpc('get_completed_service_billing_eligibility', {
      p_tenant_id: tenantId,
      p_patient_id: patientId,
    });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapCompletedServiceBillingEligibilityRow);
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

  async getPaymentRefundability(options: GetPaymentRefundabilityOptions): Promise<PaymentRefundability | null> {
    const tenantId = requireTenantId(options.tenantId);
    const paymentId = requireRecordId(options.paymentId);
    try {
      const payment = await this.getPaymentById({ tenantId, paymentId });
      if (!payment) return null;
      const [allocations, refunds] = await Promise.all([
        this.listPaymentAllocations({ tenantId, paymentId, includeVoided: true, limit: MAX_FINANCE_LIMIT }),
        this.listRefunds({ tenantId, paymentId, includeArchived: true, limit: MAX_FINANCE_LIMIT }),
      ]);
      const activeAllocatedAmount = sumBy(allocations.filter((row) => row.status === 'active'), (row) => row.amount);
      const completedRefundAmount = sumBy(refunds.filter((row) => row.status === 'completed'), (row) => row.amount);
      const reservedRefundAmount = sumBy(refunds.filter((row) => row.status === 'pending' || row.status === 'approved'), (row) => row.amount);
      return {
        payment,
        paymentAmount: payment.amount,
        activeAllocatedAmount,
        completedRefundAmount,
        reservedRefundAmount,
        refundableAmount: Math.max(0, Number((payment.amount - activeAllocatedAmount - completedRefundAmount - reservedRefundAmount).toFixed(2))),
        hasActiveAllocations: activeAllocatedAmount > 0,
        refundCount: refunds.length,
        currency: payment.currency,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown finance read failure';
      throw new Error(`Finance refundability read failed: ${message}`, { cause: error });
    }
  }

  async getInvoiceWriteOffEligibility(options: GetInvoiceWriteOffEligibilityOptions): Promise<InvoiceWriteOffEligibility | null> {
    const tenantId = requireTenantId(options.tenantId);
    const invoiceId = requireRecordId(options.invoiceId);
    try {
      const invoice = await this.getInvoiceById({ tenantId, invoiceId });
      if (!invoice) return null;
      const adjustments = await this.listFinancialAdjustments({
        tenantId,
        invoiceId,
        adjustmentType: 'write_off',
        includeArchived: true,
        limit: MAX_FINANCE_LIMIT,
      });
      const approvedWriteOffAmount = sumBy(adjustments.filter((row) => row.status === 'approved'), (row) => row.amount);
      const reservedWriteOffAmount = sumBy(adjustments.filter((row) => row.status === 'active'), (row) => row.amount);
      const availableWriteOffAmount = Math.max(0, Number((invoice.totalAmount - invoice.paidAmount - approvedWriteOffAmount - reservedWriteOffAmount).toFixed(2)));
      const eligibleStatuses: InvoiceStatus[] = ['issued', 'partially_paid'];
      const eligible = eligibleStatuses.includes(invoice.status) && availableWriteOffAmount > 0;
      const ineligibilityReason = eligible
        ? null
        : !eligibleStatuses.includes(invoice.status)
          ? `Invoice status ${invoice.status} is not eligible for write-off.`
          : 'Invoice has no available balance for write-off.';
      return {
        invoice,
        invoiceTotalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        approvedWriteOffAmount,
        reservedWriteOffAmount,
        availableWriteOffAmount,
        eligible,
        ineligibilityReason,
        currency: invoice.currency,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown finance read failure';
      throw new Error(`Finance write-off eligibility read failed: ${message}`, { cause: error });
    }
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
    try {
      const { data, error } = await this.client.rpc('get_patient_finance_summary', {
        p_tenant_id: tenantId,
        p_patient_id: patientId,
      });
      if (error) throw error;
      return mapPatientFinanceSummaryPayload(data);
    } catch (error) {
      throw new Error('Finance summary read failed.', { cause: error });
    }
  }


  async getPatientFundReservations(options: GetPatientFundReservationsOptions): Promise<PatientFundReservation[]> {
    const { data, error } = await this.client.rpc('get_patient_fund_reservations', {
      p_tenant_id: requireTenantId(options.tenantId),
      p_patient_id: requirePatientId(options.patientId),
      p_payment_id: options.paymentId ? requireRecordId(options.paymentId) : null,
    });
    if (error) throw new Error('Finance reservation read failed.', { cause: error });
    if (!Array.isArray(data)) throw new Error('Finance reservation RPC returned an invalid payload.');
    return data.filter(isRecord).map(mapPatientFundReservationRow);
  }

  async getPaymentFundCapacity(options: GetPaymentFundCapacityOptions): Promise<PaymentFundCapacity | null> {
    const { data, error } = await this.client.rpc('get_payment_fund_capacity', {
      p_tenant_id: requireTenantId(options.tenantId),
      p_patient_id: requirePatientId(options.patientId),
      p_payment_id: requireRecordId(options.paymentId),
    });
    if (error) throw new Error('Finance payment capacity read failed.', { cause: error });
    if (!Array.isArray(data)) throw new Error('Finance payment capacity RPC returned an invalid payload.');
    const row = data.find(isRecord);
    return row ? mapPaymentFundCapacityRow(row) : null;
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
