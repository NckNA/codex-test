import { useCallback, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import type { Appointment } from '../../types';
import {
  AppointmentRepositoryError,
  createAppointmentRepository,
  isProtectedAppointmentChange,
  type AppointmentWriteResult,
  type IAppointmentRepository,
} from '../repositories/AppointmentRepository';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

interface OperationAttempt {
  contextKey: string;
  signature: string;
  operationKey: string;
}

interface MutationState {
  contextKey: string;
  isSaving: boolean;
  isReconciling: boolean;
  error: Error | null;
}

const appointmentBusinessSignature = (appointment: Appointment) => JSON.stringify({
  patientId: appointment.patientId || null,
  doctorId: appointment.doctorId,
  cabinet: appointment.cabinet || '',
  service: appointment.service || '',
  status: appointment.status,
  paymentType: appointment.paymentType || null,
  source: appointment.source || null,
  price: appointment.price ?? null,
  comment: appointment.comment || null,
  start: appointment.start,
  end: appointment.end,
});

const safeMutationError = (error: unknown): Error => (
  error instanceof Error
    ? error
    : new Error('Не удалось сохранить запись. Обновите расписание и проверьте результат.')
);

export function useScheduleAppointments() {
  const { authMode, user } = useAuth();
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.tenantId;
  const isSupabaseMode = authMode === 'supabase-active' && isSupabaseConfigured;
  const contextKey = `${authMode}:${user?.id || 'no-user'}:${tenantId || 'no-tenant'}`;
  const currentContextRef = useRef(contextKey);
  useLayoutEffect(() => {
    currentContextRef.current = contextKey;
  }, [contextKey]);

  const [mutationState, setMutationState] = useState<MutationState>({
    contextKey,
    isSaving: false,
    isReconciling: false,
    error: null,
  });

  const createAttemptRef = useRef<OperationAttempt | null>(null);
  const rescheduleAttemptRef = useRef<OperationAttempt | null>(null);
  const inFlightRef = useRef<{
    contextKey: string;
    signature: string;
    token: symbol;
    promise: Promise<AppointmentWriteResult | null>;
  } | null>(null);

  const repository = useMemo<IAppointmentRepository | null>(() => {
    if (authMode === 'dev') {
      return createAppointmentRepository({ backend: 'local' });
    }
    if (isSupabaseMode && user?.id && tenantId) {
      return createAppointmentRepository({ backend: 'supabase', tenantId });
    }
    return null;
  }, [authMode, isSupabaseMode, tenantId, user?.id]);

  const queryEnabled = authMode === 'dev'
    || (isSupabaseMode && Boolean(user?.id) && Boolean(tenantId));

  const queryFn = useCallback(async (): Promise<Appointment[]> => {
    if (!repository) return [];
    try {
      return await repository.listAppointments();
    } catch {
      throw new Error('Не удалось загрузить расписание.');
    }
  }, [repository]);

  const {
    data: appointments,
    isLoading,
    isError: isQueryError,
    error: queryError,
    refetch,
  } = useAsyncQuery<Appointment[]>({
    queryFn,
    initialData: [],
    enabled: queryEnabled,
    queryKey: contextKey,
    resetOnDisable: true,
  });

  const requireRepository = useCallback((): IAppointmentRepository => {
    if (!repository) {
      throw new AppointmentRepositoryError('tenant_required', 'Клиника не выбрана.');
    }
    return repository;
  }, [repository]);

  const getOperationKey = useCallback((
    ref: MutableRefObject<OperationAttempt | null>,
    signature: string,
  ): string => {
    if (
      ref.current
      && ref.current.contextKey === contextKey
      && ref.current.signature === signature
    ) {
      return ref.current.operationKey;
    }

    const operationKey = crypto.randomUUID();
    ref.current = { contextKey, signature, operationKey };
    return operationKey;
  }, [contextKey]);

  const runMutation = useCallback((
    signature: string,
    write: (onRecoveryStateChange: (recovering: boolean) => void) => Promise<AppointmentWriteResult>,
    attemptRef?: MutableRefObject<OperationAttempt | null>,
  ): Promise<AppointmentWriteResult | null> => {
    const existing = inFlightRef.current;
    if (existing && existing.contextKey === contextKey) return existing.promise;

    const capturedContext = contextKey;
    setMutationState({
      contextKey: capturedContext,
      isSaving: true,
      isReconciling: false,
      error: null,
    });

    const operationToken = Symbol(signature);
    const promise = (async (): Promise<AppointmentWriteResult | null> => {
      try {
        const result = await write((recovering) => {
          if (currentContextRef.current !== capturedContext) return;
          setMutationState((current) => ({
            contextKey: capturedContext,
            isSaving: true,
            isReconciling: recovering,
            error: current.contextKey === capturedContext ? current.error : null,
          }));
        });

        if (currentContextRef.current !== capturedContext) return null;
        if (attemptRef) attemptRef.current = null;
        await refetch();
        if (currentContextRef.current !== capturedContext) return null;
        return result;
      } catch (error) {
        const parsedError = safeMutationError(error);
        if (
          attemptRef
          && (!(parsedError instanceof AppointmentRepositoryError) || !parsedError.ambiguous)
        ) {
          attemptRef.current = null;
        }

        if (currentContextRef.current === capturedContext) {
          setMutationState({
            contextKey: capturedContext,
            isSaving: false,
            isReconciling: false,
            error: parsedError,
          });
        }
        throw parsedError;
      } finally {
        if (currentContextRef.current === capturedContext) {
          setMutationState((current) => ({
            contextKey: capturedContext,
            isSaving: false,
            isReconciling: false,
            error: current.contextKey === capturedContext ? current.error : null,
          }));
        }
        if (inFlightRef.current?.token === operationToken) inFlightRef.current = null;
      }
    })();

    inFlightRef.current = { contextKey: capturedContext, signature, token: operationToken, promise };
    return promise;
  }, [contextKey, refetch]);

  const createAppointment = useCallback((appointment: Appointment) => {
    const activeRepository = requireRepository();
    const signature = `create:${contextKey}:${appointmentBusinessSignature(appointment)}`;
    const operationKey = getOperationKey(createAttemptRef, signature);

    return runMutation(
      signature,
      (onRecoveryStateChange) => activeRepository.createAppointment(appointment, {
        operationKey,
        onRecoveryStateChange,
      }),
      createAttemptRef,
    );
  }, [contextKey, getOperationKey, requireRepository, runMutation]);

  const updateAppointment = useCallback((current: Appointment, next: Appointment) => {
    const activeRepository = requireRepository();
    if (isProtectedAppointmentChange(current, next)) {
      const signature = `reschedule:${contextKey}:${current.id}:${current.updatedAt || ''}:${appointmentBusinessSignature(next)}`;
      const operationKey = getOperationKey(rescheduleAttemptRef, signature);
      return runMutation(
        signature,
        (onRecoveryStateChange) => activeRepository.rescheduleAppointment(current, next, {
          operationKey,
          onRecoveryStateChange,
        }),
        rescheduleAttemptRef,
      );
    }

    const signature = `details:${contextKey}:${current.id}:${current.updatedAt || ''}:${appointmentBusinessSignature(next)}`;
    return runMutation(
      signature,
      () => activeRepository.updateAppointmentDetails(current, next),
    );
  }, [contextKey, getOperationKey, requireRepository, runMutation]);

  const deleteAppointment = useCallback(async (appointmentId: string): Promise<boolean> => {
    const activeRepository = requireRepository();
    const capturedContext = contextKey;
    if (inFlightRef.current?.contextKey === capturedContext) return false;

    setMutationState({ contextKey: capturedContext, isSaving: true, isReconciling: false, error: null });
    try {
      await activeRepository.deleteAppointment(appointmentId);
      if (currentContextRef.current !== capturedContext) return false;
      await refetch();
      return currentContextRef.current === capturedContext;
    } catch (error) {
      const parsedError = safeMutationError(error);
      if (currentContextRef.current === capturedContext) {
        setMutationState({ contextKey: capturedContext, isSaving: false, isReconciling: false, error: parsedError });
      }
      throw parsedError;
    } finally {
      if (currentContextRef.current === capturedContext) {
        setMutationState((current) => ({
          contextKey: capturedContext,
          isSaving: false,
          isReconciling: false,
          error: current.contextKey === capturedContext ? current.error : null,
        }));
      }
    }
  }, [contextKey, refetch, requireRepository]);

  const mutationForCurrentContext = mutationState.contextKey === contextKey
    ? mutationState
    : { contextKey, isSaving: false, isReconciling: false, error: null };
  const isError = isQueryError || mutationForCurrentContext.error !== null;
  const error = mutationForCurrentContext.error || queryError;

  return {
    appointments: queryEnabled ? appointments : [],
    isLoading: queryEnabled ? isLoading : false,
    isError: queryEnabled ? isError : mutationForCurrentContext.error !== null,
    error,
    isSaving: mutationForCurrentContext.isSaving,
    isReconciling: mutationForCurrentContext.isReconciling,
    saveError: mutationForCurrentContext.error,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    refetch,
  };
}
