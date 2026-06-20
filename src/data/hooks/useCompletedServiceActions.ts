import { useCallback, useMemo, useState } from 'react';
import { createEncounterVisitRpcClient, type EncounterVisitRpcClient } from '../repositories/EncounterVisitRpcClient';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export type CompletedServiceActionName = 'record' | 'void';

export interface RecordCompletedServiceActionInput {
  serviceName: string;
  serviceCode?: string | null;
  toothNumber?: string | null;
  toothSurface?: string | null;
  quantity: number;
  unitPrice?: number | null;
  totalAmount?: number | null;
  currency?: string;
  performedAt?: string | null;
  visitId?: string | null;
  encounterId?: string | null;
  findingId?: string | null;
  treatmentPlanId?: string | null;
  treatmentStageId?: string | null;
  clinicalDictionaryItemId?: string | null;
}

export interface UseCompletedServiceActionsOptions {
  tenantId?: string | null;
  patientId?: string | null;
  refresh?: () => Promise<void> | void;
  rpcClient?: EncounterVisitRpcClient;
}

export interface UseCompletedServiceActionsResult {
  actionLoading: CompletedServiceActionName | null;
  loading: boolean;
  error: Error | null;
  recordService: (input: RecordCompletedServiceActionInput) => Promise<void>;
  voidService: (completedServiceId: string, reason: string) => Promise<void>;
  clearError: () => void;
}

const ACTION_METADATA = { source: 'completed_services_ui' };

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function safeError(error: unknown): Error {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('permission') || message.includes('denied')) return new Error('Permission denied.');
    if (message.includes('status') || message.includes('transition')) return new Error('Invalid status transition.');
    return new Error(error.message || 'Completed service action failed.');
  }
  return new Error('Completed service action failed.');
}

export function useCompletedServiceActions({ tenantId, patientId, refresh, rpcClient }: UseCompletedServiceActionsOptions): UseCompletedServiceActionsResult {
  const [actionLoading, setActionLoading] = useState<CompletedServiceActionName | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const client = useMemo(() => {
    if (rpcClient) return rpcClient;
    if (!isSupabaseConfigured) return null;
    return createEncounterVisitRpcClient({ backend: 'supabase' });
  }, [rpcClient]);

  const requireClient = useCallback(() => {
    if (!tenantId) throw new Error('No active clinic.');
    if (!client) throw new Error('RPC client is not configured.');
    return client;
  }, [client, tenantId]);

  const runAction = useCallback(async (name: CompletedServiceActionName, action: () => Promise<void>) => {
    setActionLoading(name);
    setError(null);
    try {
      await action();
      await refresh?.();
    } catch (err) {
      const parsed = safeError(err);
      setError(parsed);
      throw parsed;
    } finally {
      setActionLoading(null);
    }
  }, [refresh]);

  const recordService = useCallback(async (input: RecordCompletedServiceActionInput) => {
    await runAction('record', async () => {
      const actionClient = requireClient();
      if (!patientId) throw new Error('Patient is required.');
      const serviceName = input.serviceName.trim();
      if (!serviceName) throw new Error('Service name is required.');
      if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('Quantity must be greater than zero.');
      if (input.unitPrice !== undefined && input.unitPrice !== null && input.unitPrice < 0) throw new Error('Amount cannot be negative.');
      if (input.totalAmount !== undefined && input.totalAmount !== null && input.totalAmount < 0) throw new Error('Amount cannot be negative.');
      await actionClient.recordCompletedService({
        tenantId: tenantId!,
        patientId,
        visitId: normalizeOptionalText(input.visitId),
        encounterId: normalizeOptionalText(input.encounterId),
        findingId: normalizeOptionalText(input.findingId),
        treatmentPlanId: normalizeOptionalText(input.treatmentPlanId),
        treatmentStageId: normalizeOptionalText(input.treatmentStageId),
        clinicalDictionaryItemId: normalizeOptionalText(input.clinicalDictionaryItemId),
        serviceCode: normalizeOptionalText(input.serviceCode),
        serviceName,
        toothNumber: normalizeOptionalText(input.toothNumber),
        toothSurface: normalizeOptionalText(input.toothSurface),
        quantity: input.quantity,
        unitPrice: input.unitPrice ?? null,
        totalAmount: input.totalAmount ?? null,
        currency: input.currency?.trim() || 'KZT',
        performedAt: normalizeOptionalText(input.performedAt),
        metadata: ACTION_METADATA,
      });
    });
  }, [patientId, requireClient, runAction, tenantId]);

  const voidService = useCallback(async (completedServiceId: string, reason: string) => {
    await runAction('void', async () => {
      const actionClient = requireClient();
      if (!completedServiceId) throw new Error('Completed service id is required.');
      if (!reason.trim()) throw new Error('Reason is required.');
      await actionClient.voidCompletedService({
        tenantId: tenantId!,
        completedServiceId,
        reason: reason.trim(),
        metadata: ACTION_METADATA,
      });
    });
  }, [requireClient, runAction, tenantId]);

  return { actionLoading, loading: actionLoading !== null, error, recordService, voidService, clearError: () => setError(null) };
}
