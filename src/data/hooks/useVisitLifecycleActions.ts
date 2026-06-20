import { useCallback, useMemo, useState } from 'react';
import {
  createEncounterVisitRpcClient,
  type EncounterVisitRpcClient,
} from '../repositories/EncounterVisitRpcClient';
import type { PatientVisitType } from '../repositories/EncounterVisitRepository';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export type VisitLifecycleActionName = 'check_in' | 'start' | 'complete' | 'cancel';

export interface CheckInVisitInput {
  visitType: PatientVisitType;
  notes?: string | null;
  appointmentId?: string | null;
}

export interface CancelVisitInput {
  visitId: string;
  reason: string;
}

export interface UseVisitLifecycleActionsOptions {
  tenantId?: string | null;
  patientId?: string | null;
  refresh?: () => Promise<void> | void;
  rpcClient?: EncounterVisitRpcClient;
}

export interface UseVisitLifecycleActionsResult {
  actionLoading: VisitLifecycleActionName | null;
  loading: boolean;
  error: Error | null;
  checkInVisit: (input: CheckInVisitInput) => Promise<void>;
  startVisit: (visitId: string) => Promise<void>;
  completeVisit: (visitId: string) => Promise<void>;
  cancelVisit: (input: CancelVisitInput) => Promise<void>;
  clearError: () => void;
}

const ACTION_METADATA = { source: 'visit_checkin_ui' };
const SUPABASE_RPC_UNAVAILABLE_ERROR = 'Supabase client is not configured for visit lifecycle actions.';
const TENANT_REQUIRED_ERROR = 'Не выбрана клиника.';
const PATIENT_REQUIRED_ERROR = 'Пациент не найден.';
const VISIT_REQUIRED_ERROR = 'Невозможно выполнить действие для текущего статуса визита.';
const CANCEL_REASON_REQUIRED_ERROR = 'Укажите причину отмены визита.';

function safeError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('permission') || message.includes('not allowed') || message.includes('denied')) {
      return new Error('Недостаточно прав для действия.');
    }
    if (message.includes('status') || message.includes('transition') || message.includes('visit')) {
      return new Error('Невозможно выполнить действие для текущего статуса визита.');
    }
    return new Error(error.message || fallback);
  }

  return new Error(fallback);
}

export function useVisitLifecycleActions({
  tenantId,
  patientId,
  refresh,
  rpcClient,
}: UseVisitLifecycleActionsOptions): UseVisitLifecycleActionsResult {
  const [actionLoading, setActionLoading] = useState<VisitLifecycleActionName | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const client = useMemo(() => {
    if (rpcClient) return rpcClient;
    if (!isSupabaseConfigured) return null;
    return createEncounterVisitRpcClient({ backend: 'supabase' });
  }, [rpcClient]);

  const requireClient = useCallback(() => {
    if (!tenantId) throw new Error(TENANT_REQUIRED_ERROR);
    if (!client) throw new Error(SUPABASE_RPC_UNAVAILABLE_ERROR);
    return client;
  }, [client, tenantId]);

  const runAction = useCallback(async (actionName: VisitLifecycleActionName, action: () => Promise<void>) => {
    setActionLoading(actionName);
    setError(null);
    try {
      await action();
      await refresh?.();
    } catch (err) {
      const parsed = safeError(err, 'Не удалось обновить визит. Попробуйте ещё раз.');
      setError(parsed);
      throw parsed;
    } finally {
      setActionLoading(null);
    }
  }, [refresh]);

  const checkInVisit = useCallback(async (input: CheckInVisitInput) => {
    await runAction('check_in', async () => {
      const actionClient = requireClient();
      if (!patientId) throw new Error(PATIENT_REQUIRED_ERROR);

      await actionClient.checkInPatientVisit({
        tenantId: tenantId!,
        patientId,
        appointmentId: input.appointmentId ?? null,
        visitType: input.visitType,
        notes: input.notes?.trim() || null,
        metadata: ACTION_METADATA,
      });
    });
  }, [patientId, requireClient, runAction, tenantId]);

  const startVisit = useCallback(async (visitId: string) => {
    await runAction('start', async () => {
      const actionClient = requireClient();
      if (!visitId) throw new Error(VISIT_REQUIRED_ERROR);

      await actionClient.startPatientVisit({
        tenantId: tenantId!,
        visitId,
        metadata: ACTION_METADATA,
      });
    });
  }, [requireClient, runAction, tenantId]);

  const completeVisit = useCallback(async (visitId: string) => {
    await runAction('complete', async () => {
      const actionClient = requireClient();
      if (!visitId) throw new Error(VISIT_REQUIRED_ERROR);

      await actionClient.completePatientVisit({
        tenantId: tenantId!,
        visitId,
        metadata: ACTION_METADATA,
      });
    });
  }, [requireClient, runAction, tenantId]);

  const cancelVisit = useCallback(async ({ visitId, reason }: CancelVisitInput) => {
    await runAction('cancel', async () => {
      const actionClient = requireClient();
      if (!visitId) throw new Error(VISIT_REQUIRED_ERROR);
      if (!reason.trim()) throw new Error(CANCEL_REASON_REQUIRED_ERROR);

      await actionClient.cancelPatientVisit({
        tenantId: tenantId!,
        visitId,
        reason: reason.trim(),
        metadata: ACTION_METADATA,
      });
    });
  }, [requireClient, runAction, tenantId]);

  return {
    actionLoading,
    loading: actionLoading !== null,
    error,
    checkInVisit,
    startVisit,
    completeVisit,
    cancelVisit,
    clearError: () => setError(null),
  };
}
