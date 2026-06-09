import { useState, useCallback, useMemo } from 'react';
import type { ChiefComplaint } from '../../types';
import { createChiefComplaintRepository } from '../repositories/ChiefComplaintRepository';
import { useAsyncQuery } from './useAsyncQuery';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export function useChiefComplaint(patientId: string) {
  const { activeTenant } = useTenant();
  const { authMode } = useAuth();
  
  const backend = authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured
    ? 'supabase'
    : 'local';

  const repo = useMemo(() => {
    return createChiefComplaintRepository({
      tenantId: activeTenant?.tenantId,
      backend
    });
  }, [activeTenant?.tenantId, backend]);

  // Query: load complaint via useAsyncQuery
  const queryFn = useCallback(
    () => repo.getChiefComplaint(patientId),
    [repo, patientId]
  );
  
  const {
    data: complaint,
    isLoading,
    isError: isQueryError,
    error: queryError,
    refetch,
  } = useAsyncQuery<ChiefComplaint | null>({
    queryFn,
    initialData: null,
    enabled: Boolean(patientId),
  });

  // Mutation: manual save wrapper (NOT using useAsyncMutation)
  // Rationale: useAsyncMutation<void> cannot distinguish success from error
  // by return value, and its onSuccess callback is fire-and-forget (does not
  // await refetch). Keeping a manual wrapper preserves throw-on-error and
  // sequential await-refetch timing exactly.
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [isSaveError, setIsSaveError] = useState<boolean>(false);

  const refetchComplaint = useCallback(async () => {
    setIsSaveError(false);
    setSaveError(null);
    await refetch();
  }, [refetch]);

  const saveComplaint = useCallback(async (
    input: Omit<ChiefComplaint, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>
  ) => {
    setIsSaving(true);
    setIsSaveError(false);
    setSaveError(null);
    try {
      await repo.saveChiefComplaint(patientId, input);
      await refetchComplaint();
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error(String(err));
      setIsSaveError(true);
      setSaveError(parsedError);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, refetchComplaint, repo]);

  // Merge error state for public API compatibility
  const isError = isQueryError || isSaveError;
  const error = saveError || queryError;

  return {
    complaint,
    isLoading,
    isError,
    error,
    isSaving,
    refetch: refetchComplaint,
    saveComplaint,
  };
}
