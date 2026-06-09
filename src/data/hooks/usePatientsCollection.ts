import { useCallback, useState, useMemo } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import { createPatientRepository } from '../repositories/PatientRepository';
import type { Patient } from '../../types';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export function usePatientsCollection() {
  const { activeTenant } = useTenant();
  const { authMode } = useAuth();

  const backend = authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured
    ? 'supabase'
    : 'local';

  const repo = useMemo(() => {
    return createPatientRepository({
      tenantId: activeTenant?.tenantId,
      backend
    });
  }, [activeTenant?.tenantId, backend]);

  const queryFn = useCallback(
    () => repo.listPatients(),
    [repo]
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
      await repo.createPatient(patient);
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
      await repo.updatePatient(patient);
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
