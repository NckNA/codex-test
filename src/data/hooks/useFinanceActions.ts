import { useCallback, useMemo, useState } from 'react';
import { createFinanceRpcClient, type FinanceRpcClient } from '../repositories/FinanceRpcClient';
import type { PaymentMethod } from '../repositories/FinanceRepository';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export type FinanceActionName = 'createInvoice' | 'addInvoiceItem' | 'issueInvoice' | 'voidInvoice' | 'recordPayment' | 'allocatePayment' | 'voidPaymentAllocation' | 'voidPayment';

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
  createInvoice: (input?: CreateInvoiceActionInput) => Promise<void>;
  addInvoiceItem: (input: AddInvoiceItemActionInput) => Promise<void>;
  issueInvoice: (invoiceId: string) => Promise<void>;
  voidInvoice: (invoiceId: string, reason: string) => Promise<void>;
  recordPayment: (input: RecordPaymentActionInput) => Promise<void>;
  allocatePayment: (input: AllocatePaymentActionInput) => Promise<void>;
  voidPaymentAllocation: (allocationId: string, reason: string) => Promise<void>;
  voidPayment: (paymentId: string, reason: string) => Promise<void>;
  clearError: () => void;
}

const ACTION_METADATA = { source: 'patient_finance_ui' };

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

export function useFinanceActions({ tenantId, patientId, refresh, rpcClient }: UseFinanceActionsOptions): UseFinanceActionsResult {
  const [actionLoading, setActionLoading] = useState<FinanceActionName | null>(null);
  const [actionError, setActionError] = useState<Error | null>(null);

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
      const parsed = safeFinanceError(err);
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

  const recordPayment = useCallback(async (input: RecordPaymentActionInput) => {
    await runAction('recordPayment', async () => {
      const actionClient = requireClient();
      if (!patientId) throw new Error('Пациент не выбран.');
      await actionClient.recordPayment({
        tenantId: tenantId!,
        patientId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        currency: input.currency?.trim() || 'KZT',
        receivedAt: normalizeOptionalText(input.receivedAt),
        externalReference: normalizeOptionalText(input.externalReference),
        payerName: normalizeOptionalText(input.payerName),
        notes: normalizeOptionalText(input.notes),
        metadata: ACTION_METADATA,
      });
    });
  }, [patientId, requireClient, runAction, tenantId]);

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

  return {
    actionLoading,
    loading: actionLoading !== null,
    actionError,
    error: actionError,
    createInvoice,
    addInvoiceItem,
    issueInvoice,
    voidInvoice,
    recordPayment,
    allocatePayment,
    voidPaymentAllocation,
    voidPayment,
    clearError: () => setActionError(null),
  };
}
