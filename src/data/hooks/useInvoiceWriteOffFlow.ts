/* eslint-disable react-hooks/set-state-in-effect -- invoice identity changes must clear stale write-off action state immediately */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { getWriteOffCapabilities } from '../../components/finance/financeAdjustmentPermissions';
import type { FinanceUserRole } from '../../components/finance/financePermissions';
import {
  createFinanceRepository,
  type FinanceRepository,
  type FinancialAdjustment,
  type InvoiceWriteOffEligibility,
} from '../repositories/FinanceRepository';
import { createFinanceRpcClient, type FinanceRpcClient } from '../repositories/FinanceRpcClient';
import { useAsyncQuery } from './useAsyncQuery';
import type { FinanceLifecycleActionState } from './usePaymentRefundFlow';

export type WriteOffActionName = 'request' | 'approve' | 'reject' | 'void';

export interface WriteOffRequestValues {
  amount: number;
  reason: string;
}

export interface UseInvoiceWriteOffFlowOptions {
  tenantId?: string | null;
  invoiceId?: string | null;
  role?: FinanceUserRole;
  repository?: FinanceRepository;
  rpcClient?: FinanceRpcClient;
  onChanged?: () => Promise<void> | void;
}

interface WriteOffFlowData {
  eligibility: InvoiceWriteOffEligibility | null;
  writeOffs: FinancialAdjustment[];
}

const EMPTY_DATA: WriteOffFlowData = { eligibility: null, writeOffs: [] };
const MAX_REASON_LENGTH = 1000;

function createIdempotencyKey(tenantId: string, invoiceId: string) {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `writeoff-request:${tenantId}:${invoiceId}:${suffix}`;
}

function normalizeReason(value: string) {
  const reason = value.trim();
  if (!reason) throw new Error('Укажите причину списания.');
  if (reason.length > MAX_REASON_LENGTH) throw new Error('Причина списания слишком длинная.');
  return reason;
}

function safeWriteOffError(error: unknown) {
  const lower = error instanceof Error ? error.message.toLowerCase() : '';
  if (lower.includes('permission') || lower.includes('denied') || lower.includes('role')) return 'Недостаточно прав.';
  if (lower.includes('amount') || lower.includes('available') || lower.includes('balance')) return 'Сумма превышает доступную.';
  if (lower.includes('status') || lower.includes('already') || lower.includes('processed')) return 'Заявка уже была обработана.';
  if (lower.includes('invoice')) return 'Счёт больше не доступен для списания.';
  return 'Не удалось выполнить операцию списания.';
}

