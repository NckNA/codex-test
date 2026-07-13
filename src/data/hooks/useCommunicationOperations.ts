import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import type { AppointmentReminderQueueItem } from '../../types';
import type {
  CommunicationAdapterCode,
  CommunicationChannel,
  CommunicationSimulationScenario,
} from '../../domain/communications/CommunicationCommand';
import {
  CommunicationOrchestrationRepositoryError,
  createCommunicationOrchestrationRepository,
  type CommunicationOperation,
  type CommunicationOperationResult,
  type CommunicationOrchestrationRepository,
  type CommunicationRoute,
} from '../repositories/CommunicationOrchestrationRepository';

const READ_ROLES = new Set(['clinic_owner', 'clinic_admin', 'registrar']);
const MANAGE_ROLES = new Set(['clinic_owner', 'clinic_admin']);

const operationKey = (kind: string, entityId: string): string => {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `communication-${kind}-${entityId}-${id}`;
};

const isDefinitiveFailure = (error: unknown): boolean => (
  error instanceof CommunicationOrchestrationRepositoryError
  && error.code !== 'operation_failed'
);

export interface UseCommunicationOperationsResult {
  routes: CommunicationRoute[];
  operations: CommunicationOperation[];
  loading: boolean;
  preparing: string | null;
  simulating: string | null;
  recovering: string | null;
  error: string | null;
  canRead: boolean;
  canManage: boolean;
  refresh: () => Promise<void>;
  prepare: (item: AppointmentReminderQueueItem, channel: CommunicationChannel) => Promise<CommunicationOperationResult>;
  simulate: (operation: CommunicationOperation, scenario: CommunicationSimulationScenario) => Promise<CommunicationOperationResult>;
  recover: (operation: CommunicationOperation) => Promise<CommunicationOperationResult>;
  upsertRoute: (channel: CommunicationChannel, adapterCode: CommunicationAdapterCode) => Promise<CommunicationRoute>;
  disableRoute: (route: CommunicationRoute) => Promise<CommunicationRoute>;
  clearError: () => void;
}

