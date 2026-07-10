import { useCallback, useMemo, useState } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import { createFinanceRepository, type FinanceRepository, type Invoice, type InvoiceItem, type PatientFinanceSummary, type Payment, type PaymentAllocation, type PaymentMethod } from '../repositories/FinanceRepository';
import { createFinanceRpcClient, type FinanceRpcClient } from '../repositories/FinanceRpcClient';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export interface CashierPaymentFlowState {
  summary: PatientFinanceSummary | null;
  openInvoices: Invoice[];
  invoiceItems: InvoiceItem[];
  payments: Payment[];
  allocations: PaymentAllocation[];
}

export interface CashierPaymentInput {
  amount: number;
  paymentMethod: PaymentMethod;
  receivedAt?: string | null;
  externalReference?: string | null;
  payerName?: string | null;
  notes?: string | null;
}

export interface CashierPaymentResult {
  payment: Payment;
  allocations: PaymentAllocation[];
  allocatedInvoiceIds: string[];
  requestedAmount: number;
  allocatedAmount: number;
  remainingDebt: number;
  unallocatedAmount: number;
}

export interface UseCashierPaymentFlowOptions {
  tenantId?: string | null;
  patientId?: string | null;
  repository?: FinanceRepository;
  rpcClient?: FinanceRpcClient;
  enabled?: boolean;
}

const EMPTY_STATE: CashierPaymentFlowState = { summary: null, openInvoices: [], invoiceItems: [], payments: [], allocations: [] };
const ACTIONABLE_STATUSES = new Set(['draft', 'issued', 'partially_paid']);
const ACTION_METADATA = { source: 'cashier_payment_flow' };

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function safeCashierError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message || 'Не удалось сохранить оплату.';
    if (message.length <= 180 && !message.includes('\n') && !message.includes('{')) return new Error(message);
  }
  return new Error('Не удалось сохранить оплату.');
}

function getOpenInvoices(invoices: Invoice[], items: InvoiceItem[]) {
  return invoices.filter((invoice) => {
    if (!ACTIONABLE_STATUSES.has(invoice.status)) return false;
    if (invoice.status === 'draft' && !items.some((item) => item.invoiceId === invoice.id && item.status === 'active')) return false;
    return invoice.balanceAmount > 0 || invoice.status === 'draft';
  });
}

