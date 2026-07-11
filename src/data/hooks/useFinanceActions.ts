/* eslint-disable react-hooks/set-state-in-effect -- tenant/patient changes must clear visible operation state before late responses can render */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  createFinanceRpcClient,
  FinanceRpcClientError,
  type FinanceRpcClient,
  type PatientCreditPaymentOperationResult,
  type RecordPaymentInput,
} from '../repositories/FinanceRpcClient';
import type { PaymentMethod } from '../repositories/FinanceRepository';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export type FinanceActionName = 'createInvoice' | 'addInvoiceItem' | 'issueInvoice' | 'voidInvoice' | 'recordPayment' | 'allocatePayment' | 'voidPaymentAllocation' | 'voidPayment';
export type PatientCreditOperationStatus = 'idle' | 'submitting' | 'reconciling' | 'succeeded' | 'failed' | 'uncertain';

export interface CreateInvoiceActionInput {
  currency?: string;
  dueDate?: string | null;
  notes?: string | null;
}

export interface AddInvoiceItemActionInput {
  invoiceId: string;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  adjustmentAmount?: number;
  completedServiceId?: string | null;
  serviceCode?: string | null;
  toothNumber?: string | null;
  toothSurface?: string | null;
  notes?: string | null;
}

export interface RecordPaymentActionInput {
  amount: number;
  paymentMethod: PaymentMethod;
  currency?: string;
  receivedAt?: string | null;
  externalReference?: string | null;
  payerName?: string | null;
  notes?: string | null;
}

export interface AllocatePaymentActionInput {
  paymentId: string;
  amount: number;
  invoiceId?: string | null;
  invoiceItemId?: string | null;
}

export interface UseFinanceActionsOptions {
  tenantId?: string | null;
  patientId?: string | null;
  refresh?: () => Promise<void> | void;
  rpcClient?: FinanceRpcClient;
}

export interface UseFinanceActionsResult {
  actionLoading: FinanceActionName | null;
  loading: boolean;
  actionError: Error | null;
  error: Error | null;
  patientCreditOperationStatus: PatientCreditOperationStatus;
  patientCreditOperationResult: PatientCreditPaymentOperationResult | null;
  createInvoice: (input?: CreateInvoiceActionInput) => Promise<void>;
  addInvoiceItem: (input: AddInvoiceItemActionInput) => Promise<void>;
  issueInvoice: (invoiceId: string) => Promise<void>;
  voidInvoice: (invoiceId: string, reason: string) => Promise<void>;
  recordPayment: (input: RecordPaymentActionInput) => Promise<PatientCreditPaymentOperationResult>;
  allocatePayment: (input: AllocatePaymentActionInput) => Promise<void>;
  voidPaymentAllocation: (allocationId: string, reason: string) => Promise<void>;
  voidPayment: (paymentId: string, reason: string) => Promise<void>;
  clearError: () => void;
  resetPatientCreditOperation: () => void;
}

const ACTION_METADATA = { source: 'patient_finance_ui' };
const COMPLETED_SERVICE_ALREADY_BILLED_ERROR = 'Эта выполненная услуга уже включена в другой счёт.';
const COMPLETED_SERVICE_ALREADY_BILLED_REFRESHED_ERROR = 'Услуга уже была включена в другой счёт. Данные обновлены.';
const PATIENT_CREDIT_UNCERTAIN_MESSAGE = 'Не удалось подтвердить результат операции. Повторите попытку с теми же данными.';

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function safeFinanceError(error: unknown): Error {
  if (error instanceof Error) {
    const message = error.message || 'Не удалось выполнить финансовую операцию.';
    const lower = message.toLowerCase();
    if (lower.includes('permission') || lower.includes('denied') || lower.includes('access denied') || lower.includes('insufficient')) {
      return new Error('Недостаточно прав для финансовой операции.');
    }
    if (message.length <= 180 && !message.includes('\n') && !message.includes('{')) {
      return new Error(message);
    }
  }
  return new Error('Не удалось выполнить финансовую операцию.');
}

