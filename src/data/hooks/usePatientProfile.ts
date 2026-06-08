import { useState, useCallback } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import type { Patient } from '../../types';
import { LocalStoragePatientRepository } from '../repositories/PatientRepository';

export function usePatientProfile(patientId: string) {
  const queryFn = useCallback(
    () => LocalStoragePatientRepository.getPatientById(patientId),
    [patientId]
  );

  const {
    data: patient,
    isLoading,
    isError: isQueryError,
    error: queryError,
    refetch,
  } = useAsyncQuery<Patient | null>({
    queryFn,
    initialData: null,
    enabled: Boolean(patientId),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  const savePatient = async (updatedPatient: Patient) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      await LocalStoragePatientRepository.updatePatient(updatedPatient);
      await refetch();
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to save patient');
      setSaveError(err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    patient,
    isLoading,
    isError: isQueryError || saveError !== null,
    error: saveError || queryError,
    isSaving,
    savePatient,
    refetch,
  };
}
