import { useCallback, useState } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import { LocalStorageFindingsRepository, type CreateFindingInput } from '../repositories/FindingsRepository';
import type { DentalFinding } from '../../types';

export function usePatientFindings(patientId: string) {
  const queryFn = useCallback(async () => {
    return await LocalStorageFindingsRepository.listFindingsByPatient(patientId);
  }, [patientId]);

  const {
    data: findings,
    isLoading,
    isError,
    error,
    refetch,
  } = useAsyncQuery<DentalFinding[]>({
    queryFn,
    initialData: [],
    enabled: Boolean(patientId),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  const createFinding = useCallback(async (finding: CreateFindingInput): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await LocalStorageFindingsRepository.createFinding(patientId, finding);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, refetch]);

  const updateFinding = useCallback(async (finding: DentalFinding): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await LocalStorageFindingsRepository.updateFinding(patientId, finding);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, refetch]);

  const deleteFinding = useCallback(async (findingId: string): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await LocalStorageFindingsRepository.deleteFinding(patientId, findingId);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, refetch]);

  return {
    findings: findings || [],
    isLoading,
    isError: isError || saveError !== null,
    error: error || saveError,
    isSaving,
    saveError,
    createFinding,
    updateFinding,
    deleteFinding,
    refetch,
  };
}
