import { useCallback, useState, useMemo } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import { createPatientRepository } from '../repositories/PatientRepository';
import type { Patient } from '../../types';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export function usePatientProfile(patientId: string) {
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
    () => repo.getPatientById(patientId),
    [patientId, repo]
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
    enabled: !!patientId,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  const savePatient = async (updatedPatient: Patient) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await repo.updatePatient(updatedPatient);
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
    patient,
    isLoading,
    isError: isQueryError || saveError !== null,
    error: saveError || queryError,
    isSaving,
    savePatient,
    refetch,
  };
}