export function useInvoiceWriteOffFlow({
  tenantId,
  invoiceId,
  role,
  repository,
  rpcClient,
  onChanged,
}: UseInvoiceWriteOffFlowOptions) {
  const capabilities = useMemo(() => getWriteOffCapabilities(role), [role]);
  const contextKey = tenantId && invoiceId ? `${tenantId}:${invoiceId}` : null;
  const contextRef = useRef(contextKey);
  const requestKeyRef = useRef<{ signature: string; key: string } | null>(null);
  const inFlightRef = useRef<Promise<unknown> | null>(null);
  const [actionState, setActionState] = useState<FinanceLifecycleActionState>('idle');
  const [actionName, setActionName] = useState<WriteOffActionName | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  useLayoutEffect(() => {
    contextRef.current = contextKey;
  }, [contextKey]);

  useEffect(() => {
    setActionState('idle');
    setActionName(null);
    setActionMessage(null);
    requestKeyRef.current = null;
    inFlightRef.current = null;
  }, [contextKey]);

  const queryFn = useCallback(async (): Promise<WriteOffFlowData> => {
    if (!tenantId || !invoiceId || !financeRepository) return EMPTY_DATA;
    try {
      const [eligibility, writeOffs] = await Promise.all([
        financeRepository.getInvoiceWriteOffEligibility({ tenantId, invoiceId }),
        financeRepository.listFinancialAdjustments({
          tenantId,
          invoiceId,
          adjustmentType: 'write_off',
          includeArchived: true,
          limit: 100,
        }),
      ]);
      return { eligibility, writeOffs };
    } catch {
      throw new Error('Не удалось загрузить данные списания.');
    }
  }, [financeRepository, invoiceId, tenantId]);

  const query = useAsyncQuery<WriteOffFlowData>({
    queryFn,
    initialData: EMPTY_DATA,
    enabled: Boolean(contextKey && capabilities.canView),
    queryKey: contextKey,
    resetOnDisable: true,
  });

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const runAction = useCallback(async <T,>(
    name: WriteOffActionName,
    mutation: () => Promise<T>,
    successMessage: string,
  ): Promise<T | undefined> => {
    if (!contextKey || !tenantId || !invoiceId || !client) {
      setActionState('failed');
      setActionMessage('Не удалось выполнить операцию списания.');
      return undefined;
    }
    if (inFlightRef.current) return inFlightRef.current as Promise<T>;
    const capturedContext = contextKey;
    setActionState('submitting');
    setActionName(name);
    setActionMessage(null);
    const promise = mutation();
    inFlightRef.current = promise;
    try {
      const result = await promise;
      if (contextRef.current !== capturedContext) return result;
      await query.refetch();
      await onChanged?.();
      if (contextRef.current === capturedContext) {
        setActionState('succeeded');
        setActionMessage(successMessage);
      }
      return result;
    } catch (error) {
      if (contextRef.current !== capturedContext) return undefined;
      setActionState('retryable');
      setActionMessage('Проверяем актуальный статус операции…');
      await query.refetch();
      if (contextRef.current === capturedContext) {
        setActionState('failed');
        setActionMessage(safeWriteOffError(error));
      }
      return undefined;
    } finally {
      if (inFlightRef.current === promise) inFlightRef.current = null;
      if (contextRef.current === capturedContext) setActionName(null);
    }
  }, [client, contextKey, invoiceId, onChanged, query, tenantId]);

  const requestWriteOff = useCallback(async (values: WriteOffRequestValues) => {
    if (!tenantId || !invoiceId || !client) return undefined;
    if (!capabilities.canRequest) {
      setActionState('failed');
      setActionMessage('Недостаточно прав.');
      return undefined;
    }
    const eligibility = query.data.eligibility;
    if (!Number.isFinite(values.amount) || values.amount <= 0) {
      setActionState('failed');
      setActionMessage('Сумма должна быть больше 0.');
      return undefined;
    }
    if (!eligibility || values.amount > eligibility.availableWriteOffAmount) {
      setActionState('failed');
      setActionMessage('Сумма превышает доступную.');
      return undefined;
    }
    let reason: string;
    try { reason = normalizeReason(values.reason); } catch (error) {
      setActionState('failed');
      setActionMessage(error instanceof Error ? error.message : 'Укажите причину списания.');
      return undefined;
    }
    const signature = JSON.stringify([values.amount, reason]);
    if (!requestKeyRef.current || requestKeyRef.current.signature !== signature) {
      requestKeyRef.current = { signature, key: createIdempotencyKey(tenantId, invoiceId) };
    }
    const result = await runAction(
      'request',
      () => client.requestInvoiceWriteOff({
        tenantId,
        invoiceId,
        amount: values.amount,
        reason,
        idempotencyKey: requestKeyRef.current?.key,
        metadata: { source: 'patient_finance_ui' },
      }),
      'Заявка на списание создана.',
    );
    if (result) requestKeyRef.current = null;
    return result;
  }, [capabilities.canRequest, client, invoiceId, query.data.eligibility, runAction, tenantId]);

  const approveWriteOff = useCallback((adjustmentId: string) => {
    if (!client || !tenantId || !capabilities.canApprove) return Promise.resolve(undefined);
    return runAction('approve', () => client.approveInvoiceWriteOff({ tenantId, adjustmentId }), 'Списание одобрено.');
  }, [capabilities.canApprove, client, runAction, tenantId]);

  const rejectWriteOff = useCallback((adjustmentId: string, reason: string) => {
    if (!client || !tenantId || !capabilities.canReject) return Promise.resolve(undefined);
    let normalized: string;
    try { normalized = normalizeReason(reason); } catch (error) {
      setActionState('failed');
      setActionMessage(error instanceof Error ? error.message : 'Укажите причину отклонения.');
      return Promise.resolve(undefined);
    }
    return runAction('reject', () => client.rejectInvoiceWriteOff({ tenantId, adjustmentId, reason: normalized }), 'Заявка на списание отклонена.');
  }, [capabilities.canReject, client, runAction, tenantId]);

  const voidWriteOff = useCallback((adjustmentId: string, reason: string) => {
    if (!client || !tenantId || !capabilities.canVoid) return Promise.resolve(undefined);
    let normalized: string;
    try { normalized = normalizeReason(reason); } catch (error) {
      setActionState('failed');
      setActionMessage(error instanceof Error ? error.message : 'Укажите причину отмены.');
      return Promise.resolve(undefined);
    }
    return runAction('void', () => client.voidInvoiceWriteOff({ tenantId, adjustmentId, reason: normalized }), 'Списание отменено. Задолженность пересчитана.');
  }, [capabilities.canVoid, client, runAction, tenantId]);

  return {
    eligibility: query.data.eligibility,
    writeOffs: query.data.writeOffs,
    loading: query.isLoading,
    error: query.error ? new Error('Не удалось загрузить данные списания.') : null,
    actionLoading: actionState === 'submitting' || actionState === 'retryable',
    actionName,
    actionState,
    actionMessage,
    requestWriteOff,
    approveWriteOff,
    rejectWriteOff,
    voidWriteOff,
    refresh,
    capabilities,
  };
}
