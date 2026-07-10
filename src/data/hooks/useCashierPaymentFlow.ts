/* eslint-disable react-hooks/set-state-in-effect -- patient identity changes must clear stale cashier state before replacement data is available */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import {
  createFinanceRepository,
  type FinanceRepository,
  type Invoice,
  type InvoiceItem,
  type PatientFinanceSummary,
  type Payment,
  type PaymentAllocation,
  type PaymentMethod,
} from '../repositories/FinanceRepository';
import {
  createFinanceRpcClient,
  FinanceRpcClientError,
  type CashierPaymentOperationResult,
  type FinanceRpcClient,
  type FinanceRpcErrorCategory,
} from '../repositories/FinanceRpcClient';
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

export type CashierOperationStatus =
  | 'idle'
  | 'loading_patient_finance'
  | 'ready'
  | 'submitting'
  | 'reconciling'
  | 'succeeded'
  | 'failed_before_commit'
  | 'uncertain'
  | 'stale_patient';

export interface CashierSafeError {
  category: FinanceRpcErrorCategory;
  message: string;
}

export interface CashierPaymentResult {
  tenantId: string;
  patientId: string;
  operationId: string;
  operationStatus: 'completed' | 'already_completed';
  payment: Payment;
  allocations: PaymentAllocation[];
  allocatedInvoiceIds: string[];
  issuedInvoiceIds: string[];
  requestedAmount: number;
  allocatedAmount: number;
  remainingDebt: number;
  unallocatedAmount: number;
  wasAlreadyCompleted: boolean;
}

interface CapturedCashierOperation {
  tenantId: string;
  patientId: string;
  invoiceIds: string[];
  operationKey: string;
  input: CashierPaymentInput;
}

interface ContextualError extends CashierSafeError {
  tenantId: string;
  patientId: string;
}

export interface UseCashierPaymentFlowOptions {
  tenantId?: string | null;
  patientId?: string | null;
  repository?: FinanceRepository;
  rpcClient?: FinanceRpcClient;
  enabled?: boolean;
}

const EMPTY_STATE: CashierPaymentFlowState = {
  summary: null,
  openInvoices: [],
  invoiceItems: [],
  payments: [],
  allocations: [],
};
const ACTIONABLE_STATUSES = new Set(['draft', 'issued', 'partially_paid']);
const ACTION_METADATA = { source: 'cashier_payment_flow' };

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function operationContextKey(tenantId?: string | null, patientId?: string | null) {
  return tenantId && patientId ? `${tenantId}:${patientId}` : null;
}

function createOperationKey(tenantId: string, patientId: string) {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `cashier-payment:${tenantId}:${patientId}:${randomId}`;
}

function getOpenInvoices(invoices: Invoice[], items: InvoiceItem[]) {
  return invoices.filter((invoice) => {
    if (!ACTIONABLE_STATUSES.has(invoice.status)) return false;
    if (invoice.status === 'draft' && !items.some((item) => item.invoiceId === invoice.id && item.status === 'active')) return false;
    return invoice.balanceAmount > 0 || invoice.status === 'draft';
  });
}

function classifyCashierError(error: unknown): CashierSafeError {
  if (error instanceof FinanceRpcClientError) {
    const category = error.category ?? (error.operation === 'validation' ? 'validation' : 'operation_failed');
    if (category === 'permission') return { category, message: 'Недостаточно прав для кассовой операции.' };
    if (category === 'duplicate_conflict') return { category, message: 'Ключ операции уже использован для другой оплаты.' };
    if (category === 'operation_uncertain') {
      return { category, message: 'Не удалось получить ответ сервера. Проверяем, была ли оплата сохранена.' };
    }
    if (category === 'validation') return { category, message: error.message || 'Проверьте сумму и выбранные счета.' };
    return { category, message: 'Оплата не была создана.' };
  }
  return { category: 'operation_uncertain', message: 'Не удалось получить ответ сервера. Проверяем, была ли оплата сохранена.' };
}

