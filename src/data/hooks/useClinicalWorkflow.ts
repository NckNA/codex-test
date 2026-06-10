import { useCallback, useState, useMemo } from 'react';
import { createClinicalWorkflowOrchestrator } from '../orchestrators/ClinicalWorkflowOrchestrator';
import { createDentalChartRepository } from '../repositories/DentalChartRepository';
import { createFindingsRepository } from '../repositories/FindingsRepository';
import { createTreatmentPlansRepository } from '../repositories/TreatmentPlansRepository';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import type {
  ApplyToothStatusChangeInput,
  CreateTreatmentPlanFromFindingsInput
} from '../orchestrators/ClinicalWorkflowOrchestrator';
import type { DentalChart, TreatmentPlan } from '../../types';

export function useClinicalWorkflow() {
  const { authMode } = useAuth();
  const { activeTenant } = useTenant();

  const orchestrator = useMemo(() => {
    const backend =
      authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured
        ? 'supabase'
        : 'local';

    const dentalChartRepository = createDentalChartRepository({
      tenantId: activeTenant?.tenantId,
      backend,
    });

    const findingsRepository = createFindingsRepository({
      tenantId: activeTenant?.tenantId,
      backend,
    });

    const treatmentPlansRepository = createTreatmentPlansRepository({
      tenantId: activeTenant?.tenantId,
      backend,
    });

    return createClinicalWorkflowOrchestrator({
      dentalChartRepository,
      findingsRepository,
      treatmentPlansRepository,
      backend,
    });
  }, [authMode, activeTenant?.tenantId]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  const applyToothStatusChange = useCallback(async (input: ApplyToothStatusChangeInput): Promise<DentalChart> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      return await orchestrator.applyToothStatusChange(input);
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [orchestrator]);

  const createTreatmentPlanFromFindings = useCallback(async (input: CreateTreatmentPlanFromFindingsInput): Promise<TreatmentPlan | null> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      return await orchestrator.createTreatmentPlanFromFindings(input);
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [orchestrator]);

  return {
    isSaving,
    saveError,
    applyToothStatusChange,
    createTreatmentPlanFromFindings,
  };
}
