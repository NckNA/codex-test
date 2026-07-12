import { useCallback, useMemo } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import {
  getPatientMedicalSummary,
  EMPTY_PATIENT_MEDICAL_SUMMARY,
  type PatientMedicalSummaryData,
  type ClinicalSummaryRepositoryConfig,
} from '../aggregators/ClinicalSummaryAggregator';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export function usePatientMedicalSummary(patientId: string) {
  const { authMode, user } = useAuth();
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.tenantId;
  const isSupabaseMode = authMode === 'supabase-active' && isSupabaseConfigured;

  const config = useMemo<ClinicalSummaryRepositoryConfig | null>(() => {
    if (authMode === 'dev') {
      return { backend: 'local', tenantId };
    }
    if (isSupabaseMode && user?.id && tenantId) {
      return { backend: 'supabase', tenantId };
    }
    return null;
  }, [authMode, isSupabaseMode, tenantId, user?.id]);

  const queryFn = useCallback(async (): Promise<PatientMedicalSummaryData> => {
    if (!patientId || !config) return EMPTY_PATIENT_MEDICAL_SUMMARY;
    try {
      return await getPatientMedicalSummary(patientId, config);
    } catch {
      throw new Error('Не удалось загрузить сводку пациента.');
    }
  }, [patientId, config]);

  const enabled = Boolean(patientId) && (
    authMode === 'dev'
    || (isSupabaseMode && Boolean(user?.id) && Boolean(tenantId))
  );
  const queryKey = `${authMode}:${user?.id || 'no-user'}:${tenantId || 'no-tenant'}:${patientId || 'no-patient'}:medical-summary`;

  const result = useAsyncQuery<PatientMedicalSummaryData>({
    queryFn,
    initialData: EMPTY_PATIENT_MEDICAL_SUMMARY,
    enabled,
    queryKey,
    resetOnDisable: true,
  });

  return {
    ...result,
    data: enabled ? result.data : EMPTY_PATIENT_MEDICAL_SUMMARY,
    isLoading: enabled ? result.isLoading : false,
    isError: enabled ? result.isError : false,
    error: enabled ? result.error : null,
  };
}
