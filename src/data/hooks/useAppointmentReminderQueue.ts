import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import type {
  AppointmentContactChannel,
  AppointmentContactOutcome,
  AppointmentReminderOperationResult,
  AppointmentReminderQueueItem,
} from '../../types';
import {
  AppointmentReminderRepositoryError,
  createAppointmentReminderRepository,
  type AppointmentReminderRepository,
} from '../repositories/AppointmentReminderRepository';

const ACCESS_ROLES = new Set(['clinic_owner', 'clinic_admin', 'registrar']);
const ACTION_FAILED = 'Не удалось сохранить действие. Обновите очередь и проверьте результат.';

type ManualAction = 'complete' | 'defer' | 'skip';

const createOperationKey = (action: ManualAction, jobId: string): string => {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `reminder-${action}-${jobId}-${random}`;
};

const isDefinitiveFailure = (error: unknown): boolean => (
  error instanceof AppointmentReminderRepositoryError
  && error.code !== 'operation_failed'
);

export interface CompleteReminderActionInput {
  item: AppointmentReminderQueueItem;
  channel: AppointmentContactChannel;
  outcome: AppointmentContactOutcome;
  note?: string;
}

export interface DeferReminderActionInput {
  item: AppointmentReminderQueueItem;
  newDueAt: string;
  reason: string;
}

export interface SkipReminderActionInput {
  item: AppointmentReminderQueueItem;
  reason: string;
}

export interface UseAppointmentReminderQueueResult {
  jobs: AppointmentReminderQueueItem[];
  history: AppointmentReminderQueueItem[];
  loading: boolean;
  error: string | null;
  completingJobId: string | null;
  deferringJobId: string | null;
  skippingJobId: string | null;
  reconcilingOperation: boolean;
  canAccess: boolean;
  refresh: () => Promise<void>;
  completeJob: (input: CompleteReminderActionInput) => Promise<AppointmentReminderOperationResult>;
  deferJob: (input: DeferReminderActionInput) => Promise<AppointmentReminderOperationResult>;
  skipJob: (input: SkipReminderActionInput) => Promise<AppointmentReminderOperationResult>;
  clearError: () => void;
}

