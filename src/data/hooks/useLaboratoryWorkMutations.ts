import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLaboratoryWorkRepository } from './useLaboratoryWorkRepository';
import {
  LaboratoryWorkMutationClientError,
  classifyLaboratoryMutationError,
  createLaboratoryWorkMutationRpcClient,
  type LaboratoryMutationOperation,
  type LaboratoryWorkMutationRpcClient,
  type LaboratoryWorkOrderDesiredState,
  type CreateLaboratoryWorkOrderAtomicInput,
  type UpdateLaboratoryWorkOrderAtomicInput,
  type CompleteLaboratoryWorkOrderAtomicInput,
  type ReopenLaboratoryWorkOrderAtomicInput,
} from '../repositories/LaboratoryWorkMutationRpcClient';
import type { LaboratoryWorkOrderRecord } from '../repositories/LaboratoryWorkRepository';

export interface CreateLaboratoryWorkOrderActionInput extends LaboratoryWorkOrderDesiredState {
  patientId: string;
}

export interface UpdateLaboratoryWorkOrderActionInput extends LaboratoryWorkOrderDesiredState {
  orderId: string;
  expectedVersion: number;
}

export interface CompleteLaboratoryWorkOrderActionInput {
  orderId: string;
  expectedVersion: number;
}

export interface ReopenLaboratoryWorkOrderActionInput extends CompleteLaboratoryWorkOrderActionInput {
  reason: string;
}

export interface UseLaboratoryWorkMutationsOptions {
  refresh?: () => Promise<void> | void;
  rpcClient?: LaboratoryWorkMutationRpcClient;
  identityFactory?: () => string;
}

export interface UseLaboratoryWorkMutationsResult {
  available: boolean;
  loading: boolean;
  actionLoading: LaboratoryMutationOperation | null;
  error: LaboratoryWorkMutationClientError | null;
  refreshWarning: string | null;
  pendingRetryAction: LaboratoryMutationOperation | null;
  createOrder: (input: CreateLaboratoryWorkOrderActionInput) => Promise<LaboratoryWorkOrderRecord>;
  updateOrder: (input: UpdateLaboratoryWorkOrderActionInput) => Promise<LaboratoryWorkOrderRecord>;
  completeOrder: (input: CompleteLaboratoryWorkOrderActionInput) => Promise<LaboratoryWorkOrderRecord>;
  reopenOrder: (input: ReopenLaboratoryWorkOrderActionInput) => Promise<LaboratoryWorkOrderRecord>;
  retryPendingMutation: () => Promise<LaboratoryWorkOrderRecord>;
  clearError: () => void;
  clearRefreshWarning: () => void;
}

type CapturedMutation =
  | { action: 'create'; contextKey: string; input: CreateLaboratoryWorkOrderAtomicInput }
  | { action: 'update'; contextKey: string; input: UpdateLaboratoryWorkOrderAtomicInput }
  | { action: 'complete'; contextKey: string; input: CompleteLaboratoryWorkOrderAtomicInput }
  | { action: 'reopen'; contextKey: string; input: ReopenLaboratoryWorkOrderAtomicInput };

const UNAVAILABLE_MESSAGE = 'Изменение лабораторных работ доступно только в активной клинике с Supabase.';
const IN_FLIGHT_MESSAGE = 'Другая операция с лабораторной работой уже выполняется.';
const NO_RETRY_MESSAGE = 'Нет операции, которую можно безопасно повторить.';

function defaultIdentityFactory(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('Secure UUID generator is unavailable.');
  }
  return crypto.randomUUID();
}

function localValidationError(operation: LaboratoryMutationOperation, message: string) {
  return new LaboratoryWorkMutationClientError({ operation, category: 'validation', message });
}

function requestId(action: LaboratoryMutationOperation, identity: string) {
  return `laboratory-${action}:${identity}`;
}

