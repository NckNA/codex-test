import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../../lib/supabaseClient';
import {
  mapInvoiceItemRow,
  mapInvoiceRow,
  mapPaymentAllocationRow,
  mapPaymentRow,
  mapRefundRow,
  mapFinancialAdjustmentRow,
  mapCompletedServiceBillingEligibilityRow,
  type CompletedServiceBillingEligibility,
  type Invoice,
  type InvoiceItem,
  type Payment,
  type PaymentAllocation,
  type PaymentMethod,
  type Refund,
  type RefundMethod,
  type FinancialAdjustment,
  type PatientFundReservation,
  type PatientFundReservationPurpose,
  type PaymentFundCapacity,
  mapPatientFundReservationRow,
  mapPaymentFundCapacityRow,
} from './FinanceRepository';

export type FinanceRpcErrorCategory =
  | 'validation'
  | 'permission'
  | 'stale_patient'
  | 'duplicate_conflict'
  | 'operation_uncertain'
  | 'payment_not_created'
  | 'operation_failed'
  | 'read_failed';

export interface FinanceRpcClientErrorDetails {
  operation: string;
  code?: string;
  category?: FinanceRpcErrorCategory;
  message: string;
}

export class FinanceRpcClientError extends Error {
  readonly operation: string;
  readonly code?: string;
  readonly category?: FinanceRpcErrorCategory;

  constructor(details: FinanceRpcClientErrorDetails) {
    super(details.message);
    this.name = 'FinanceRpcClientError';
    this.operation = details.operation;
    this.code = details.code;
    this.category = details.category;
  }
}