export function useCommunicationOperations(): UseCommunicationOperationsResult {
  const { authMode, user } = useAuth();
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.tenantId;
  const role = activeTenant?.role;
  const canRead = authMode === 'dev' || READ_ROLES.has(role ?? '');
  const canManage = authMode === 'dev' || MANAGE_ROLES.has(role ?? '');
  const isSupabaseMode = authMode === 'supabase-active' && isSupabaseConfigured;

  const repository = useMemo<CommunicationOrchestrationRepository | null>(() => {
    if (!canRead || !tenantId || !isSupabaseMode || !user?.id) return null;
    return createCommunicationOrchestrationRepository({ tenantId });
  }, [canRead, isSupabaseMode, tenantId, user?.id]);

  const [routes, setRoutes] = useState<CommunicationRoute[]>([]);
  const [operations, setOperations] = useState<CommunicationOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState<string | null>(null);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [recovering, setRecovering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const busy = useRef(new Set<string>());
  const retainedKeys = useRef(new Map<string, string>());

  const refresh = useCallback(async (clear = false): Promise<void> => {
    const request = ++sequence.current;
    if (clear) {
      setRoutes([]);
      setOperations([]);
      setError(null);
      setPreparing(null);
      setSimulating(null);
      setRecovering(null);
    }
    if (!repository || !tenantId || !canRead) {
      setRoutes([]);
      setOperations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [nextRoutes, nextOperations] = await Promise.all([
        repository.listCommunicationRoutes(),
        repository.listCommunicationOperations(100),
      ]);
      if (request !== sequence.current) return;
      setRoutes(nextRoutes);
      setOperations(nextOperations);
    } catch (cause) {
      if (request !== sequence.current) return;
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить тестовые коммуникационные операции.');
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [canRead, repository, tenantId]);

  useEffect(() => {
    const scheduled = ++sequence.current;
    busy.current.clear();
    retainedKeys.current.clear();
    void Promise.resolve().then(() => {
      if (scheduled !== sequence.current) return;
      return refresh(true);
    });
  }, [refresh, tenantId]);

  const replaceOperation = useCallback((next: CommunicationOperation) => {
    setOperations((current) => [
      next,
      ...current.filter((item) => item.id !== next.id),
    ].sort((left, right) => right.preparedAt.localeCompare(left.preparedAt)));
  }, []);

  const prepare = useCallback(async (
    item: AppointmentReminderQueueItem,
    channel: CommunicationChannel,
  ): Promise<CommunicationOperationResult> => {
    if (!repository || !tenantId || !canManage) {
      throw new CommunicationOrchestrationRepositoryError('permission');
    }
    const slot = `${tenantId}:prepare:${item.job.id}:${channel}`;
    if (busy.current.has(slot)) {
      throw new CommunicationOrchestrationRepositoryError('conflict');
    }
    const key = retainedKeys.current.get(slot) ?? operationKey('prepare', item.job.id);
    retainedKeys.current.set(slot, key);
    busy.current.add(slot);
    setPreparing(item.job.id);
    setError(null);
    try {
      const result = await repository.prepareCommunicationOperation({
        reminderJobId: item.job.id,
        channel,
        operationKey: key,
        expectedJobUpdatedAt: item.job.updatedAt,
        expectedAppointmentUpdatedAt: item.appointment.updatedAt ?? item.job.appointmentUpdatedAt,
      });
      retainedKeys.current.delete(slot);
      replaceOperation(result.operation);
      await refresh();
      return result;
    } catch (cause) {
      if (isDefinitiveFailure(cause)) retainedKeys.current.delete(slot);
      setError(cause instanceof Error ? cause.message : 'Не удалось выполнить тестовую операцию.');
      throw cause;
    } finally {
      busy.current.delete(slot);
      setPreparing(null);
    }
  }, [canManage, refresh, replaceOperation, repository, tenantId]);

  const simulate = useCallback(async (
    current: CommunicationOperation,
    scenario: CommunicationSimulationScenario,
  ): Promise<CommunicationOperationResult> => {
    if (!repository || !tenantId || !canManage) {
      throw new CommunicationOrchestrationRepositoryError('permission');
    }
    const slot = `${tenantId}:simulate:${current.id}`;
    if (busy.current.has(slot)) {
      throw new CommunicationOrchestrationRepositoryError('conflict');
    }
    const key = retainedKeys.current.get(slot) ?? operationKey('simulate', current.id);
    retainedKeys.current.set(slot, key);
    busy.current.add(slot);
    setSimulating(current.id);
    setError(null);

    try {
      const result = await repository.simulateCommunicationOperation({
        operationId: current.id,
        scenario,
        operationKey: key,
        expectedUpdatedAt: current.updatedAt,
      });
      retainedKeys.current.delete(slot);
      replaceOperation(result.operation);
      await refresh();
      return result;
    } catch (cause) {
      if (isDefinitiveFailure(cause)) {
        retainedKeys.current.delete(slot);
        setError(cause instanceof Error ? cause.message : 'Не удалось выполнить тестовую операцию.');
        throw cause;
      }

      setRecovering(current.id);
      try {
        const recovered = await repository.recoverCommunicationOperation(current.id, key);
        retainedKeys.current.delete(slot);
        replaceOperation(recovered.operation);
        await refresh();
        return recovered;
      } catch {
        setError(cause instanceof Error ? cause.message : 'Не удалось выполнить тестовую операцию.');
        throw cause;
      } finally {
        setRecovering(null);
      }
    } finally {
      busy.current.delete(slot);
      setSimulating(null);
    }
  }, [canManage, refresh, replaceOperation, repository, tenantId]);

  const recover = useCallback(async (
    current: CommunicationOperation,
  ): Promise<CommunicationOperationResult> => {
    if (!repository || !tenantId || !canManage) {
      throw new CommunicationOrchestrationRepositoryError('permission');
    }
    const slot = `${tenantId}:recover:${current.id}`;
    if (busy.current.has(slot)) {
      throw new CommunicationOrchestrationRepositoryError('conflict');
    }
    busy.current.add(slot);
    setRecovering(current.id);
    setError(null);
    try {
      const result = await repository.recoverCommunicationOperation(
        current.id,
        operationKey('recover', current.id),
      );
      replaceOperation(result.operation);
      await refresh();
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось выполнить тестовую операцию.');
      throw cause;
    } finally {
      busy.current.delete(slot);
      setRecovering(null);
    }
  }, [canManage, refresh, replaceOperation, repository, tenantId]);

  const upsertRoute = useCallback(async (
    channel: CommunicationChannel,
    adapterCode: CommunicationAdapterCode,
  ): Promise<CommunicationRoute> => {
    if (!repository || !tenantId || !canManage) {
      throw new CommunicationOrchestrationRepositoryError('permission');
    }
    const result = await repository.upsertCommunicationRoute({
      channel,
      adapterCode,
      enabled: true,
      priority: 100,
      operationKey: operationKey('route', `${channel}-${adapterCode}`),
    });
    await refresh();
    return result.route;
  }, [canManage, refresh, repository, tenantId]);

  const disableRoute = useCallback(async (route: CommunicationRoute): Promise<CommunicationRoute> => {
    if (!repository || !tenantId || !canManage) {
      throw new CommunicationOrchestrationRepositoryError('permission');
    }
    const result = await repository.disableCommunicationRoute(
      route.id,
      route.updatedAt,
      operationKey('route-disable', route.id),
    );
    await refresh();
    return result.route;
  }, [canManage, refresh, repository, tenantId]);

  return {
    routes,
    operations,
    loading,
    preparing,
    simulating,
    recovering,
    error,
    canRead,
    canManage,
    refresh,
    prepare,
    simulate,
    recover,
    upsertRoute,
    disableRoute,
    clearError: () => setError(null),
  };
}
