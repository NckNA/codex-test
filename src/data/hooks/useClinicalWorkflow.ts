import { useCallback, useState } from 'react';
import { LocalStorageClinicalWorkflowOrchestrator } from '../orchestrators/ClinicalWorkflowOrchestrator';
import type {
  ApplyToothStatusChangeInput,
  CreateTreatmentPlanFromFindingsInput
} from '../orchestrators/ClinicalWorkflowOrchestrator';
import type { DentalChart, TreatmentPlan } from '../../types';

export function useClinicalWorkflow() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  const applyToothStatusChange = useCallback(async (input: ApplyToothStatusChangeInput): Promise<DentalChart> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      return await LocalStorageClinicalWorkflowOrchestrator.applyToothStatusChange(input);
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const createTreatmentPlanFromFindings = useCallback(async (input: CreateTreatmentPlanFromFindingsInput): Promise<TreatmentPlan | null> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      return await LocalStorageClinicalWorkflowOrchestrator.createTreatmentPlanFromFindings(input);
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    isSaving,
    saveError,
    applyToothStatusChange,
    createTreatmentPlanFromFindings,
  };
}