export interface CreateInvoiceInput {
  tenantId: string;
  patientId: string;
  currency?: string;
  dueDate?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AddInvoiceItemInput {
  tenantId: string;
  invoiceId: string;
  serviceName: string;
  quantity?: number;
  unitPrice?: number;
  discountAmount?: number;
  adjustmentAmount?: number;
  completedServiceId?: string | null;
  serviceCode?: string | null;
  toothNumber?: string | null;
  toothSurface?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface GetCompletedServiceBillingEligibilityInput {
  tenantId: string;
  patientId: string;
}

export interface IssueInvoiceInput {
  tenantId: string;
  invoiceId: string;
}

export interface VoidInvoiceInput {
  tenantId: string;
  invoiceId: string;
  reason: string;
}

export interface RecordPaymentInput {
  tenantId: string;
  patientId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  currency?: string;
  receivedAt?: string | null;
  externalReference?: string | null;
  payerName?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RecordAndAllocatePaymentInput {
  tenantId: string;
  patientId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  currency?: string;
  receivedAt?: string | null;
  externalReference?: string | null;
  payerName?: string | null;
  notes?: string | null;
  invoiceIds: string[];
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export type CashierPaymentOperationStatus = 'completed' | 'already_completed' | 'not_found';

export interface CashierPaymentOperationResult {
  status: CashierPaymentOperationStatus;
  operationId: string;
  tenantId: string;
  patientId: string | null;
  payment: Payment | null;
  allocations: PaymentAllocation[];
  issuedInvoiceIds: string[];
  requestedAmount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  remainingPatientDebt: number;
}

export interface GetCashierPaymentOperationInput {
  tenantId: string;
  idempotencyKey: string;
}

export interface AllocatePaymentInput {
  tenantId: string;
  paymentId: string;
  amount: number;
  invoiceId?: string | null;
  invoiceItemId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface VoidPaymentAllocationInput {
  tenantId: string;
  allocationId: string;
  reason: string;
}

export interface VoidPaymentInput {
  tenantId: string;
  paymentId: string;
  reason: string;
}
export interface CreatePatientFundReservationInput {
  tenantId: string;
  patientId: string;
  paymentId: string;
  amount: number;
  purposeType: PatientFundReservationPurpose;
  purposeLabel?: string | null;
  appointmentId?: string | null;
  treatmentPlanId?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
}

export interface ReleasePatientFundReservationInput {
  tenantId: string;
  reservationId: string;
  amount?: number | null;
  reason: string;
  idempotencyKey: string;
}

export interface AllocateReservedCreditInput {
  tenantId: string;
  patientId: string;
  reservationId: string;
  invoiceId: string;
  amount: number;
  idempotencyKey: string;
}

export interface PatientFundReservationOperationResult {
  status: 'completed' | 'already_completed';
  reservation: PatientFundReservation;
  allocation: PaymentAllocation | null;
  capacity: PaymentFundCapacity;
}

export interface RequestRefundInput {
  tenantId: string;
  paymentId: string;
  amount: number;
  refundMethod: RefundMethod;
  reason: string;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ApproveRefundInput { tenantId: string; refundId: string; }
export interface CompleteRefundInput {
  tenantId: string;
  refundId: string;
  externalReference?: string | null;
  metadata?: Record<string, unknown>;
}
export interface RejectRefundInput { tenantId: string; refundId: string; reason: string; }
export interface VoidRefundInput { tenantId: string; refundId: string; reason: string; }

export interface RequestInvoiceWriteOffInput {
  tenantId: string;
  invoiceId: string;
  amount: number;
  reason: string;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}
export interface ApproveInvoiceWriteOffInput { tenantId: string; adjustmentId: string; }
export interface RejectInvoiceWriteOffInput { tenantId: string; adjustmentId: string; reason: string; }
export interface VoidInvoiceWriteOffInput { tenantId: string; adjustmentId: string; reason: string; }

export interface FinanceRpcClient {
  createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
  addInvoiceItem(input: AddInvoiceItemInput): Promise<InvoiceItem>;
  getCompletedServiceBillingEligibility(input: GetCompletedServiceBillingEligibilityInput): Promise<CompletedServiceBillingEligibility[]>;
  issueInvoice(input: IssueInvoiceInput): Promise<Invoice>;
  voidInvoice(input: VoidInvoiceInput): Promise<Invoice>;
  recordPayment(input: RecordPaymentInput): Promise<Payment>;
  recordAndAllocatePayment(input: RecordAndAllocatePaymentInput): Promise<CashierPaymentOperationResult>;
  getCashierPaymentOperation(input: GetCashierPaymentOperationInput): Promise<CashierPaymentOperationResult>;
  allocatePayment(input: AllocatePaymentInput): Promise<PaymentAllocation>;
  voidPaymentAllocation(input: VoidPaymentAllocationInput): Promise<PaymentAllocation>;
  voidPayment(input: VoidPaymentInput): Promise<Payment>;
  createPatientFundReservation(input: CreatePatientFundReservationInput): Promise<PatientFundReservationOperationResult>;
  releasePatientFundReservation(input: ReleasePatientFundReservationInput): Promise<PatientFundReservationOperationResult>;
  allocateReservedCredit(input: AllocateReservedCreditInput): Promise<PatientFundReservationOperationResult>;
  requestRefund(input: RequestRefundInput): Promise<Refund>;
  approveRefund(input: ApproveRefundInput): Promise<Refund>;
  completeRefund(input: CompleteRefundInput): Promise<Refund>;
  rejectRefund(input: RejectRefundInput): Promise<Refund>;
  voidRefund(input: VoidRefundInput): Promise<Refund>;
  requestInvoiceWriteOff(input: RequestInvoiceWriteOffInput): Promise<FinancialAdjustment>;
  approveInvoiceWriteOff(input: ApproveInvoiceWriteOffInput): Promise<FinancialAdjustment>;
  rejectInvoiceWriteOff(input: RejectInvoiceWriteOffInput): Promise<FinancialAdjustment>;
  voidInvoiceWriteOff(input: VoidInvoiceWriteOffInput): Promise<FinancialAdjustment>;
}

export type FinanceRpcClientBackend = 'supabase' | 'local';

export interface CreateFinanceRpcClientOptions {
  backend: FinanceRpcClientBackend;
  client?: SupabaseClient;
}

const FINANCE_RPC_OPERATION_FAILED_MESSAGE = 'Не удалось выполнить финансовую операцию.';
const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'kaspi',
  'halyk_terminal',
  'card',
  'bank_transfer',
  'insurance',
  'osms',
  'mixed',
  'other',
];
const REFUND_METHODS: readonly RefundMethod[] = [
  'cash', 'kaspi', 'halyk_terminal', 'card', 'bank_transfer', 'other',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireNonEmptyString(value: string | null | undefined, message: string): string {
  if (!value || value.trim().length === 0) {
    throw new FinanceRpcClientError({ operation: 'validation', message });
  }
  return value;
}

function requireTenantId(tenantId: string | null | undefined): string {
  return requireNonEmptyString(tenantId, 'Не выбрана клиника.');
}

function requirePositiveNumber(value: number | null | undefined, message: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new FinanceRpcClientError({ operation: 'validation', message });
  }
  return value;
}

function requireNonNegativeNumber(value: number | null | undefined, message: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new FinanceRpcClientError({ operation: 'validation', message });
  }
  return value;
}

function validateMetadata(metadata?: Record<string, unknown> | null) {
  if (metadata !== undefined && !isPlainObject(metadata)) {
    throw new FinanceRpcClientError({ operation: 'validation', message: 'Метаданные должны быть объектом.' });
  }
}

function normalizeMetadata(metadata?: Record<string, unknown> | null): Record<string, unknown> {
  validateMetadata(metadata);
  return metadata ?? {};
}

function extractSingleRow(data: unknown, operation: string): Record<string, unknown> {
  if (!data) {
    throw new FinanceRpcClientError({ operation, message: FINANCE_RPC_OPERATION_FAILED_MESSAGE });
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !isPlainObject(row)) {
    throw new FinanceRpcClientError({ operation, message: FINANCE_RPC_OPERATION_FAILED_MESSAGE });
  }
  return row;
}

function getRpcErrorField(error: unknown, field: 'message' | 'code' | 'constraint' | 'details'): string | undefined {
  if (error instanceof Error && field === 'message') return error.message;
  if (error instanceof Error || isPlainObject(error)) {
    const value = (error as unknown as Record<string, unknown>)[field];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

function safeRpcErrorDetail(error: unknown): string {
  const raw = getRpcErrorField(error, 'message')?.trim() ?? '';
  if (!raw || raw.length > 240 || /[\r\n{}]/.test(raw) || raw.includes('[') || raw.includes(']')) return '';
  return raw.replace(/\s+/g, ' ');
}

function isCompletedServiceBillingConstraint(error: unknown, code?: string): boolean {
  if (code !== '23505') return false;
  const values = ['constraint', 'details', 'message']
    .map((field) => getRpcErrorField(error, field as 'constraint' | 'details' | 'message'))
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  return values.includes('uq_invoice_items_completed_service_billed_once');
}

function normalizeRpcError(error: unknown, operation: string): FinanceRpcClientError {
  if (error instanceof FinanceRpcClientError) return error;
  if (error instanceof Error || isPlainObject(error)) {
    const code = getRpcErrorField(error, 'code');
    const detail = safeRpcErrorDetail(error);
    const normalizedDetail = detail.toLowerCase();
    if (normalizedDetail.includes('часть средств зарезервирована как депозит')) {
      return new FinanceRpcClientError({
        operation,
        code,
        category: 'validation',
        message: 'Часть средств зарезервирована как депозит. Сначала освободите резерв.',
      });
    }
    if (normalizedDetail.includes('нельзя аннулировать платёж с активным депозитом')) {
      return new FinanceRpcClientError({
        operation,
        code,
        category: 'validation',
        message: 'Нельзя аннулировать платёж с активным депозитом.',
      });
    }
    if (['createPatientFundReservation', 'releasePatientFundReservation', 'allocateReservedCredit'].includes(operation)) {
      if (normalizedDetail.includes('недостаточно доступного кредита')) {
        return new FinanceRpcClientError({ operation, code, category: 'validation', message: 'Недостаточно доступного кредита для создания депозита.' });
      }
      if (normalizedDetail.includes('платёж недоступен') || normalizedDetail.includes('payment is not available')) {
        return new FinanceRpcClientError({ operation, code, category: 'validation', message: 'Платёж недоступен для резервирования.' });
      }
      if (normalizedDetail.includes('terminal') || normalizedDetail.includes('fully used') || normalizedDetail.includes('cannot be released') || normalizedDetail.includes('больше нельзя')) {
        return new FinanceRpcClientError({ operation, code, category: 'validation', message: 'Этот депозит больше нельзя изменить.' });
      }
      if (normalizedDetail.includes('invoice not found') || normalizedDetail.includes('invoice is not available') || normalizedDetail.includes('счёт недоступен')) {
        return new FinanceRpcClientError({ operation, code, category: 'validation', message: 'Выбранный счёт недоступен для использования депозита.' });
      }
      if (normalizedDetail.includes('already') || normalizedDetail.includes('idempotency') || normalizedDetail.includes('уже создан') || normalizedDetail.includes('different details')) {
        return new FinanceRpcClientError({ operation, code, category: 'duplicate_conflict', message: 'Операция уже была выполнена или параметры изменились.' });
      }
      if (normalizedDetail.includes('insufficient finance permissions') || normalizedDetail.includes('access denied') || code === '42501') {
        return new FinanceRpcClientError({ operation, code, category: 'permission', message: 'Недостаточно прав для этой операции.' });
      }
      return new FinanceRpcClientError({ operation, code, category: 'operation_failed', message: FINANCE_RPC_OPERATION_FAILED_MESSAGE });
    }
    if (operation === 'addInvoiceItem' && (
      detail.toLowerCase().includes('эта выполненная услуга уже включена')
      || isCompletedServiceBillingConstraint(error, code)
    )) {
      return new FinanceRpcClientError({
        operation,
        code,
        category: 'duplicate_conflict',
        message: 'Эта выполненная услуга уже включена в другой счёт.',
      });
    }
    return new FinanceRpcClientError({
      operation,
      code,
      message: operation === 'addInvoiceItem'
        ? FINANCE_RPC_OPERATION_FAILED_MESSAGE
        : detail
        ? `${FINANCE_RPC_OPERATION_FAILED_MESSAGE} ${detail}`
        : FINANCE_RPC_OPERATION_FAILED_MESSAGE,
    });
  }
  return new FinanceRpcClientError({ operation, message: FINANCE_RPC_OPERATION_FAILED_MESSAGE });
}

async function callRpc(
  client: SupabaseClient,
  operation: string,
  rpcName: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    const { data, error } = await client.rpc(rpcName, params);
    if (error) throw normalizeRpcError(error, operation);
    return extractSingleRow(data, operation);
  } catch (error) {
    throw normalizeRpcError(error, operation);
  }
}

async function callRpcRows(
  client: SupabaseClient,
  operation: string,
  rpcName: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  try {
    const { data, error } = await client.rpc(rpcName, params);
    if (error) throw normalizeRpcError(error, operation);
    if (!Array.isArray(data)) throw new FinanceRpcClientError({ operation, category: 'read_failed', message: FINANCE_RPC_OPERATION_FAILED_MESSAGE });
    return data.filter(isPlainObject);
  } catch (error) {
    throw normalizeRpcError(error, operation);
  }
}

function validatePaymentMethod(paymentMethod: PaymentMethod | null | undefined): PaymentMethod {
  const method = requireNonEmptyString(paymentMethod, 'Способ оплаты обязателен.') as PaymentMethod;
  if (!PAYMENT_METHODS.includes(method)) {
    throw new FinanceRpcClientError({ operation: 'validation', message: 'Некорректный способ оплаты.' });
  }
  return method;
}

function validateRefundMethod(refundMethod: RefundMethod | null | undefined): RefundMethod {
  const method = requireNonEmptyString(refundMethod, 'Способ возврата обязателен.') as RefundMethod;
  if (!REFUND_METHODS.includes(method)) {
    throw new FinanceRpcClientError({ operation: 'validation', message: 'Некорректный способ возврата.' });
  }
  return method;
}

function normalizeIdempotencyKey(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  if (!normalized) {
    throw new FinanceRpcClientError({ operation: 'validation', category: 'validation', message: 'Ключ идемпотентности не должен быть пустым.' });
  }
  return normalized;
}

function requireCashierIdempotencyKey(value?: string | null): string {
  const normalized = normalizeIdempotencyKey(value);
  if (!normalized) {
    throw new FinanceRpcClientError({ operation: 'validation', category: 'validation', message: 'Ключ кассовой операции обязателен.' });
  }
  return normalized;
}

function validateInvoiceIds(invoiceIds: string[] | null | undefined): string[] {
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    throw new FinanceRpcClientError({ operation: 'validation', category: 'validation', message: 'Нужно выбрать хотя бы один счёт.' });
  }
  const normalized = invoiceIds.map((invoiceId) => requireNonEmptyString(invoiceId, 'Счёт не выбран.'));
  if (new Set(normalized).size !== normalized.length) {
    throw new FinanceRpcClientError({ operation: 'validation', category: 'validation', message: 'Один и тот же счёт выбран несколько раз.' });
  }
  return normalized;
}

function requiredResultNumber(value: unknown, field: string): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new FinanceRpcClientError({ operation: 'mapCashierPaymentOperation', category: 'operation_failed', message: `Некорректное поле результата: ${field}.` });
  }
  return numeric;
}

function requiredResultString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new FinanceRpcClientError({ operation: 'mapCashierPaymentOperation', category: 'operation_failed', message: `Некорректное поле результата: ${field}.` });
  }
  return value;
}

