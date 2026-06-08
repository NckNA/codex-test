import { useCallback, useState } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import { LocalStorageTreatmentPlansRepository } from '../repositories/TreatmentPlansRepository';
import type { TreatmentPlan } from '../../types';

export function useTreatmentPlans(patientId: string) {
  const queryFn = useCallback(async () => {
    return await LocalStorageTreatmentPlansRepository.listTreatmentPlansByPatient(patientId);
  }, [patientId]);

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
      await LocalStorageTreatmentPlansRepository.createTreatmentPlan(patientId, plan);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, refetch]);

  const updateTreatmentPlan = useCallback(async (plan: TreatmentPlan): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await LocalStorageTreatmentPlansRepository.updateTreatmentPlan(patientId, plan);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, refetch]);

  const deleteTreatmentPlan = useCallback(async (planId: string): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await LocalStorageTreatmentPlansRepository.deleteTreatmentPlan(patientId, planId);
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