function mapOperationResult(operation: CashierPaymentOperationResult): CashierPaymentResult {
  if (!operation.payment || !operation.patientId || operation.status === 'not_found') {
    throw new FinanceRpcClientError({
      operation: 'mapCashierPaymentResult',
      category: 'operation_failed',
      message: 'Оплата не была создана.',
    });
  }

  return {
    tenantId: operation.tenantId,
    patientId: operation.patientId,
    operationId: operation.operationId,
    operationStatus: operation.status,
    payment: operation.payment,
    allocations: operation.allocations,
    allocatedInvoiceIds: operation.allocations
      .map((allocation) => allocation.invoiceId)
      .filter((invoiceId): invoiceId is string => Boolean(invoiceId)),
    issuedInvoiceIds: operation.issuedInvoiceIds,
    requestedAmount: operation.requestedAmount,
    allocatedAmount: operation.allocatedAmount,
    remainingDebt: operation.remainingPatientDebt,
    unallocatedAmount: operation.unallocatedAmount,
    wasAlreadyCompleted: operation.status === 'already_completed',
  };
}

export function useCashierPaymentFlow({
  tenantId,
  patientId,
  repository,
  rpcClient,
  enabled = true,
}: UseCashierPaymentFlowOptions) {
  const contextKey = operationContextKey(tenantId, patientId);
  const contextRef = useRef({ tenantId: tenantId ?? null, patientId: patientId ?? null, contextKey });

  useLayoutEffect(() => {
    contextRef.current = { tenantId: tenantId ?? null, patientId: patientId ?? null, contextKey };
  }, [contextKey, patientId, tenantId]);

  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [selectionContextKey, setSelectionContextKey] = useState<string | null>(contextKey);
  const [result, setResult] = useState<CashierPaymentResult | null>(null);
  const [operationStatus, setOperationStatus] = useState<CashierOperationStatus>('idle');
  const [operationKey, setOperationKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ContextualError | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);

  const operationRequestRef = useRef<CapturedCashierOperation | null>(null);
  const inFlightRef = useRef<Promise<CashierPaymentResult> | null>(null);
  const operationGenerationRef = useRef(0);

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
    if (!financeRepository) throw new Error('Не удалось загрузить финансовые данные.');
    try {
      const [summary, invoices, invoiceItems, payments, allocations] = await Promise.all([
        financeRepository.getPatientFinanceSummary({ tenantId, patientId }),
        financeRepository.listInvoices({ tenantId, patientId, includeArchived: true, limit: 100 }),
        financeRepository.listInvoiceItems({ tenantId, patientId, includeArchived: true, limit: 200 }),
        financeRepository.listPayments({ tenantId, patientId, includeArchived: true, limit: 100 }),
        financeRepository.listPaymentAllocations({ tenantId, patientId, includeVoided: true, limit: 200 }),
      ]);
      return { summary, openInvoices: getOpenInvoices(invoices, invoiceItems), invoiceItems, payments, allocations };
    } catch {
      throw new Error('Не удалось загрузить финансовые данные.');
    }
  }, [financeRepository, patientId, tenantId]);

  const { data, isLoading, isError, refetch } = useAsyncQuery<CashierPaymentFlowState>({
    queryFn,
    initialData: EMPTY_STATE,
    enabled: canFetch,
    queryKey: contextKey,
    resetOnDisable: true,
  });

  useEffect(() => {
    operationGenerationRef.current += 1;
    setSelectedInvoiceIds([]);
    setSelectionContextKey(contextKey);
    setResult(null);
    setActionError(null);
    setRefreshWarning(null);
    setOperationKey(null);
    operationRequestRef.current = null;
    inFlightRef.current = null;
    setOperationStatus(canFetch ? 'loading_patient_finance' : 'idle');
  }, [canFetch, contextKey]);

  useEffect(() => {
    if (!canFetch) {
      setOperationStatus('idle');
      return;
    }
    if (isLoading) {
      setOperationStatus((current) => ['submitting', 'reconciling', 'succeeded', 'uncertain'].includes(current)
        ? current
        : 'loading_patient_finance');
      return;
    }
    if (!isError) {
      setOperationStatus((current) => ['submitting', 'reconciling', 'succeeded', 'uncertain', 'failed_before_commit'].includes(current)
        ? current
        : 'ready');
    }
  }, [canFetch, isError, isLoading]);

  const visibleSelectedInvoiceIds = useMemo(
    () => selectionContextKey === contextKey ? selectedInvoiceIds : [],
    [contextKey, selectedInvoiceIds, selectionContextKey],
  );
  const visibleResult = result && result.tenantId === tenantId && result.patientId === patientId ? result : null;
  const visibleActionError = actionError && actionError.tenantId === tenantId && actionError.patientId === patientId
    ? actionError
    : null;

  const selectInvoice = useCallback((invoiceId: string, selected = true) => {
    if (!contextKey) return;
    setSelectionContextKey(contextKey);
    setResult(null);
    setRefreshWarning(null);
    setActionError(null);
    if (operationStatus === 'succeeded') {
      setOperationKey(null);
      operationRequestRef.current = null;
      setOperationStatus('ready');
    }
    setSelectedInvoiceIds((current) => selected
      ? [...new Set([...current, invoiceId])]
      : current.filter((id) => id !== invoiceId));
  }, [contextKey, operationStatus]);

  const clearSelection = useCallback(() => {
    setSelectedInvoiceIds([]);
    setSelectionContextKey(contextKey);
  }, [contextKey]);

  const applyConfirmedResult = useCallback(async (
    operation: CashierPaymentOperationResult,
    request: CapturedCashierOperation,
    generation: number,
  ): Promise<CashierPaymentResult> => {
    const mapped = mapOperationResult(operation);
    const activeContext = contextRef.current;
    if (
      generation !== operationGenerationRef.current ||
      activeContext.tenantId !== request.tenantId ||
      activeContext.patientId !== request.patientId ||
      mapped.tenantId !== request.tenantId ||
      mapped.patientId !== request.patientId
    ) {
      throw new FinanceRpcClientError({
        operation: 'cashierPatientContext',
        category: 'stale_patient',
        message: 'Пациент изменился. Результат сохранён за исходным пациентом.',
      });
    }

    setResult(mapped);
    setSelectedInvoiceIds([]);
    setSelectionContextKey(activeContext.contextKey);
    setActionError(null);
    setOperationStatus('succeeded');
    setOperationKey(request.operationKey);

    try {
      await queryFn();
      await refetch();
      setRefreshWarning(null);
    } catch {
      setRefreshWarning('Оплата сохранена, но данные не удалось обновить. Обновите страницу.');
    }
    return mapped;
  }, [queryFn, refetch]);

  const reconcileCapturedOperation = useCallback(async (
    request: CapturedCashierOperation,
    generation: number,
  ): Promise<CashierPaymentResult> => {
    if (!client) {
      throw new FinanceRpcClientError({ operation: 'getCashierPaymentOperation', category: 'operation_uncertain', message: 'Не удалось проверить результат операции.' });
    }
    setOperationStatus('reconciling');
    setActionError({
      tenantId: request.tenantId,
      patientId: request.patientId,
      category: 'operation_uncertain',
      message: 'Проверяем результат предыдущей операции…',
    });

    try {
      const operation = await client.getCashierPaymentOperation({
        tenantId: request.tenantId,
        idempotencyKey: request.operationKey,
      });
      if (operation.status === 'not_found') {
        const notCreated: ContextualError = {
          tenantId: request.tenantId,
          patientId: request.patientId,
          category: 'payment_not_created',
          message: 'Оплата не была создана.',
        };
        setActionError(notCreated);
        setOperationStatus('failed_before_commit');
        throw new FinanceRpcClientError({ operation: 'getCashierPaymentOperation', category: notCreated.category, message: notCreated.message });
      }
      return await applyConfirmedResult(operation, request, generation);
    } catch (reconcileError) {
      if (reconcileError instanceof FinanceRpcClientError && reconcileError.category === 'payment_not_created') throw reconcileError;
      const safe = classifyCashierError(reconcileError);
      const uncertain: ContextualError = {
        tenantId: request.tenantId,
        patientId: request.patientId,
        category: 'operation_uncertain',
        message: safe.category === 'permission'
          ? safe.message
          : 'Не удалось проверить результат операции. Не вводите оплату повторно до проверки.',
      };
      setActionError(uncertain);
      setOperationStatus('uncertain');
      throw new FinanceRpcClientError({ operation: 'getCashierPaymentOperation', category: uncertain.category, message: uncertain.message });
    }
  }, [applyConfirmedResult, client]);

  const executeCapturedOperation = useCallback(async (
    request: CapturedCashierOperation,
    generation: number,
  ): Promise<CashierPaymentResult> => {
    if (!client) {
      throw new FinanceRpcClientError({ operation: 'recordAndAllocatePayment', category: 'operation_failed', message: 'Оплата не была создана.' });
    }

    setOperationStatus('submitting');
    setActionError(null);
    setRefreshWarning(null);
    setOperationKey(request.operationKey);

    try {
      const operation = await client.recordAndAllocatePayment({
        tenantId: request.tenantId,
        patientId: request.patientId,
        amount: request.input.amount,
        paymentMethod: request.input.paymentMethod,
        currency: 'KZT',
        receivedAt: normalizeOptionalText(request.input.receivedAt),
        externalReference: normalizeOptionalText(request.input.externalReference),
        payerName: normalizeOptionalText(request.input.payerName),
        notes: normalizeOptionalText(request.input.notes),
        invoiceIds: request.invoiceIds,
        idempotencyKey: request.operationKey,
        metadata: ACTION_METADATA,
      });
      return await applyConfirmedResult(operation, request, generation);
    } catch (submitError) {
      if (submitError instanceof FinanceRpcClientError && submitError.category === 'stale_patient') {
        setOperationStatus('stale_patient');
        throw submitError;
      }

      const safe = classifyCashierError(submitError);
      if (safe.category === 'operation_uncertain') {
        setOperationStatus('uncertain');
        setActionError({ ...safe, tenantId: request.tenantId, patientId: request.patientId });
        return reconcileCapturedOperation(request, generation);
      }

      setOperationStatus('failed_before_commit');
      setActionError({ ...safe, tenantId: request.tenantId, patientId: request.patientId });
      throw new FinanceRpcClientError({ operation: 'recordAndAllocatePayment', category: safe.category, message: safe.message });
    }
  }, [applyConfirmedResult, client, reconcileCapturedOperation]);

  const recordAndAllocatePayment = useCallback(async (input: CashierPaymentInput): Promise<CashierPaymentResult> => {
    if (inFlightRef.current) return inFlightRef.current;
    if (!tenantId) throw new FinanceRpcClientError({ operation: 'validation', category: 'validation', message: 'Не выбрана клиника.' });
    if (!patientId) throw new FinanceRpcClientError({ operation: 'validation', category: 'validation', message: 'Пациент не выбран.' });
    if (visibleSelectedInvoiceIds.length === 0) throw new FinanceRpcClientError({ operation: 'validation', category: 'validation', message: 'Счёт не выбран.' });
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new FinanceRpcClientError({ operation: 'validation', category: 'validation', message: 'Сумма должна быть больше 0.' });
    if (!input.paymentMethod) throw new FinanceRpcClientError({ operation: 'validation', category: 'validation', message: 'Способ оплаты обязателен.' });

    const selectedInvoices = visibleSelectedInvoiceIds
      .map((id) => data.openInvoices.find((invoice) => invoice.id === id))
      .filter((invoice): invoice is Invoice => Boolean(invoice));
    if (selectedInvoices.length !== visibleSelectedInvoiceIds.length) {
      throw new FinanceRpcClientError({ operation: 'validation', category: 'stale_patient', message: 'Пациент изменился. Повторите операцию для выбранного пациента.' });
    }
    const totalSelectedBalance = Number(selectedInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.balanceAmount), 0).toFixed(2));
    if (input.amount > totalSelectedBalance) {
      throw new FinanceRpcClientError({ operation: 'validation', category: 'validation', message: 'Сумма превышает долг по выбранным счетам.' });
    }

    const request: CapturedCashierOperation = {
      tenantId,
      patientId,
      invoiceIds: [...visibleSelectedInvoiceIds],
      operationKey: createOperationKey(tenantId, patientId),
      input: { ...input },
    };
    operationRequestRef.current = request;
    const generation = operationGenerationRef.current;
    const promise = executeCapturedOperation(request, generation);
    inFlightRef.current = promise;
    try {
      return await promise;
    } finally {
      if (inFlightRef.current === promise) inFlightRef.current = null;
    }
  }, [data.openInvoices, executeCapturedOperation, patientId, tenantId, visibleSelectedInvoiceIds]);

  const retryOperation = useCallback(async (): Promise<CashierPaymentResult> => {
    if (inFlightRef.current) return inFlightRef.current;
    const request = operationRequestRef.current;
    if (!request) {
      throw new FinanceRpcClientError({ operation: 'retryCashierPayment', category: 'payment_not_created', message: 'Нет операции для безопасного повтора.' });
    }
    const generation = operationGenerationRef.current;
    const promise = executeCapturedOperation(request, generation);
    inFlightRef.current = promise;
    try {
      return await promise;
    } finally {
      if (inFlightRef.current === promise) inFlightRef.current = null;
    }
  }, [executeCapturedOperation]);

  const reconcileOperation = useCallback(async (): Promise<CashierPaymentResult> => {
    if (inFlightRef.current) return inFlightRef.current;
    const request = operationRequestRef.current;
    if (!request) {
      throw new FinanceRpcClientError({ operation: 'getCashierPaymentOperation', category: 'payment_not_created', message: 'Нет операции для проверки.' });
    }
    const generation = operationGenerationRef.current;
    const promise = reconcileCapturedOperation(request, generation);
    inFlightRef.current = promise;
    try {
      return await promise;
    } finally {
      if (inFlightRef.current === promise) inFlightRef.current = null;
    }
  }, [reconcileCapturedOperation]);

  const resetForPatient = useCallback((nextPatientId?: string | null) => {
    void nextPatientId;
    operationGenerationRef.current += 1;
    setSelectedInvoiceIds([]);
    setSelectionContextKey(null);
    setResult(null);
    setActionError(null);
    setRefreshWarning(null);
    setOperationKey(null);
    operationRequestRef.current = null;
    setOperationStatus('idle');
  }, []);

  const selectedInvoices = data.openInvoices.filter((invoice) => visibleSelectedInvoiceIds.includes(invoice.id));
  const safeReadError = isError ? new Error('Не удалось загрузить финансовые данные.') : null;
  const displayError = visibleActionError ? new Error(visibleActionError.message) : safeReadError;
  const effectiveOperationStatus: CashierOperationStatus = !contextKey
    ? 'idle'
    : visibleResult
      ? 'succeeded'
      : operationStatus;

  return {
    ...data,
    financeData: data,
    activePatientId: patientId ?? null,
    selectedInvoiceIds: visibleSelectedInvoiceIds,
    selectedInvoices,
    loading: isLoading,
    isLoading,
    error: displayError,
    safeError: visibleActionError,
    isError: Boolean(visibleActionError) || isError,
    actionLoading: effectiveOperationStatus === 'submitting' || effectiveOperationStatus === 'reconciling',
    operationStatus: effectiveOperationStatus,
    operationKey,
    refreshWarning,
    result: visibleResult,
    refresh: refetch,
    selectInvoice,
    clearSelection,
    submitPayment: recordAndAllocatePayment,
    recordAndAllocatePayment,
    retryOperation,
    reconcileOperation,
    resetForPatient,
  };
}