export function useAppointmentReminderQueue(): UseAppointmentReminderQueueResult {
  const { authMode, user } = useAuth();
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.tenantId;
  const role = activeTenant?.role;
  const isSupabaseMode = authMode === 'supabase-active' && isSupabaseConfigured;
  const canAccess = authMode === 'dev' || ACCESS_ROLES.has(role ?? '');

  const repository = useMemo<AppointmentReminderRepository | null>(() => {
    if (!canAccess) return null;
    if (authMode === 'dev') {
      return createAppointmentReminderRepository({ backend: 'local' });
    }
    if (isSupabaseMode && user?.id && tenantId) {
      return createAppointmentReminderRepository({ backend: 'supabase', tenantId });
    }
    return null;
  }, [authMode, canAccess, isSupabaseMode, tenantId, user?.id]);

  const [jobs, setJobs] = useState<AppointmentReminderQueueItem[]>([]);
  const [history, setHistory] = useState<AppointmentReminderQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completingJobId, setCompletingJobId] = useState<string | null>(null);
  const [deferringJobId, setDeferringJobId] = useState<string | null>(null);
  const [skippingJobId, setSkippingJobId] = useState<string | null>(null);
  const [reconcilingOperation, setReconcilingOperation] = useState(false);
  const requestSequence = useRef(0);
  const busyJobs = useRef(new Set<string>());
  const operationKeys = useRef(new Map<string, string>());

  const loadQueue = useCallback(async (clearPrevious = false): Promise<void> => {
    const sequence = ++requestSequence.current;
    if (clearPrevious) {
      setJobs([]);
      setHistory([]);
      setError(null);
      setCompletingJobId(null);
      setDeferringJobId(null);
      setSkippingJobId(null);
      setReconcilingOperation(false);
    }
    if (!repository || !tenantId || !canAccess) {
      setJobs([]);
      setHistory([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const referenceTime = new Date().toISOString();
      const [nextJobs, nextHistory] = await Promise.all([
        repository.listActiveReminderJobs(referenceTime),
        repository.listReminderJobHistory(100, referenceTime),
      ]);
      if (sequence !== requestSequence.current) return;
      setJobs(nextJobs);
      setHistory(nextHistory);
    } catch (cause) {
      if (sequence !== requestSequence.current) return;
      setJobs([]);
      setHistory([]);
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить очередь напоминаний.');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [canAccess, repository, tenantId]);

  useEffect(() => {
    const scheduledSequence = ++requestSequence.current;
    busyJobs.current.clear();
    operationKeys.current.clear();
    void Promise.resolve().then(() => {
      if (scheduledSequence !== requestSequence.current) return;
      return loadQueue(true);
    });
  }, [loadQueue, tenantId]);

  const finishSuccess = useCallback(async (
    result: AppointmentReminderOperationResult,
  ): Promise<AppointmentReminderOperationResult> => {
    setJobs((current) => current.filter((item) => item.job.id !== result.job.id));
    await loadQueue();
    return result;
  }, [loadQueue]);

  const runAction = useCallback(async (
    action: ManualAction,
    item: AppointmentReminderQueueItem,
    execute: (repositoryValue: AppointmentReminderRepository, key: string) => Promise<AppointmentReminderOperationResult>,
  ): Promise<AppointmentReminderOperationResult> => {
    if (!repository || !tenantId || !canAccess) {
      throw new AppointmentReminderRepositoryError(
        'permission',
        'Недостаточно прав для работы с очередью напоминаний.',
      );
    }
    const jobId = item.job.id;
    if (busyJobs.current.has(jobId)) {
      throw new AppointmentReminderRepositoryError(
        'concurrent',
        'Задача была изменена другим пользователем. Обновите очередь.',
      );
    }

    const keySlot = `${tenantId}:${action}:${jobId}`;
    const operationKey = operationKeys.current.get(keySlot) ?? createOperationKey(action, jobId);
    operationKeys.current.set(keySlot, operationKey);
    busyJobs.current.add(jobId);
    setError(null);
    if (action === 'complete') setCompletingJobId(jobId);
    if (action === 'defer') setDeferringJobId(jobId);
    if (action === 'skip') setSkippingJobId(jobId);

    try {
      const result = await execute(repository, operationKey);
      operationKeys.current.delete(keySlot);
      return await finishSuccess(result);
    } catch (cause) {
      if (isDefinitiveFailure(cause)) {
        operationKeys.current.delete(keySlot);
        const message = cause instanceof Error ? cause.message : ACTION_FAILED;
        setError(message);
        throw cause;
      }

      setReconcilingOperation(true);
      try {
        const recovered = await repository.getReminderOperation(operationKey);
        if (recovered) {
          operationKeys.current.delete(keySlot);
          return await finishSuccess(recovered);
        }
      } catch {
        // Keep the same key. The next user retry must reconcile the same logical operation.
      } finally {
        setReconcilingOperation(false);
      }

      const ambiguousError = cause instanceof AppointmentReminderRepositoryError
        ? cause
        : new AppointmentReminderRepositoryError('operation_failed', ACTION_FAILED);
      setError(ambiguousError.message);
      throw ambiguousError;
    } finally {
      busyJobs.current.delete(jobId);
      if (action === 'complete') setCompletingJobId(null);
      if (action === 'defer') setDeferringJobId(null);
      if (action === 'skip') setSkippingJobId(null);
    }
  }, [canAccess, finishSuccess, repository, tenantId]);

  const completeJob = useCallback((input: CompleteReminderActionInput) => runAction(
    'complete',
    input.item,
    (repositoryValue, operationKey) => repositoryValue.completeReminderJob({
      jobId: input.item.job.id,
      channel: input.channel,
      outcome: input.outcome,
      note: input.note,
      expectedJobUpdatedAt: input.item.job.updatedAt,
      expectedAppointmentUpdatedAt: input.item.appointment.updatedAt ?? input.item.job.appointmentUpdatedAt,
      operationKey,
    }),
  ), [runAction]);

  const deferJob = useCallback((input: DeferReminderActionInput) => runAction(
    'defer',
    input.item,
    (repositoryValue, operationKey) => repositoryValue.deferReminderJob({
      jobId: input.item.job.id,
      newDueAt: input.newDueAt,
      reason: input.reason,
      expectedJobUpdatedAt: input.item.job.updatedAt,
      expectedAppointmentUpdatedAt: input.item.appointment.updatedAt ?? input.item.job.appointmentUpdatedAt,
      operationKey,
    }),
  ), [runAction]);

  const skipJob = useCallback((input: SkipReminderActionInput) => runAction(
    'skip',
    input.item,
    (repositoryValue, operationKey) => repositoryValue.skipReminderJob({
      jobId: input.item.job.id,
      reason: input.reason,
      expectedJobUpdatedAt: input.item.job.updatedAt,
      expectedAppointmentUpdatedAt: input.item.appointment.updatedAt ?? input.item.job.appointmentUpdatedAt,
      operationKey,
    }),
  ), [runAction]);

  return {
    jobs,
    history,
    loading,
    error,
    completingJobId,
    deferringJobId,
    skippingJobId,
    reconcilingOperation,
    canAccess,
    refresh: loadQueue,
    completeJob,
    deferJob,
    skipJob,
    clearError: () => setError(null),
  };
}