function safePatientCreditError(error: unknown): FinanceRpcClientError {
  if (error instanceof FinanceRpcClientError) {
    const category = error.category ?? 'operation_failed';
    const lower = error.message.toLowerCase();
    if (category === 'permission') {
      return new FinanceRpcClientError({ operation: 'recordPayment', category, message: 'Недостаточно прав для приёма предоплаты.' });
    }
    if (category === 'duplicate_conflict') {
      return new FinanceRpcClientError({ operation: 'recordPayment', category, message: 'Эта операция уже была выполнена с другими параметрами.' });
    }
    if (category === 'stale_patient') {
      return new FinanceRpcClientError({ operation: 'recordPayment', category, message: 'Операция относится к другому пациенту. Данные обновлены.' });
    }
    if (category === 'operation_uncertain') {
      return new FinanceRpcClientError({ operation: 'recordPayment', category, message: PATIENT_CREDIT_UNCERTAIN_MESSAGE });
    }
    if (category === 'validation' && (lower.includes('kzt') || lower.includes('currency') || lower.includes('валют'))) {
      return new FinanceRpcClientError({ operation: 'recordPayment', category, message: 'Предоплата принимается только в KZT.' });
    }
    if (category === 'validation') {
      return new FinanceRpcClientError({ operation: 'recordPayment', category, message: error.message.length <= 160 && !error.message.includes('{') ? error.message : 'Проверьте данные предоплаты.' });
    }
  }
  return new FinanceRpcClientError({
    operation: 'recordPayment',
    category: 'operation_uncertain',
    message: 'Не удалось принять предоплату. Проверьте текущее состояние операции.',
  });
}

function isCompletedServiceDuplicate(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes(COMPLETED_SERVICE_ALREADY_BILLED_ERROR.toLowerCase());
}

interface PendingPatientCreditOperation {
  idempotencyKey: string;
  fingerprint: string;
}

function patientCreditFingerprint(input: Omit<RecordPaymentInput, 'tenantId' | 'patientId' | 'idempotencyKey'>): string {
  return JSON.stringify({
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    currency: input.currency,
    receivedAt: input.receivedAt,
    externalReference: input.externalReference,
    payerName: input.payerName,
    notes: input.notes,
    metadata: input.metadata,
  });
}

function createPatientCreditOperationKey(tenantId: string, patientId: string): string {
  return `patient-credit:${tenantId}:${patientId}:${crypto.randomUUID()}`;
}