export function useCashierPaymentFlow({ tenantId, patientId, repository, rpcClient, enabled = true }: UseCashierPaymentFlowOptions) {
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [result, setResult] = useState<CashierPaymentResult | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<Error | null>(null);

  const financeRepository = useMemo(() => {
    if (repository) return repository;
    if (!isSupabaseConfigured) return null;
    return createFinanceRepository({ backend: 'supabase' });
  }, [repository]);

  const client = useMemo(() => {
    if (rpcClient) return rpcClient;
    if (!isSupabaseConfigured) return null;
    return createFinanceRpcClient({ backend: 'supabase' });
  }, [rpcClient]);

  const canFetch = Boolean(tenantId && patientId && enabled);

  const queryFn = useCallback(async (): Promise<CashierPaymentFlowState> => {
    if (!tenantId || !patientId) return EMPTY_STATE;
    if (!financeRepository) throw new Error('Не удалось загрузить данные кассы.');
    const [summary, invoices, invoiceItems, payments, allocations] = await Promise.all([
      financeRepository.getPatientFinanceSummary({ tenantId, patientId }),
      financeRepository.listInvoices({ tenantId, patientId, includeArchived: true, limit: 100 }),
      financeRepository.listInvoiceItems({ tenantId, patientId, includeArchived: true, limit: 200 }),
      financeRepository.listPayments({ tenantId, patientId, includeArchived: true, limit: 100 }),
      financeRepository.listPaymentAllocations({ tenantId, patientId, includeVoided: true, limit: 200 }),
    ]);
    return { summary, openInvoices: getOpenInvoices(invoices, invoiceItems), invoiceItems, payments, allocations };
  }, [financeRepository, patientId, tenantId]);

  const { data, isLoading, isError, error, refetch } = useAsyncQuery<CashierPaymentFlowState>({ queryFn, initialData: EMPTY_STATE, enabled: canFetch });

  const selectInvoice = useCallback((invoiceId: string, selected = true) => {
    setResult(null);
    setSelectedInvoiceIds((current) => selected ? [...new Set([...current, invoiceId])] : current.filter((id) => id !== invoiceId));
  }, []);

  const clearSelection = useCallback(() => setSelectedInvoiceIds([]), []);

  const recordAndAllocatePayment = useCallback(async (input: CashierPaymentInput) => {
    setActionError(null);
    setResult(null);
    if (!tenantId) throw new Error('Не выбрана клиника.');
    if (!patientId) throw new Error('Пациент не выбран.');
    if (!client) throw new Error('Не удалось сохранить оплату.');
    if (selectedInvoiceIds.length === 0) throw new Error('Счёт не выбран.');
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Сумма должна быть больше 0.');
    if (!input.paymentMethod) throw new Error('Способ оплаты обязателен.');

    const selectedInvoices = selectedInvoiceIds.map((id) => data.openInvoices.find((invoice) => invoice.id === id)).filter((invoice): invoice is Invoice => Boolean(invoice));
    if (selectedInvoices.length === 0) throw new Error('Счёт не выбран.');
    const totalSelectedBalance = Number(selectedInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.balanceAmount), 0).toFixed(2));
    if (input.amount > totalSelectedBalance) throw new Error('Сумма распределения превышает доступную сумму оплаты.');

    setActionLoading(true);
    try {
      for (const invoice of selectedInvoices) {
        if (invoice.status === 'draft') await client.issueInvoice({ tenantId, invoiceId: invoice.id });
      }
      const payment = await client.recordPayment({
        tenantId,
        patientId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        currency: 'KZT',
        receivedAt: normalizeOptionalText(input.receivedAt),
        externalReference: normalizeOptionalText(input.externalReference),
        payerName: normalizeOptionalText(input.payerName),
        notes: normalizeOptionalText(input.notes),
        metadata: ACTION_METADATA,
      });
      let remaining = input.amount;
      const allocations: PaymentAllocation[] = [];
      for (const invoice of selectedInvoices) {
        if (remaining <= 0) break;
        const amount = Number(Math.min(remaining, Math.max(0, invoice.balanceAmount)).toFixed(2));
        if (amount <= 0) continue;
        allocations.push(await client.allocatePayment({ tenantId, paymentId: payment.id, invoiceId: invoice.id, amount, metadata: ACTION_METADATA }));
        remaining = Number((remaining - amount).toFixed(2));
      }
      await refetch();
      const allocatedAmount = Number(allocations.reduce((sum, allocation) => sum + allocation.amount, 0).toFixed(2));
      const nextResult = { payment, allocations, allocatedInvoiceIds: selectedInvoices.map((invoice) => invoice.id), requestedAmount: input.amount, allocatedAmount, remainingDebt: Math.max(0, Number((totalSelectedBalance - allocatedAmount).toFixed(2))), unallocatedAmount: Math.max(0, Number((input.amount - allocatedAmount).toFixed(2))) };
      setResult(nextResult);
      setSelectedInvoiceIds([]);
      return nextResult;
    } catch (err) {
      const parsed = safeCashierError(err);
      setActionError(parsed);
      throw parsed;
    } finally {
      setActionLoading(false);
    }
  }, [client, data.openInvoices, patientId, refetch, selectedInvoiceIds, tenantId]);

  return { ...data, selectedInvoiceIds, selectedInvoices: data.openInvoices.filter((invoice) => selectedInvoiceIds.includes(invoice.id)), loading: isLoading, isLoading, error: actionError || error, isError: Boolean(actionError) || isError, actionLoading, result, refresh: refetch, selectInvoice, clearSelection, recordAndAllocatePayment };
}