function mapOperationCapacity(value: unknown): PaymentFundCapacity {
  if (!isPlainObject(value)) {
    throw new FinanceRpcClientError({ operation: 'mapPatientFundReservationOperation', category: 'operation_failed', message: FINANCE_RPC_OPERATION_FAILED_MESSAGE });
  }
  return mapPaymentFundCapacityRow({
    payment_id: value.paymentId,
    patient_id: value.patientId,
    currency: value.currency,
    payment_amount: value.paymentAmount,
    active_allocated_amount: value.activeAllocatedAmount,
    completed_refund_amount: value.completedRefundAmount,
    refund_reserved_amount: value.refundReservedAmount,
    reserved_deposit_amount: value.reservedDepositAmount,
    gross_unallocated_amount: value.grossUnallocatedAmount,
    available_credit_amount: value.availableCreditAmount,
  });
}

function mapPatientFundReservationOperationRow(row: Record<string, unknown>): PatientFundReservationOperationResult {
  const status = requiredResultString(row.status, 'status') as PatientFundReservationOperationResult['status'];
  if (!['completed', 'already_completed'].includes(status)) {
    throw new FinanceRpcClientError({ operation: 'mapPatientFundReservationOperation', category: 'operation_failed', message: FINANCE_RPC_OPERATION_FAILED_MESSAGE });
  }
  if (!isPlainObject(row.reservation)) {
    throw new FinanceRpcClientError({ operation: 'mapPatientFundReservationOperation', category: 'operation_failed', message: FINANCE_RPC_OPERATION_FAILED_MESSAGE });
  }
  const allocation = row.allocation == null
    ? null
    : isPlainObject(row.allocation)
      ? mapPaymentAllocationRow(row.allocation)
      : (() => { throw new FinanceRpcClientError({ operation: 'mapPatientFundReservationOperation', category: 'operation_failed', message: FINANCE_RPC_OPERATION_FAILED_MESSAGE }); })();
  return {
    status,
    reservation: mapPatientFundReservationRow(row.reservation),
    allocation,
    capacity: mapOperationCapacity(row.capacity),
  };
}

