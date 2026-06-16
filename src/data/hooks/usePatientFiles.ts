import { useCallback, useMemo, useState } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import {
  ACTIVE_CLINIC_REQUIRED_ERROR,
  createPatientFilesRepository,
  type PatientFileRecord,
  type UploadPatientFileInput,
} from '../repositories/PatientFilesRepository';

export function usePatientFiles(patientId: string) {
  const { authMode, user } = useAuth();
  const { activeTenant } = useTenant();
  const [mutationError, setMutationError] = useState<Error | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const isNoTenantSupabase = authMode === 'supabase-active' && isSupabaseConfigured && !activeTenant?.tenantId;

  const repository = useMemo(() => createPatientFilesRepository({
    backend: authMode === 'supabase-active' && isSupabaseConfigured && activeTenant?.tenantId ? 'supabase' : 'local',
    tenantId: activeTenant?.tenantId,
    userId: user?.id,
  }), [authMode, activeTenant?.tenantId, user?.id]);

  const queryFn = useCallback(async () => {
    if (isNoTenantSupabase) return [];
    return repository.listPatientFiles(patientId);
  }, [repository, patientId, isNoTenantSupabase]);

  const { data, isLoading, isError, error, refetch } = useAsyncQuery<PatientFileRecord[]>({
    queryFn,
    initialData: [],
    enabled: Boolean(patientId),
  });

  const uploadFile = useCallback(async (file: File, options: Omit<UploadPatientFileInput, 'patientId' | 'file'> = {}) => {
    if (isNoTenantSupabase) {
      const err = new Error(ACTIVE_CLINIC_REQUIRED_ERROR);
      setMutationError(err);
      throw err;
    }
    setIsUploading(true);
    setMutationError(null);
    try {
      const record = await repository.uploadPatientFile({ patientId, file, ...options });
      await refetch();
      return record;
    } catch (err) {
      const parsed = err instanceof Error ? err : new Error(String(err));
      setMutationError(parsed);
      throw parsed;
    } finally {
      setIsUploading(false);
    }
  }, [repository, patientId, refetch, isNoTenantSupabase]);

  const archiveFile = useCallback(async (fileId: string) => {
    if (isNoTenantSupabase) {
      const err = new Error(ACTIVE_CLINIC_REQUIRED_ERROR);
      setMutationError(err);
      throw err;
    }
    setIsArchiving(true);
    setMutationError(null);
    try {
      await repository.archivePatientFile(fileId);
      await refetch();
    } catch (err) {
      const parsed = err instanceof Error ? err : new Error(String(err));
      setMutationError(parsed);
      throw parsed;
    } finally {
      setIsArchiving(false);
    }
  }, [repository, refetch, isNoTenantSupabase]);

  return {
    files: isNoTenantSupabase ? [] : data,
    isLoading: isNoTenantSupabase ? false : isLoading,
    isUploading,
    isArchiving,
    error: mutationError ?? error,
    isError: isError || mutationError !== null,
    uploadFile,
    archiveFile,
    refresh: refetch,
  };
}
