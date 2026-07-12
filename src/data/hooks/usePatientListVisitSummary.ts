import { useCallback, useMemo } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import { PatientListVisitSummaryAggregator } from '../aggregators/PatientListVisitSummaryAggregator';
import type { PatientVisitSummaryByPatientId } from '../aggregators/PatientListVisitSummaryAggregator';
import { createAppointmentRepository } from '../repositories/AppointmentRepository';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

const SUMMARY_ERROR = 'Не удалось загрузить сводку по записям.';

export function usePatientListVisitSummary() {
  const { authMode, user } = useAuth();
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.tenantId;
  const timezone = activeTenant?.timezone;
  const isSupabaseMode = authMode === 'supabase-active' && isSupabaseConfigured;

  const repository = useMemo(() => {
    if (authMode === 'dev') {
      return createAppointmentRepository({ backend: 'local' });
    }
    if (isSupabaseMode && user?.id && tenantId) {
      return createAppointmentRepository({ backend: 'supabase', tenantId });
    }
    return null;
  }, [authMode, isSupabaseMode, tenantId, user?.id]);

  const queryFn = useCallback(async (): Promise<PatientVisitSummaryByPatientId> => {
    if (!repository) return {};
    try {
      const appointments = await repository.listAppointments();
      return PatientListVisitSummaryAggregator.getVisitSummaryByPatientId(appointments);
    } catch {
      throw new Error(SUMMARY_ERROR);
    }
  }, [repository]);

  const enabled = authMode === 'dev'
    || (isSupabaseMode && Boolean(user?.id) && Boolean(tenantId) && Boolean(timezone));
  const queryKey = `${authMode}:${user?.id || 'no-user'}:${tenantId || 'no-tenant'}:${timezone || 'no-timezone'}:patient-list-summary`;

  const { data, isLoading, isError, error, refetch } = useAsyncQuery<PatientVisitSummaryByPatientId>({
    queryFn,
    initialData: {},
    enabled,
    queryKey,
    resetOnDisable: true,
  });

  return {
    visitSummaryByPatientId: enabled ? data : {},
    isLoading: enabled ? isLoading : false,
    isError: enabled ? isError : false,
    error: enabled ? error : null,
    refetch,
  };
}