function mapCashierPaymentOperationRow(row: Record<string, unknown>): CashierPaymentOperationResult {
  const status = requiredResultString(row.status, 'status') as CashierPaymentOperationStatus;
  if (!['completed', 'already_completed', 'not_found'].includes(status)) {
    throw new FinanceRpcClientError({ operation: 'mapCashierPaymentOperation', category: 'operation_failed', message: 'Некорректный статус кассовой операции.' });
  }

  const allocationRows = Array.isArray(row.allocations) ? row.allocations : [];
  const issuedInvoiceIds = Array.isArray(row.issued_invoice_ids)
    ? row.issued_invoice_ids.filter((value): value is string => typeof value === 'string')
    : [];
  const paymentRow = isPlainObject(row.payment) ? row.payment : null;

  return {
    status,
    operationId: requiredResultString(row.operation_id, 'operation_id'),
    tenantId: requiredResultString(row.tenant_id, 'tenant_id'),
    patientId: typeof row.patient_id === 'string' ? row.patient_id : null,
    payment: paymentRow ? mapPaymentRow(paymentRow) : null,
    allocations: allocationRows.filter(isPlainObject).map(mapPaymentAllocationRow),
    issuedInvoiceIds,
    requestedAmount: requiredResultNumber(row.requested_amount, 'requested_amount'),
    allocatedAmount: requiredResultNumber(row.allocated_amount, 'allocated_amount'),
    unallocatedAmount: requiredResultNumber(row.unallocated_amount, 'unallocated_amount'),
    remainingPatientDebt: requiredResultNumber(row.remaining_patient_debt, 'remaining_patient_debt'),
  };
}

