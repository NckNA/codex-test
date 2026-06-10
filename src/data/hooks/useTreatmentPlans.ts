import { useCallback, useState, useMemo } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import { createTreatmentPlansRepository } from '../repositories/TreatmentPlansRepository';
import type { TreatmentPlansRepositoryConfig } from '../repositories/TreatmentPlansRepository';
import type { TreatmentPlan } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export function useTreatmentPlans(patientId: string) {
  const { authMode } = useAuth();
  const { activeTenant } = useTenant();

  const tenantId = activeTenant?.tenantId;

  const repositoryConfig = useMemo<TreatmentPlansRepositoryConfig>(() => {
    if (authMode === 'supabase-active' && isSupabaseConfigured && tenantId) {
      return { backend: 'supabase', tenantId };
    }
    return { backend: 'local' };
  }, [authMode, isSupabaseConfigured, tenantId]);

  const repository = useMemo(() => {
    return createTreatmentPlansRepository(repositoryConfig);
  }, [repositoryConfig]);

  const queryFn = useCallback(async () => {
    if (repositoryConfig.backend === 'supabase' && !repositoryConfig.tenantId) {
      throw new Error('Supabase active but no tenant selected');
    }
    return await repository.listTreatmentPlansByPatient(patientId);
  }, [patientId, repository, repositoryConfig]);

  const {
    data: treatmentPlans,
    isLoading,
    isError,
    error,
    refetch,
  } = useAsyncQuery<TreatmentPlan[]>({
    queryFn,
    initialData: [],
    enabled: Boolean(patientId),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  const createTreatmentPlan = useCallback(async (plan: TreatmentPlan): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await repository.createTreatmentPlan(patientId, plan);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, repository, refetch]);

  const updateTreatmentPlan = useCallback(async (plan: TreatmentPlan): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await repository.updateTreatmentPlan(patientId, plan);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, repository, refetch]);

  const deleteTreatmentPlan = useCallback(async (planId: string): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await repository.deleteTreatmentPlan(patientId, planId);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, repository, refetch]);

  return {
    treatmentPlans: treatmentPlans || [],
    isLoading,
    isError: isError || saveError !== null,
    error: error || saveError,
    isSaving,
    saveError,
    createTreatmentPlan,
    updateTreatmentPlan,
    deleteTreatmentPlan,
    refetch,
  };
}