export function useFinanceActions({ tenantId, patientId, refresh, rpcClient }: UseFinanceActionsOptions): UseFinanceActionsResult {
  const contextKey = tenantId && patientId ? `${tenantId}:${patientId}` : null;
  const contextRef = useRef({ tenantId: tenantId ?? null, patientId: patientId ?? null, contextKey });
  const [actionLoading, setActionLoading] = useState<FinanceActionName | null>(null);
  const [actionError, setActionError] = useState<Error | null>(null);
  const [patientCreditOperationStatus, setPatientCreditOperationStatus] = useState<PatientCreditOperationStatus>('idle');
  const [patientCreditOperationResult, setPatientCreditOperationResult] = useState<PatientCreditPaymentOperationResult | null>(null);
  const pendingPatientCreditOperations = useRef(new Map<string, PendingPatientCreditOperation>());
  const inFlightPatientCreditOperations = useRef(new Map<string, Promise<PatientCreditPaymentOperationResult>>());

  useLayoutEffect(() => {
    contextRef.current = { tenantId: tenantId ?? null, patientId: patientId ?? null, contextKey };
  }, [contextKey, patientId, tenantId]);

  useEffect(() => {
    setPatientCreditOperationStatus('idle');
    setPatientCreditOperationResult(null);
    setActionError(null);
    setActionLoading(null);
  }, [contextKey]);

  const client = useMemo(() => {
    if (rpcClient) return rpcClient;
    if (!isSupabaseConfigured) return null;
    return createFinanceRpcClient({ backend: 'supabase' });
  }, [rpcClient]);

  const requireClient = useCallback(() => {
    if (!tenantId) throw new Error('Не выбрана клиника.');
    if (!client) throw new Error('Не удалось выполнить финансовую операцию.');
    return client;
  }, [client, tenantId]);

  const runAction = useCallback(async (name: FinanceActionName, action: () => Promise<void>) => {
    setActionLoading(name);
    setActionError(null);
    try {
      await action();
      await refresh?.();
    } catch (err) {
      const parsed = isCompletedServiceDuplicate(err)
        ? new Error(COMPLETED_SERVICE_ALREADY_BILLED_REFRESHED_ERROR)
        : safeFinanceError(err);
      if (isCompletedServiceDuplicate(err)) await refresh?.();
      setActionError(parsed);
      throw parsed;
    } finally {
      setActionLoading(null);
    }
  }, [refresh]);

  const createInvoice = useCallback(async (input: CreateInvoiceActionInput = {}) => {
    await runAction('createInvoice', async () => {
      const actionClient = requireClient();
      if (!patientId) throw new Error('Пациент не выбран.');
      await actionClient.createInvoice({
        tenantId: tenantId!,
        patientId,
        currency: input.currency?.trim() || 'KZT',
        dueDate: normalizeOptionalText(input.dueDate),
        notes: normalizeOptionalText(input.notes),
        metadata: ACTION_METADATA,
      });
    });
  }, [patientId, requireClient, runAction, tenantId]);

  const addInvoiceItem = useCallback(async (input: AddInvoiceItemActionInput) => {
    await runAction('addInvoiceItem', async () => {
      const actionClient = requireClient();
      await actionClient.addInvoiceItem({
        tenantId: tenantId!,
        invoiceId: input.invoiceId,
        serviceName: input.serviceName.trim(),
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        discountAmount: input.discountAmount ?? 0,
        adjustmentAmount: input.adjustmentAmount ?? 0,
        completedServiceId: normalizeOptionalText(input.completedServiceId),
        serviceCode: normalizeOptionalText(input.serviceCode),
        toothNumber: normalizeOptionalText(input.toothNumber),
        toothSurface: normalizeOptionalText(input.toothSurface),
        notes: normalizeOptionalText(input.notes),
        metadata: ACTION_METADATA,
      });
    });
  }, [requireClient, runAction, tenantId]);

  const issueInvoice = useCallback(async (invoiceId: string) => {
    await runAction('issueInvoice', async () => {
      await requireClient().issueInvoice({ tenantId: tenantId!, invoiceId });
    });
  }, [requireClient, runAction, tenantId]);

  const voidInvoice = useCallback(async (invoiceId: string, reason: string) => {
    await runAction('voidInvoice', async () => {
      await requireClient().voidInvoice({ tenantId: tenantId!, invoiceId, reason: reason.trim() });
    });
  }, [requireClient, runAction, tenantId]);

  const recordPayment = useCallback((input: RecordPaymentActionInput): Promise<PatientCreditPaymentOperationResult> => {
    if (!tenantId) return Promise.reject(new Error('Клиника не выбрана.'));
    if (!patientId) return Promise.reject(new Error('Пациент не выбран.'));
    if (!client) return Promise.reject(new Error('Не удалось принять предоплату. Проверьте текущее состояние операции.'));

    const operationScope = `${tenantId}:${patientId}`;
    const normalizedInput = {
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      currency: input.currency?.trim() || 'KZT',
      receivedAt: normalizeOptionalText(input.receivedAt),
      externalReference: normalizeOptionalText(input.externalReference),
      payerName: normalizeOptionalText(input.payerName),
      notes: normalizeOptionalText(input.notes),
      metadata: ACTION_METADATA,
    } satisfies Omit<RecordPaymentInput, 'tenantId' | 'patientId' | 'idempotencyKey'>;
    const fingerprint = patientCreditFingerprint(normalizedInput);
    const pending = pendingPatientCreditOperations.current.get(operationScope);

    if (pending && pending.fingerprint !== fingerprint) {
      const conflict = new FinanceRpcClientError({
        operation: 'recordPayment',
        category: 'operation_uncertain',
        message: PATIENT_CREDIT_UNCERTAIN_MESSAGE,
      });
      if (contextRef.current.contextKey === operationScope) {
        setPatientCreditOperationStatus('uncertain');
        setActionError(conflict);
      }
      return Promise.reject(conflict);
    }

    const existingInFlight = inFlightPatientCreditOperations.current.get(operationScope);
    if (existingInFlight) return existingInFlight;

    const idempotencyKey = pending?.idempotencyKey ?? createPatientCreditOperationKey(tenantId, patientId);
    pendingPatientCreditOperations.current.set(operationScope, { idempotencyKey, fingerprint });
    const request: RecordPaymentInput = {
      tenantId,
      patientId,
      idempotencyKey,
      ...normalizedInput,
    };

    const isCurrentContext = () => contextRef.current.contextKey === operationScope;
    const confirmSuccess = async (result: PatientCreditPaymentOperationResult) => {
      if (!result.payment || result.tenantId !== tenantId || result.patientId !== patientId) {
        throw new FinanceRpcClientError({
          operation: 'recordPayment',
          category: 'stale_patient',
          message: 'Операция относится к другому пациенту. Данные обновлены.',
        });
      }
      pendingPatientCreditOperations.current.delete(operationScope);
      if (isCurrentContext()) {
        setPatientCreditOperationResult(result);
        setPatientCreditOperationStatus('succeeded');
        setActionError(null);
        try {
          await refresh?.();
        } catch {
          // The payment is committed and the returned capacity remains authoritative for the success view.
        }
      }
      return result;
    };

    const operationPromise = (async () => {
      if (isCurrentContext()) {
        setActionLoading('recordPayment');
        setActionError(null);
        setPatientCreditOperationResult(null);
        setPatientCreditOperationStatus('submitting');
      }

      try {
        try {
          return await confirmSuccess(await client.recordPayment(request));
        } catch (error) {
          if (!(error instanceof FinanceRpcClientError) || error.category !== 'operation_uncertain') throw error;
        }

        if (isCurrentContext()) setPatientCreditOperationStatus('reconciling');
        try {
          const recovered = await client.getPatientCreditPaymentOperation({ tenantId, patientId, idempotencyKey });
          if (recovered.status !== 'not_found') return await confirmSuccess(recovered);
          return await confirmSuccess(await client.recordPayment(request));
        } catch (error) {
          if (error instanceof FinanceRpcClientError && error.category === 'operation_uncertain') {
            const unresolved = safePatientCreditError(error);
            if (isCurrentContext()) {
              setPatientCreditOperationStatus('uncertain');
              setActionError(unresolved);
            }
            throw unresolved;
          }
          throw error;
        }
      } catch (error) {
        const safeError = safePatientCreditError(error);
        if (safeError.category !== 'operation_uncertain') pendingPatientCreditOperations.current.delete(operationScope);
        if (isCurrentContext()) {
          setPatientCreditOperationStatus(safeError.category === 'operation_uncertain' ? 'uncertain' : 'failed');
          setActionError(safeError);
        }
        throw safeError;
      } finally {
        inFlightPatientCreditOperations.current.delete(operationScope);
        if (isCurrentContext()) setActionLoading(null);
      }
    })();

    inFlightPatientCreditOperations.current.set(operationScope, operationPromise);
    return operationPromise;
  }, [client, patientId, refresh, tenantId]);

  const allocatePayment = useCallback(async (input: AllocatePaymentActionInput) => {
    await runAction('allocatePayment', async () => {
      await requireClient().allocatePayment({
        tenantId: tenantId!,
        paymentId: input.paymentId,
        amount: input.amount,
        invoiceId: normalizeOptionalText(input.invoiceId),
        invoiceItemId: normalizeOptionalText(input.invoiceItemId),
        metadata: ACTION_METADATA,
      });
    });
  }, [requireClient, runAction, tenantId]);

  const voidPaymentAllocation = useCallback(async (allocationId: string, reason: string) => {
    await runAction('voidPaymentAllocation', async () => {
      await requireClient().voidPaymentAllocation({ tenantId: tenantId!, allocationId, reason: reason.trim() });
    });
  }, [requireClient, runAction, tenantId]);

  const voidPayment = useCallback(async (paymentId: string, reason: string) => {
    await runAction('voidPayment', async () => {
      await requireClient().voidPayment({ tenantId: tenantId!, paymentId, reason: reason.trim() });
    });
  }, [requireClient, runAction, tenantId]);

  const resetPatientCreditOperation = useCallback(() => {
    setPatientCreditOperationStatus('idle');
    setPatientCreditOperationResult(null);
    setActionError(null);
  }, []);

  return {
    actionLoading,
    loading: actionLoading !== null,
    actionError,
    error: actionError,
    patientCreditOperationStatus,
    patientCreditOperationResult,
    createInvoice,
    addInvoiceItem,
    issueInvoice,
    voidInvoice,
    recordPayment,
    allocatePayment,
    voidPaymentAllocation,
    voidPayment,
    clearError: () => setActionError(null),
    resetPatientCreditOperation,
  };
}

export {
  COMPLETED_SERVICE_ALREADY_BILLED_ERROR,
  COMPLETED_SERVICE_ALREADY_BILLED_REFRESHED_ERROR,
  PATIENT_CREDIT_UNCERTAIN_MESSAGE,
};