function normalizeCashierRpcError(error: unknown, operation: string): FinanceRpcClientError {
  if (error instanceof FinanceRpcClientError && error.category) return error;
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const normalized = raw.toLowerCase();
  const code = error instanceof Error && typeof (error as Error & { code?: unknown }).code === 'string'
    ? (error as Error & { code?: string }).code
    : undefined;

  if (normalized.includes('access denied') || normalized.includes('insufficient finance permissions') || code === '42501') {
    return new FinanceRpcClientError({ operation, code, category: 'permission', message: 'Недостаточно прав для кассовой операции.' });
  }
  if (normalized.includes('cashier_idempotency_conflict') || normalized.includes('operation key was reused')) {
    return new FinanceRpcClientError({ operation, code, category: 'duplicate_conflict', message: 'Ключ операции уже использован для другой оплаты.' });
  }
  if (
    normalized.includes('must be positive') ||
    normalized.includes('unsupported payment method') ||
    normalized.includes('invoice') ||
    normalized.includes('patient') ||
    normalized.includes('metadata') ||
    normalized.includes('currency') ||
    normalized.includes('idempotency key')
  ) {
    return new FinanceRpcClientError({ operation, code, category: 'validation', message: 'Проверьте пациента, сумму и выбранные счета.' });
  }
  if (normalized.includes('cashier_operation_failed')) {
    return new FinanceRpcClientError({ operation, code, category: 'operation_failed', message: 'Оплата не была создана.' });
  }
  return new FinanceRpcClientError({
    operation,
    code,
    category: 'operation_uncertain',
    message: 'Не удалось получить ответ сервера. Проверяем, была ли оплата сохранена.',
  });
}

async function callCashierRpc(
  client: SupabaseClient,
  operation: string,
  rpcName: string,
  params: Record<string, unknown>,
): Promise<CashierPaymentOperationResult> {
  try {
    const { data, error } = await client.rpc(rpcName, params);
    if (error) throw error;
    return mapCashierPaymentOperationRow(extractSingleRow(data, operation));
  } catch (error) {
    throw normalizeCashierRpcError(error, operation);
  }
}

