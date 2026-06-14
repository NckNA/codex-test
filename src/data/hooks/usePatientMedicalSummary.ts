import { useCallback, useMemo } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import {
  getPatientMedicalSummary,
  EMPTY_PATIENT_MEDICAL_SUMMARY,
  type PatientMedicalSummaryData,
  type ClinicalSummaryRepositoryConfig
} from '../aggregators/ClinicalSummaryAggregator';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export function usePatientMedicalSummary(patientId: string) {
  const { authMode } = useAuth();
  const { activeTenant } = useTenant();

  const config = useMemo<ClinicalSummaryRepositoryConfig>(() => {
    return {
      backend: authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured ? 'supabase' : 'local',
      tenantId: activeTenant?.tenantId,
    };
  }, [authMode, activeTenant?.tenantId]);

  const queryFn = useCallback(() => getPatientMedicalSummary(patientId, config), [patientId, config]);

  return useAsyncQuery<PatientMedicalSummaryData>({
    queryFn,
    initialData: EMPTY_PATIENT_MEDICAL_SUMMARY,
    enabled: Boolean(patientId),
  });
}
