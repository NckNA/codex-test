import { useState, useCallback } from 'react';
import type { ChiefComplaint } from '../../types';
import { LocalStorageChiefComplaintRepository } from '../repositories/ChiefComplaintRepository';
import { useAsyncQuery } from './useAsyncQuery';

export function useChiefComplaint(patientId: string) {
  // Query: load complaint via useAsyncQuery
  const queryFn = useCallback(
    () => LocalStorageChiefComplaintRepository.getChiefComplaint(patientId),
    [patientId]
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

  const saveComplaint = useCallback(async (
    input: Omit<ChiefComplaint, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>
  ) => {
    setIsSaving(true);
    setIsSaveError(false);
    setSaveError(null);
    try {
      await LocalStorageChiefComplaintRepository.saveChiefComplaint(patientId, input);
      await refetch();
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error(String(err));
      setIsSaveError(true);
      setSaveError(parsedError);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, refetch]);

  // Merge error state for public API compatibility
  const isError = isQueryError || isSaveError;
  const error = queryError || saveError;

  return {
    complaint,
    isLoading,
    isError,
    error,
    isSaving,
    refetch,
    saveComplaint,
  };
}
