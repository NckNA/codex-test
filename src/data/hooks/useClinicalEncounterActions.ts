import { useCallback, useMemo, useState } from 'react';
import {
  createEncounterVisitRpcClient,
  type EncounterVisitRpcClient,
} from '../repositories/EncounterVisitRpcClient';
import type { ClinicalEncounterType } from '../repositories/EncounterVisitRepository';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export type ClinicalEncounterActionName = 'create' | 'start' | 'complete';

export interface CreateClinicalEncounterActionInput {
  encounterType: ClinicalEncounterType;
  chiefComplaintSnapshot?: string | null;
  clinicalSummary?: string | null;
  visitId?: string | null;
  appointmentId?: string | null;
}

export interface CompleteClinicalEncounterActionInput {
  encounterId: string;
  clinicalSummary: string;
}

export interface UseClinicalEncounterActionsOptions {
  tenantId?: string | null;
  patientId?: string | null;
  refresh?: () => Promise<void> | void;
  rpcClient?: EncounterVisitRpcClient;
}

export interface UseClinicalEncounterActionsResult {
  actionLoading: ClinicalEncounterActionName | null;
  loading: boolean;
  error: Error | null;
  createEncounter: (input: CreateClinicalEncounterActionInput) => Promise<void>;
  startEncounter: (encounterId: string) => Promise<void>;
  completeEncounter: (input: CompleteClinicalEncounterActionInput) => Promise<void>;
  clearError: () => void;
}

const ACTION_METADATA = { source: 'clinical_encounter_ui' };
const RPC_UNAVAILABLE_ERROR = 'Clinical encounter RPC client is not configured.';
const TENANT_REQUIRED_ERROR = 'No active clinic.';
const PATIENT_REQUIRED_ERROR = 'Patient is required.';
const ENCOUNTER_REQUIRED_ERROR = 'Encounter id is required.';
const SUMMARY_REQUIRED_ERROR = 'Clinical summary is required.';
const DEFAULT_ACTION_ERROR = 'Clinical encounter action failed.';

function safeError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('permission') || message.includes('not allowed') || message.includes('denied')) {
      return new Error('Permission denied for clinical encounter action.');
    }
    if (message.includes('status') || message.includes('transition') || message.includes('encounter')) {
      return new Error('Clinical encounter status does not allow this action.');
    }
    return new Error(error.message || fallback);
  }
  return new Error(fallback);
}

export function useClinicalEncounterActions({
  tenantId,
  patientId,
  refresh,
  rpcClient,
}: UseClinicalEncounterActionsOptions): UseClinicalEncounterActionsResult {
  const [actionLoading, setActionLoading] = useState<ClinicalEncounterActionName | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const client = useMemo(() => {
    if (rpcClient) return rpcClient;
    if (!isSupabaseConfigured) return null;
    return createEncounterVisitRpcClient({ backend: 'supabase' });
  }, [rpcClient]);

  const requireClient = useCallback(() => {
    if (!tenantId) throw new Error(TENANT_REQUIRED_ERROR);
    if (!client) throw new Error(RPC_UNAVAILABLE_ERROR);
    return client;
  }, [client, tenantId]);

  const runAction = useCallback(async (actionName: ClinicalEncounterActionName, action: () => Promise<void>) => {
    setActionLoading(actionName);
    setError(null);
    try {
      await action();
      await refresh?.();
    } catch (err) {
      const parsed = safeError(err, DEFAULT_ACTION_ERROR);
      setError(parsed);
      throw parsed;
    } finally {
      setActionLoading(null);
    }
  }, [refresh]);

  const createEncounter = useCallback(async (input: CreateClinicalEncounterActionInput) => {
    await runAction('create', async () => {
      const actionClient = requireClient();
      if (!patientId) throw new Error(PATIENT_REQUIRED_ERROR);
      await actionClient.createClinicalEncounter({
        tenantId: tenantId!,
        patientId,
        visitId: input.visitId ?? null,
        appointmentId: input.appointmentId ?? null,
        encounterType: input.encounterType,
        chiefComplaintSnapshot: input.chiefComplaintSnapshot?.trim() || null,
        clinicalSummary: input.clinicalSummary?.trim() || null,
        metadata: ACTION_METADATA,
      });
    });
  }, [patientId, requireClient, runAction, tenantId]);

  const startEncounter = useCallback(async (encounterId: string) => {
    await runAction('start', async () => {
      const actionClient = requireClient();
      if (!encounterId) throw new Error(ENCOUNTER_REQUIRED_ERROR);
      await actionClient.startClinicalEncounter({
        tenantId: tenantId!,
        encounterId,
        metadata: ACTION_METADATA,
      });
    });
  }, [requireClient, runAction, tenantId]);

  const completeEncounter = useCallback(async ({ encounterId, clinicalSummary }: CompleteClinicalEncounterActionInput) => {
    await runAction('complete', async () => {
      const actionClient = requireClient();
      if (!encounterId) throw new Error(ENCOUNTER_REQUIRED_ERROR);
      if (!clinicalSummary.trim()) throw new Error(SUMMARY_REQUIRED_ERROR);
      await actionClient.completeClinicalEncounter({
        tenantId: tenantId!,
        encounterId,
        clinicalSummary: clinicalSummary.trim(),
        metadata: ACTION_METADATA,
      });
    });
  }, [requireClient, runAction, tenantId]);

  return {
    actionLoading,
    loading: actionLoading !== null,
    error,
    createEncounter,
    startEncounter,
    completeEncounter,
    clearError: () => setError(null),
  };
}
