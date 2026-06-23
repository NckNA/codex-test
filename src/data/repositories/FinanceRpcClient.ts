import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../../lib/supabaseClient';
import {
  mapInvoiceItemRow,
  mapInvoiceRow,
  mapPaymentAllocationRow,
  mapPaymentRow,
  type Invoice,
  type InvoiceItem,
  type Payment,
  type PaymentAllocation,
  type PaymentMethod,
} from './FinanceRepository';

export interface FinanceRpcClientErrorDetails {
  operation: string;
  code?: string;
  message: string;
}

export class FinanceRpcClientError extends Error {
  readonly operation: string;
  readonly code?: string;

  constructor(details: FinanceRpcClientErrorDetails) {
    super(details.message);
    this.name = 'FinanceRpcClientError';
    this.operation = details.operation;
    this.code = details.code;
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

export interface FinanceRpcClient {
  createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
  addInvoiceItem(input: AddInvoiceItemInput): Promise<InvoiceItem>;
  issueInvoice(input: IssueInvoiceInput): Promise<Invoice>;
  voidInvoice(input: VoidInvoiceInput): Promise<Invoice>;
  recordPayment(input: RecordPaymentInput): Promise<Payment>;
  allocatePayment(input: AllocatePaymentInput): Promise<PaymentAllocation>;
  voidPaymentAllocation(input: VoidPaymentAllocationInput): Promise<PaymentAllocation>;
  voidPayment(input: VoidPaymentInput): Promise<Payment>;
}

export type FinanceRpcClientBackend = 'supabase' | 'local';

export interface CreateFinanceRpcClientOptions {
  backend: FinanceRpcClientBackend;
  client?: SupabaseClient;
}

const FINANCE_RPC_OPERATION_FAILED_MESSAGE = 'РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ С„РёРЅР°РЅСЃРѕРІСѓСЋ РѕРїРµСЂР°С†РёСЋ.';
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
  return requireNonEmptyString(tenantId, 'РќРµ РІС‹Р±СЂР°РЅР° РєР»РёРЅРёРєР°.');
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
    throw new FinanceRpcClientError({ operation: 'validation', message: 'РњРµС‚Р°РґР°РЅРЅС‹Рµ РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ РѕР±СЉРµРєС‚РѕРј.' });
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

function normalizeRpcError(error: unknown, operation: string): FinanceRpcClientError {
  if (error instanceof FinanceRpcClientError) return error;
  if (error instanceof Error) {
    const errorWithCode = error as unknown as { code?: unknown };
    const code = typeof errorWithCode.code === 'string' ? errorWithCode.code : undefined;
    return new FinanceRpcClientError({
      operation,
      code,
      message: `${FINANCE_RPC_OPERATION_FAILED_MESSAGE} ${error.message}`.trim(),
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
  const { data, error } = await client.rpc(rpcName, params);
  if (error) throw normalizeRpcError(error, operation);
  return extractSingleRow(data, operation);
}

function validatePaymentMethod(paymentMethod: PaymentMethod | null | undefined): PaymentMethod {
  const method = requireNonEmptyString(paymentMethod, 'РЎРїРѕСЃРѕР± РѕРїР»Р°С‚С‹ РѕР±СЏР·Р°С‚РµР»РµРЅ.') as PaymentMethod;
  if (!PAYMENT_METHODS.includes(method)) {
    throw new FinanceRpcClientError({ operation: 'validation', message: 'РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ СЃРїРѕСЃРѕР± РѕРїР»Р°С‚С‹.' });
  }
  return method;
}

export class SupabaseFinanceRpcClient implements FinanceRpcClient {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const operation = 'createInvoice';
    const tenantId = requireTenantId(input.tenantId);
    const patientId = requireNonEmptyString(input.patientId, 'РџР°С†РёРµРЅС‚ РЅРµ РІС‹Р±СЂР°РЅ.');
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
    const invoiceId = requireNonEmptyString(input.invoiceId, 'РЎС‡С‘С‚ РЅРµ РІС‹Р±СЂР°РЅ.');
    const serviceName = requireNonEmptyString(input.serviceName, 'РќР°Р·РІР°РЅРёРµ СѓСЃР»СѓРіРё РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ.');
    const quantity = input.quantity === undefined ? 1 : requirePositiveNumber(input.quantity, 'РљРѕР»РёС‡РµСЃС‚РІРѕ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0.');
    const unitPrice = input.unitPrice === undefined ? 0 : requireNonNegativeNumber(input.unitPrice, 'Р¦РµРЅР° РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ РѕС‚СЂРёС†Р°С‚РµР»СЊРЅРѕР№.');
    const discountAmount = input.discountAmount === undefined ? 0 : requireNonNegativeNumber(input.discountAmount, 'РЎРєРёРґРєР° РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ РѕС‚СЂРёС†Р°С‚РµР»СЊРЅРѕР№.');
    const adjustmentAmount = input.adjustmentAmount === undefined ? 0 : requireNonNegativeNumber(input.adjustmentAmount, 'РљРѕСЂСЂРµРєС‚РёСЂРѕРІРєР° РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ РѕС‚СЂРёС†Р°С‚РµР»СЊРЅРѕР№.');

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

  async issueInvoice(input: IssueInvoiceInput): Promise<Invoice> {
    const operation = 'issueInvoice';
    const tenantId = requireTenantId(input.tenantId);
    const invoiceId = requireNonEmptyString(input.invoiceId, 'РЎС‡С‘С‚ РЅРµ РІС‹Р±СЂР°РЅ.');
    const row = await callRpc(this.client, operation, 'issue_invoice', {
      p_tenant_id: tenantId,
      p_invoice_id: invoiceId,
    });
    return mapInvoiceRow(row);
  }

  async voidInvoice(input: VoidInvoiceInput): Promise<Invoice> {
    const operation = 'voidInvoice';
    const tenantId = requireTenantId(input.tenantId);
    const invoiceId = requireNonEmptyString(input.invoiceId, 'РЎС‡С‘С‚ РЅРµ РІС‹Р±СЂР°РЅ.');
    const reason = requireNonEmptyString(input.reason, 'РџСЂРёС‡РёРЅР° РѕР±СЏР·Р°С‚РµР»СЊРЅР°.');
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
    const patientId = requireNonEmptyString(input.patientId, 'РџР°С†РёРµРЅС‚ РЅРµ РІС‹Р±СЂР°РЅ.');
    const amount = requirePositiveNumber(input.amount, 'РЎСѓРјРјР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0.');
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

  async allocatePayment(input: AllocatePaymentInput): Promise<PaymentAllocation> {
    const operation = 'allocatePayment';
    const tenantId = requireTenantId(input.tenantId);
    const paymentId = requireNonEmptyString(input.paymentId, 'РџР»Р°С‚С‘Р¶ РЅРµ РІС‹Р±СЂР°РЅ.');
    const amount = requirePositiveNumber(input.amount, 'РЎСѓРјРјР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0.');
    if (!input.invoiceId && !input.invoiceItemId) {
      throw new FinanceRpcClientError({ operation: 'validation', message: 'РќСѓР¶РЅРѕ РІС‹Р±СЂР°С‚СЊ СЃС‡С‘С‚ РёР»Рё РїРѕР·РёС†РёСЋ СЃС‡С‘С‚Р°.' });
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
    const allocationId = requireNonEmptyString(input.allocationId, 'Р Р°СЃРїСЂРµРґРµР»РµРЅРёРµ РїР»Р°С‚РµР¶Р° РЅРµ РІС‹Р±СЂР°РЅРѕ.');
    const reason = requireNonEmptyString(input.reason, 'РџСЂРёС‡РёРЅР° РѕР±СЏР·Р°С‚РµР»СЊРЅР°.');
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
    const paymentId = requireNonEmptyString(input.paymentId, 'РџР»Р°С‚С‘Р¶ РЅРµ РІС‹Р±СЂР°РЅ.');
    const reason = requireNonEmptyString(input.reason, 'РџСЂРёС‡РёРЅР° РѕР±СЏР·Р°С‚РµР»СЊРЅР°.');
    const row = await callRpc(this.client, operation, 'void_payment', {
      p_tenant_id: tenantId,
      p_payment_id: paymentId,
      p_reason: reason,
    });
    return mapPaymentRow(row);
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