export class SupabaseFinanceRpcClient implements FinanceRpcClient {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const operation = 'createInvoice';
    const tenantId = requireTenantId(input.tenantId);
    const patientId = requireNonEmptyString(input.patientId, 'Пациент не выбран.');
    const row = await callRpc(this.client, operation, 'create_invoice', {
      p_tenant_id: tenantId,
      p_patient_id: patientId,
      p_currency: input.currency || 'KZT',
      p_due_date: input.dueDate || null,
      p_notes: input.notes || null,
      p_metadata: normalizeMetadata(input.metadata),
    });
    return mapInvoiceRow(row);
  }

  async addInvoiceItem(input: AddInvoiceItemInput): Promise<InvoiceItem> {
    const operation = 'addInvoiceItem';
    const tenantId = requireTenantId(input.tenantId);
    const invoiceId = requireNonEmptyString(input.invoiceId, 'Счёт не выбран.');
    const serviceName = requireNonEmptyString(input.serviceName, 'Название услуги обязательно.');
    const quantity = input.quantity === undefined ? 1 : requirePositiveNumber(input.quantity, 'Количество должно быть больше 0.');
    const unitPrice = input.unitPrice === undefined ? 0 : requireNonNegativeNumber(input.unitPrice, 'Цена не может быть отрицательной.');
    const discountAmount = input.discountAmount === undefined ? 0 : requireNonNegativeNumber(input.discountAmount, 'Скидка не может быть отрицательной.');
    const adjustmentAmount = input.adjustmentAmount === undefined ? 0 : requireNonNegativeNumber(input.adjustmentAmount, 'Корректировка не может быть отрицательной.');

    const row = await callRpc(this.client, operation, 'add_invoice_item', {
      p_tenant_id: tenantId,
      p_invoice_id: invoiceId,
      p_service_name: serviceName,
      p_quantity: quantity,
      p_unit_price: unitPrice,
      p_discount_amount: discountAmount,
      p_adjustment_amount: adjustmentAmount,
      p_completed_service_id: input.completedServiceId || null,
      p_service_code: input.serviceCode || null,
      p_tooth_number: input.toothNumber || null,
      p_tooth_surface: input.toothSurface || null,
      p_notes: input.notes || null,
      p_metadata: normalizeMetadata(input.metadata),
    });
    return mapInvoiceItemRow(row);
  }

  async getCompletedServiceBillingEligibility(input: GetCompletedServiceBillingEligibilityInput): Promise<CompletedServiceBillingEligibility[]> {
    const operation = 'getCompletedServiceBillingEligibility';
    const rows = await callRpcRows(this.client, operation, 'get_completed_service_billing_eligibility', {
      p_tenant_id: requireTenantId(input.tenantId),
      p_patient_id: requireNonEmptyString(input.patientId, 'Пациент не выбран.'),
    });
    return rows.map(mapCompletedServiceBillingEligibilityRow);
  }

  async issueInvoice(input: IssueInvoiceInput): Promise<Invoice> {
    const operation = 'issueInvoice';
    const tenantId = requireTenantId(input.tenantId);
    const invoiceId = requireNonEmptyString(input.invoiceId, 'Счёт не выбран.');
    const row = await callRpc(this.client, operation, 'issue_invoice', {
      p_tenant_id: tenantId,
      p_invoice_id: invoiceId,
    });
    return mapInvoiceRow(row);
  }

  async voidInvoice(input: VoidInvoiceInput): Promise<Invoice> {
    const operation = 'voidInvoice';
    const tenantId = requireTenantId(input.tenantId);
    const invoiceId = requireNonEmptyString(input.invoiceId, 'Счёт не выбран.');
    const reason = requireNonEmptyString(input.reason, 'Причина обязательна.');
    const row = await callRpc(this.client, operation, 'void_invoice', {
      p_tenant_id: tenantId,
      p_invoice_id: invoiceId,
      p_reason: reason,
    });
    return mapInvoiceRow(row);
  }

  async recordPayment(input: RecordPaymentInput): Promise<Payment> {
    const operation = 'recordPayment';
    const tenantId = requireTenantId(input.tenantId);
    const patientId = requireNonEmptyString(input.patientId, 'Пациент не выбран.');
    const amount = requirePositiveNumber(input.amount, 'Сумма должна быть больше 0.');
    const paymentMethod = validatePaymentMethod(input.paymentMethod);
    const row = await callRpc(this.client, operation, 'record_payment', {
      p_tenant_id: tenantId,
      p_patient_id: patientId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_currency: input.currency || 'KZT',
      p_received_at: input.receivedAt || null,
      p_external_reference: input.externalReference || null,
      p_payer_name: input.payerName || null,
      p_notes: input.notes || null,
      p_metadata: normalizeMetadata(input.metadata),
    });
    return mapPaymentRow(row);
  }

  async recordAndAllocatePayment(input: RecordAndAllocatePaymentInput): Promise<CashierPaymentOperationResult> {
    const operation = 'recordAndAllocatePayment';
    const tenantId = requireTenantId(input.tenantId);
    const patientId = requireNonEmptyString(input.patientId, 'Пациент не выбран.');
    const amount = requirePositiveNumber(input.amount, 'Сумма должна быть больше 0.');
    const paymentMethod = validatePaymentMethod(input.paymentMethod);
    const invoiceIds = validateInvoiceIds(input.invoiceIds);
    const idempotencyKey = requireCashierIdempotencyKey(input.idempotencyKey);

    return callCashierRpc(this.client, operation, 'record_and_allocate_payment', {
      p_tenant_id: tenantId,
      p_patient_id: patientId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_currency: input.currency || 'KZT',
      p_received_at: input.receivedAt || null,
      p_external_reference: input.externalReference || null,
      p_payer_name: input.payerName || null,
      p_notes: input.notes || null,
      p_invoice_ids: invoiceIds,
      p_idempotency_key: idempotencyKey,
      p_metadata: normalizeMetadata(input.metadata),
    });
  }

  async getCashierPaymentOperation(input: GetCashierPaymentOperationInput): Promise<CashierPaymentOperationResult> {
    return callCashierRpc(this.client, 'getCashierPaymentOperation', 'get_cashier_payment_operation', {
      p_tenant_id: requireTenantId(input.tenantId),
      p_idempotency_key: requireCashierIdempotencyKey(input.idempotencyKey),
    });
  }

  async allocatePayment(input: AllocatePaymentInput): Promise<PaymentAllocation> {
    const operation = 'allocatePayment';
    const tenantId = requireTenantId(input.tenantId);
    const paymentId = requireNonEmptyString(input.paymentId, 'Платёж не выбран.');
    const amount = requirePositiveNumber(input.amount, 'Сумма должна быть больше 0.');
    if (!input.invoiceId && !input.invoiceItemId) {
      throw new FinanceRpcClientError({ operation: 'validation', message: 'Нужно выбрать счёт или позицию счёта.' });
    }
    const row = await callRpc(this.client, operation, 'allocate_payment', {
      p_tenant_id: tenantId,
      p_payment_id: paymentId,
      p_amount: amount,
      p_invoice_id: input.invoiceId || null,
      p_invoice_item_id: input.invoiceItemId || null,
      p_metadata: normalizeMetadata(input.metadata),
    });
    return mapPaymentAllocationRow(row);
  }

  async voidPaymentAllocation(input: VoidPaymentAllocationInput): Promise<PaymentAllocation> {
    const operation = 'voidPaymentAllocation';
    const tenantId = requireTenantId(input.tenantId);
    const allocationId = requireNonEmptyString(input.allocationId, 'Распределение платежа не выбрано.');
    const reason = requireNonEmptyString(input.reason, 'Причина обязательна.');
    const row = await callRpc(this.client, operation, 'void_payment_allocation', {
      p_tenant_id: tenantId,
      p_allocation_id: allocationId,
      p_reason: reason,
    });
    return mapPaymentAllocationRow(row);
  }

  async voidPayment(input: VoidPaymentInput): Promise<Payment> {
    const operation = 'voidPayment';
    const tenantId = requireTenantId(input.tenantId);
    const paymentId = requireNonEmptyString(input.paymentId, 'Платёж не выбран.');
    const reason = requireNonEmptyString(input.reason, 'Причина обязательна.');
    const row = await callRpc(this.client, operation, 'void_payment', {
      p_tenant_id: tenantId,
      p_payment_id: paymentId,
      p_reason: reason,
    });
    return mapPaymentRow(row);
  }


  async createPatientFundReservation(input: CreatePatientFundReservationInput): Promise<PatientFundReservationOperationResult> {
    const row = await callRpc(this.client, 'createPatientFundReservation', 'create_patient_fund_reservation', {
      p_tenant_id: requireTenantId(input.tenantId),
      p_patient_id: requireNonEmptyString(input.patientId, 'Пациент не выбран.'),
      p_payment_id: requireNonEmptyString(input.paymentId, 'Платёж не выбран.'),
      p_amount: requirePositiveNumber(input.amount, 'Сумма должна быть больше 0.'),
      p_purpose_type: requireNonEmptyString(input.purposeType, 'Назначение депозита обязательно.'),
      p_purpose_label: input.purposeLabel?.trim() || null,
      p_appointment_id: input.appointmentId?.trim() || null,
      p_treatment_plan_id: input.treatmentPlanId?.trim() || null,
      p_expires_at: input.expiresAt?.trim() || null,
      p_notes: input.notes?.trim() || null,
      p_metadata: normalizeMetadata(input.metadata),
      p_idempotency_key: requireNonEmptyString(input.idempotencyKey, 'Нужен ключ идемпотентности.').trim(),
    });
    return mapPatientFundReservationOperationRow(row);
  }

  async releasePatientFundReservation(input: ReleasePatientFundReservationInput): Promise<PatientFundReservationOperationResult> {
    const row = await callRpc(this.client, 'releasePatientFundReservation', 'release_patient_fund_reservation', {
      p_tenant_id: requireTenantId(input.tenantId),
      p_reservation_id: requireNonEmptyString(input.reservationId, 'Резерв не выбран.'),
      p_amount: input.amount == null ? null : requirePositiveNumber(input.amount, 'Сумма должна быть больше 0.'),
      p_reason: requireNonEmptyString(input.reason, 'Укажите причину.').trim(),
      p_idempotency_key: requireNonEmptyString(input.idempotencyKey, 'Нужен ключ идемпотентности.').trim(),
    });
    return mapPatientFundReservationOperationRow(row);
  }

  async allocateReservedCredit(input: AllocateReservedCreditInput): Promise<PatientFundReservationOperationResult> {
    const row = await callRpc(this.client, 'allocateReservedCredit', 'allocate_reserved_credit', {
      p_tenant_id: requireTenantId(input.tenantId),
      p_patient_id: requireNonEmptyString(input.patientId, 'Пациент не выбран.'),
      p_reservation_id: requireNonEmptyString(input.reservationId, 'Резерв не выбран.'),
      p_invoice_id: requireNonEmptyString(input.invoiceId, 'Счёт не выбран.'),
      p_amount: requirePositiveNumber(input.amount, 'Сумма должна быть больше 0.'),
      p_idempotency_key: requireNonEmptyString(input.idempotencyKey, 'Нужен ключ идемпотентности.').trim(),
    });
    return mapPatientFundReservationOperationRow(row);
  }

  async requestRefund(input: RequestRefundInput): Promise<Refund> {
    const operation = 'requestRefund';
    const row = await callRpc(this.client, operation, 'request_refund', {
      p_tenant_id: requireTenantId(input.tenantId),
      p_payment_id: requireNonEmptyString(input.paymentId, 'Платёж не выбран.'),
      p_amount: requirePositiveNumber(input.amount, 'Сумма возврата должна быть больше 0.'),
      p_refund_method: validateRefundMethod(input.refundMethod),
      p_reason: requireNonEmptyString(input.reason, 'Причина возврата обязательна.'),
      p_idempotency_key: normalizeIdempotencyKey(input.idempotencyKey),
      p_metadata: normalizeMetadata(input.metadata),
    });
    return mapRefundRow(row);
  }

  async approveRefund(input: ApproveRefundInput): Promise<Refund> {
    const operation = 'approveRefund';
    const row = await callRpc(this.client, operation, 'approve_refund', {
      p_tenant_id: requireTenantId(input.tenantId),
      p_refund_id: requireNonEmptyString(input.refundId, 'Возврат не выбран.'),
    });
    return mapRefundRow(row);
  }

  async completeRefund(input: CompleteRefundInput): Promise<Refund> {
    const operation = 'completeRefund';
    const row = await callRpc(this.client, operation, 'complete_refund', {
      p_tenant_id: requireTenantId(input.tenantId),
      p_refund_id: requireNonEmptyString(input.refundId, 'Возврат не выбран.'),
      p_external_reference: input.externalReference || null,
      p_metadata: normalizeMetadata(input.metadata),
    });
    return mapRefundRow(row);
  }

  async rejectRefund(input: RejectRefundInput): Promise<Refund> {
    const operation = 'rejectRefund';
    const row = await callRpc(this.client, operation, 'reject_refund', {
      p_tenant_id: requireTenantId(input.tenantId),
      p_refund_id: requireNonEmptyString(input.refundId, 'Возврат не выбран.'),
      p_reason: requireNonEmptyString(input.reason, 'Причина отказа обязательна.'),
    });
    return mapRefundRow(row);
  }

  async voidRefund(input: VoidRefundInput): Promise<Refund> {
    const operation = 'voidRefund';
    const row = await callRpc(this.client, operation, 'void_refund', {
      p_tenant_id: requireTenantId(input.tenantId),
      p_refund_id: requireNonEmptyString(input.refundId, 'Возврат не выбран.'),
      p_reason: requireNonEmptyString(input.reason, 'Причина отмены обязательна.'),
    });
    return mapRefundRow(row);
  }

  async requestInvoiceWriteOff(input: RequestInvoiceWriteOffInput): Promise<FinancialAdjustment> {
    const operation = 'requestInvoiceWriteOff';
    const row = await callRpc(this.client, operation, 'request_invoice_write_off', {
      p_tenant_id: requireTenantId(input.tenantId),
      p_invoice_id: requireNonEmptyString(input.invoiceId, 'Счёт не выбран.'),
      p_amount: requirePositiveNumber(input.amount, 'Сумма списания должна быть больше 0.'),
      p_reason: requireNonEmptyString(input.reason, 'Причина списания обязательна.'),
      p_idempotency_key: normalizeIdempotencyKey(input.idempotencyKey),
      p_metadata: normalizeMetadata(input.metadata),
    });
    return mapFinancialAdjustmentRow(row);
  }

  async approveInvoiceWriteOff(input: ApproveInvoiceWriteOffInput): Promise<FinancialAdjustment> {
    const operation = 'approveInvoiceWriteOff';
    const row = await callRpc(this.client, operation, 'approve_invoice_write_off', {
      p_tenant_id: requireTenantId(input.tenantId),
      p_adjustment_id: requireNonEmptyString(input.adjustmentId, 'Списание не выбрано.'),
    });
    return mapFinancialAdjustmentRow(row);
  }

  async rejectInvoiceWriteOff(input: RejectInvoiceWriteOffInput): Promise<FinancialAdjustment> {
    const operation = 'rejectInvoiceWriteOff';
    const row = await callRpc(this.client, operation, 'reject_invoice_write_off', {
      p_tenant_id: requireTenantId(input.tenantId),
      p_adjustment_id: requireNonEmptyString(input.adjustmentId, 'Списание не выбрано.'),
      p_reason: requireNonEmptyString(input.reason, 'Причина отказа обязательна.'),
    });
    return mapFinancialAdjustmentRow(row);
  }

  async voidInvoiceWriteOff(input: VoidInvoiceWriteOffInput): Promise<FinancialAdjustment> {
    const operation = 'voidInvoiceWriteOff';
    const row = await callRpc(this.client, operation, 'void_invoice_write_off', {
      p_tenant_id: requireTenantId(input.tenantId),
      p_adjustment_id: requireNonEmptyString(input.adjustmentId, 'Списание не выбрано.'),
      p_reason: requireNonEmptyString(input.reason, 'Причина отмены обязательна.'),
    });
    return mapFinancialAdjustmentRow(row);
  }
}

export function createFinanceRpcClient(options: CreateFinanceRpcClientOptions): FinanceRpcClient {
  if (options.backend === 'local') {
    throw new Error('Finance RPC client requires Supabase backend.');
  }

  const client = options.client !== undefined ? options.client : defaultSupabase;
  if (!client) {
    throw new Error('Supabase client is not configured for finance RPC access.');
  }

  return new SupabaseFinanceRpcClient(client as SupabaseClient);
}

