import { useCallback, useState } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import { LocalStoragePatientRepository } from '../repositories/PatientRepository';
import type { Patient } from '../../types';

export function usePatientsCollection() {
  const queryFn = useCallback(
    () => LocalStoragePatientRepository.listPatients(),
    []
  );

  const {
    data: patients,
    isLoading,
    isError: isQueryError,
    error: queryError,
    refetch,
  } = useAsyncQuery<Patient[]>({
    queryFn,
    initialData: [],
    enabled: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  const createPatient = async (patient: Patient) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await LocalStoragePatientRepository.createPatient(patient);
      await refetch();
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to create patient');
      setSaveError(err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const updatePatient = async (patient: Patient) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await LocalStoragePatientRepository.updatePatient(patient);
      await refetch();
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to update patient');
      setSaveError(err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    patients: patients || [],
    isLoading,
    isError: isQueryError || saveError !== null,
    error: saveError || queryError,
    isSaving,
    createPatient,
    updatePatient,
    refetch,
  };
}