export function useLaboratoryWorkMutations(
  options: UseLaboratoryWorkMutationsOptions = {},
): UseLaboratoryWorkMutationsResult {
  const selection = useLaboratoryWorkRepository();
  const identityFactory = options.identityFactory ?? defaultIdentityFactory;
  const injectedRpcClient = options.rpcClient;
  const refresh = options.refresh;
  const contextKey = selection.backend === 'supabase' && selection.ready && selection.tenantId && selection.userId
    ? `${selection.backend}:${selection.tenantId}:${selection.userId}`
    : null;
  const available = Boolean(contextKey);

  const client = useMemo(() => {
    if (!available || selection.backend !== 'supabase') return null;
    if (injectedRpcClient) return injectedRpcClient;
    return createLaboratoryWorkMutationRpcClient({ backend: 'supabase' });
  }, [available, injectedRpcClient, selection.backend]);

  const contextRef = useRef<string | null>(contextKey);
  const pendingRef = useRef<CapturedMutation | null>(null);
  const inFlightRef = useRef<Promise<LaboratoryWorkOrderRecord> | null>(null);
  const [actionLoading, setActionLoading] = useState<LaboratoryMutationOperation | null>(null);
  const [error, setError] = useState<LaboratoryWorkMutationClientError | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [pendingRetryAction, setPendingRetryAction] = useState<LaboratoryMutationOperation | null>(null);
  const [stateContextKey, setStateContextKey] = useState<string | null>(contextKey);

  useLayoutEffect(() => {
    contextRef.current = contextKey;
  }, [contextKey]);

  const tryRefresh = useCallback(async (message: string) => {
    try {
      await refresh?.();
      setRefreshWarning(null);
    } catch {
      setRefreshWarning(message);
    }
  }, [refresh]);

  const requireContext = useCallback((operation: LaboratoryMutationOperation) => {
    if (!contextKey || !selection.tenantId || !selection.userId || !client) {
      throw localValidationError(operation, UNAVAILABLE_MESSAGE);
    }
    return { contextKey, tenantId: selection.tenantId, client };
  }, [client, contextKey, selection.tenantId, selection.userId]);

  const invokeCaptured = useCallback(async (captured: CapturedMutation): Promise<LaboratoryWorkOrderRecord> => {
    if (inFlightRef.current) {
      throw localValidationError(captured.action, IN_FLIGHT_MESSAGE);
    }
    if (!client || contextRef.current !== captured.contextKey) {
      throw localValidationError(captured.action, UNAVAILABLE_MESSAGE);
    }

    setStateContextKey(captured.contextKey);
    setActionLoading(captured.action);
    setError(null);
    setRefreshWarning(null);

    const operationPromise = (async () => {
      try {
        let result: LaboratoryWorkOrderRecord;
        if (captured.action === 'create') result = await client.createOrder(captured.input);
        else if (captured.action === 'update') result = await client.updateOrder(captured.input);
        else if (captured.action === 'complete') result = await client.completeOrder(captured.input);
        else result = await client.reopenOrder(captured.input);

        pendingRef.current = null;
        if (contextRef.current === captured.contextKey) {
          setPendingRetryAction(null);
          await tryRefresh('Изменение сохранено, но свежие данные не удалось загрузить. Обновите страницу.');
        }
        return result;
      } catch (rawError) {
        const parsed = classifyLaboratoryMutationError(rawError, captured.action);
        const sameContext = contextRef.current === captured.contextKey;

        if (parsed.category === 'operation_uncertain' && sameContext) {
          pendingRef.current = captured;
          setPendingRetryAction(captured.action);
        } else if (sameContext) {
          pendingRef.current = null;
          setPendingRetryAction(null);
        }

        if (sameContext && ['stale', 'conflict', 'not_found', 'invalid_state'].includes(parsed.category)) {
          await tryRefresh('Операция отклонена, но актуальные данные не удалось загрузить. Обновите страницу.');
        }
        if (sameContext) setError(parsed);
        throw parsed;
      } finally {
        if (contextRef.current === captured.contextKey) setActionLoading(null);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = operationPromise;
    return operationPromise;
  }, [client, tryRefresh]);

  const nextIdentity = useCallback((operation: LaboratoryMutationOperation) => {
    let identity: string;
    try {
      identity = identityFactory();
    } catch {
      throw localValidationError(operation, 'Не удалось создать безопасный идентификатор лабораторной операции.');
    }
    if (!identity.trim()) {
      throw localValidationError(operation, 'Не удалось создать безопасный идентификатор лабораторной операции.');
    }
    return identity;
  }, [identityFactory]);

  const createOrder = useCallback(async (input: CreateLaboratoryWorkOrderActionInput) => {
    const context = requireContext('create');
    const identity = nextIdentity('create');

    return invokeCaptured({
      action: 'create',
      contextKey: context.contextKey,
      input: {
        ...input,
        tenantId: context.tenantId,
        orderId: identity,
        requestId: requestId('create', identity),
      },
    });
  }, [invokeCaptured, nextIdentity, requireContext]);

  const updateOrder = useCallback(async (input: UpdateLaboratoryWorkOrderActionInput) => {
    const context = requireContext('update');
    const identity = nextIdentity('update');
    return invokeCaptured({
      action: 'update',
      contextKey: context.contextKey,
      input: {
        ...input,
        tenantId: context.tenantId,
        requestId: requestId('update', identity),
      },
    });
  }, [invokeCaptured, nextIdentity, requireContext]);

  const completeOrder = useCallback(async (input: CompleteLaboratoryWorkOrderActionInput) => {
    const context = requireContext('complete');
    const identity = nextIdentity('complete');
    return invokeCaptured({
      action: 'complete',
      contextKey: context.contextKey,
      input: {
        ...input,
        tenantId: context.tenantId,
        requestId: requestId('complete', identity),
      },
    });
  }, [invokeCaptured, nextIdentity, requireContext]);

  const reopenOrder = useCallback(async (input: ReopenLaboratoryWorkOrderActionInput) => {
    const context = requireContext('reopen');
    const identity = nextIdentity('reopen');
    return invokeCaptured({
      action: 'reopen',
      contextKey: context.contextKey,
      input: {
        ...input,
        tenantId: context.tenantId,
        requestId: requestId('reopen', identity),
      },
    });
  }, [invokeCaptured, nextIdentity, requireContext]);

  const retryPendingMutation = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending || pending.contextKey !== contextKey) {
      throw localValidationError(pending?.action ?? 'create', NO_RETRY_MESSAGE);
    }
    requireContext(pending.action);
    return invokeCaptured(pending);
  }, [contextKey, invokeCaptured, requireContext]);

  const visibleState = stateContextKey === contextKey;

  return {
    available,
    loading: visibleState && actionLoading !== null,
    actionLoading: visibleState ? actionLoading : null,
    error: visibleState ? error : null,
    refreshWarning: visibleState ? refreshWarning : null,
    pendingRetryAction: visibleState ? pendingRetryAction : null,
    createOrder,
    updateOrder,
    completeOrder,
    reopenOrder,
    retryPendingMutation,
    clearError: () => setError(null),
    clearRefreshWarning: () => setRefreshWarning(null),
  };
}
