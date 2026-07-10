/* eslint-disable react-hooks/set-state-in-effect -- payment identity changes must clear stale refund action state immediately */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { getRefundCapabilities } from '../../components/finance/financeAdjustmentPermissions';
import type { FinanceUserRole } from '../../components/finance/financePermissions';
import {
  createFinanceRepository,
  type FinanceRepository,
  type PaymentRefundability,
  type Refund,
  type RefundMethod,
} from '../repositories/FinanceRepository';
import { createFinanceRpcClient, type FinanceRpcClient } from '../repositories/FinanceRpcClient';
import { useAsyncQuery } from './useAsyncQuery';

export type FinanceLifecycleActionState = 'idle' | 'submitting' | 'succeeded' | 'failed' | 'retryable' | 'stale_context';
export type RefundActionName = 'request' | 'approve' | 'complete' | 'reject' | 'void';

export interface RefundRequestValues {
  amount: number;
  refundMethod: RefundMethod;
  reason: string;
}

export interface UsePaymentRefundFlowOptions {
  tenantId?: string | null;
  paymentId?: string | null;
  role?: FinanceUserRole;
  repository?: FinanceRepository;
  rpcClient?: FinanceRpcClient;
  onChanged?: () => Promise<void> | void;
}

interface RefundFlowData {
  refundability: PaymentRefundability | null;
  refunds: Refund[];
}

const EMPTY_DATA: RefundFlowData = { refundability: null, refunds: [] };
const MAX_REASON_LENGTH = 1000;

function createIdempotencyKey(tenantId: string, paymentId: string) {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `refund-request:${tenantId}:${paymentId}:${suffix}`;
}

function normalizeReason(value: string) {
  const reason = value.trim();
  if (!reason) throw new Error('Укажите причину возврата.');
  if (reason.length > MAX_REASON_LENGTH) throw new Error('Причина возврата слишком длинная.');
  return reason;
}

function safeRefundError(error: unknown) {
  const lower = error instanceof Error ? error.message.toLowerCase() : '';
  if (lower.includes('permission') || lower.includes('denied') || lower.includes('role')) return 'Недостаточно прав.';
  if (lower.includes('allocation') || lower.includes('allocated')) return 'Средства распределены по счетам. Сначала отмените распределение.';
  if (lower.includes('amount') || lower.includes('available') || lower.includes('refundable')) return 'Сумма превышает доступную.';
  if (lower.includes('status') || lower.includes('already') || lower.includes('processed')) return 'Заявка уже была обработана.';
  return 'Не удалось выполнить операцию возврата.';
}

