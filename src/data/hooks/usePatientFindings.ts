import { useCallback, useState, useMemo } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import { createFindingsRepository, type CreateFindingInput } from '../repositories/FindingsRepository';
import type { DentalFinding } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export function usePatientFindings(patientId: string) {
  const { authMode } = useAuth();
  const { activeTenant } = useTenant();

  const repository = useMemo(() => {
    return createFindingsRepository({
      backend: authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured ? 'supabase' : 'local',
      tenantId: activeTenant?.tenantId,
    });
  }, [authMode, activeTenant?.tenantId]);

  const isNoTenantSupabase = authMode === 'supabase-active' && isSupabaseConfigured && !activeTenant?.tenantId;

  const queryFn = useCallback(async () => {
    if (isNoTenantSupabase) {
      return [];
    }
    return await repository.listFindingsByPatient(patientId);
  }, [repository, patientId, isNoTenantSupabase]);

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
    if (isNoTenantSupabase) {
      const err = new Error("Active clinic is required for Supabase data access.");
      setSaveError(err);
      throw err;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await repository.createFinding(patientId, finding);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [repository, patientId, refetch]);

  const updateFinding = useCallback(async (finding: DentalFinding): Promise<void> => {
    if (isNoTenantSupabase) {
      const err = new Error("Active clinic is required for Supabase data access.");
      setSaveError(err);
      throw err;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await repository.updateFinding(patientId, finding);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [repository, patientId, refetch]);

  const deleteFinding = useCallback(async (findingId: string): Promise<void> => {
    if (isNoTenantSupabase) {
      const err = new Error("Active clinic is required for Supabase data access.");
      setSaveError(err);
      throw err;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await repository.deleteFinding(patientId, findingId);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [repository, patientId, refetch]);

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