export function usePaymentRefundFlow({
  tenantId,
  paymentId,
  role,
  repository,
  rpcClient,
  onChanged,
}: UsePaymentRefundFlowOptions) {
  const capabilities = useMemo(() => getRefundCapabilities(role), [role]);
  const contextKey = tenantId && paymentId ? `${tenantId}:${paymentId}` : null;
  const contextRef = useRef(contextKey);
  const requestKeyRef = useRef<{ signature: string; key: string } | null>(null);
  const inFlightRef = useRef<Promise<unknown> | null>(null);
  const [actionState, setActionState] = useState<FinanceLifecycleActionState>('idle');
  const [actionName, setActionName] = useState<RefundActionName | null>(null);
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

  const queryFn = useCallback(async (): Promise<RefundFlowData> => {
    if (!tenantId || !paymentId || !financeRepository) return EMPTY_DATA;
    try {
      const [refundability, refunds] = await Promise.all([
        financeRepository.getPaymentRefundability({ tenantId, paymentId }),
        financeRepository.listRefunds({ tenantId, paymentId, includeArchived: true, limit: 100 }),
      ]);
      return { refundability, refunds };
    } catch {
      throw new Error('Не удалось загрузить данные возврата.');
    }
  }, [financeRepository, paymentId, tenantId]);

  const query = useAsyncQuery<RefundFlowData>({
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
    name: RefundActionName,
    mutation: () => Promise<T>,
    successMessage: string,
  ): Promise<T | undefined> => {
    if (!contextKey || !tenantId || !paymentId || !client) {
      setActionState('failed');
      setActionMessage('Не удалось выполнить операцию возврата.');
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
        setActionMessage(safeRefundError(error));
      }
      return undefined;
    } finally {
      if (inFlightRef.current === promise) inFlightRef.current = null;
      if (contextRef.current === capturedContext) setActionName(null);
    }
  }, [client, contextKey, onChanged, paymentId, query, tenantId]);

  const requestRefund = useCallback(async (values: RefundRequestValues) => {
    if (!tenantId || !paymentId || !client) return undefined;
    if (!capabilities.canRequest) {
      setActionState('failed');
      setActionMessage('Недостаточно прав.');
      return undefined;
    }
    const refundability = query.data.refundability;
    if (!Number.isFinite(values.amount) || values.amount <= 0) {
      setActionState('failed');
      setActionMessage('Сумма должна быть больше 0.');
      return undefined;
    }
    if (!refundability || values.amount > refundability.refundableAmount) {
      setActionState('failed');
      setActionMessage('Сумма превышает доступную.');
      return undefined;
    }
    let reason: string;
    try { reason = normalizeReason(values.reason); } catch (error) {
      setActionState('failed');
      setActionMessage(error instanceof Error ? error.message : 'Укажите причину возврата.');
      return undefined;
    }
    const signature = JSON.stringify([values.amount, values.refundMethod, reason]);
    if (!requestKeyRef.current || requestKeyRef.current.signature !== signature) {
      requestKeyRef.current = { signature, key: createIdempotencyKey(tenantId, paymentId) };
    }
    const result = await runAction(
      'request',
      () => client.requestRefund({
        tenantId,
        paymentId,
        amount: values.amount,
        refundMethod: values.refundMethod,
        reason,
        idempotencyKey: requestKeyRef.current?.key,
        metadata: { source: 'patient_finance_ui' },
      }),
      'Заявка на возврат создана.',
    );
    if (result) requestKeyRef.current = null;
    return result;
  }, [capabilities.canRequest, client, paymentId, query.data.refundability, runAction, tenantId]);

  const approveRefund = useCallback((refundId: string) => {
    if (!client || !tenantId || !capabilities.canApprove) return Promise.resolve(undefined);
    return runAction('approve', () => client.approveRefund({ tenantId, refundId }), 'Возврат одобрен. Деньги ещё не отмечены как возвращённые.');
  }, [capabilities.canApprove, client, runAction, tenantId]);

  const completeRefund = useCallback((refundId: string, externalReference?: string | null) => {
    if (!client || !tenantId || !capabilities.canComplete) return Promise.resolve(undefined);
    return runAction('complete', () => client.completeRefund({ tenantId, refundId, externalReference: externalReference?.trim() || null, metadata: { source: 'patient_finance_ui' } }), 'Возврат завершён.');
  }, [capabilities.canComplete, client, runAction, tenantId]);

  const rejectRefund = useCallback((refundId: string, reason: string) => {
    if (!client || !tenantId || !capabilities.canReject) return Promise.resolve(undefined);
    let normalized: string;
    try { normalized = normalizeReason(reason); } catch (error) {
      setActionState('failed');
      setActionMessage(error instanceof Error ? error.message : 'Укажите причину отклонения.');
      return Promise.resolve(undefined);
    }
    return runAction('reject', () => client.rejectRefund({ tenantId, refundId, reason: normalized }), 'Заявка на возврат отклонена.');
  }, [capabilities.canReject, client, runAction, tenantId]);

  const voidRefund = useCallback((refundId: string, reason: string) => {
    if (!client || !tenantId || !capabilities.canVoid) return Promise.resolve(undefined);
    let normalized: string;
    try { normalized = normalizeReason(reason); } catch (error) {
      setActionState('failed');
      setActionMessage(error instanceof Error ? error.message : 'Укажите причину отмены.');
      return Promise.resolve(undefined);
    }
    return runAction('void', () => client.voidRefund({ tenantId, refundId, reason: normalized }), 'Заявка на возврат отменена.');
  }, [capabilities.canVoid, client, runAction, tenantId]);

  return {
    refundability: query.data.refundability,
    refunds: query.data.refunds,
    loading: query.isLoading,
    error: query.error ? new Error('Не удалось загрузить данные возврата.') : null,
    actionLoading: actionState === 'submitting' || actionState === 'retryable',
    actionName,
    actionState,
    actionMessage,
    requestRefund,
    approveRefund,
    completeRefund,
    rejectRefund,
    voidRefund,
    refresh,
    capabilities,
  };
}
