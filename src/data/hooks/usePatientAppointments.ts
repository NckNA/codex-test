import { useCallback, useMemo } from 'react';
import type { Appointment } from '../../types';
import { createAppointmentRepository } from '../repositories/AppointmentRepository';
import { useAsyncQuery } from './useAsyncQuery';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

const PATIENT_APPOINTMENTS_ERROR = 'Не удалось загрузить записи пациента.';

export function usePatientAppointments(patientId: string) {
  const { authMode, user } = useAuth();
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.tenantId;
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

  const queryFn = useCallback(async (): Promise<Appointment[]> => {
    if (!patientId || !repository) return [];
    try {
      return await repository.listAppointmentsByPatient(patientId);
    } catch {
      throw new Error(PATIENT_APPOINTMENTS_ERROR);
    }
  }, [patientId, repository]);

  const enabled = Boolean(patientId) && (
    authMode === 'dev'
    || (isSupabaseMode && Boolean(user?.id) && Boolean(tenantId))
  );
  const queryKey = `${authMode}:${user?.id || 'no-user'}:${tenantId || 'no-tenant'}:${patientId || 'no-patient'}`;

  const {
    data: appointments,
    isLoading,
    isError,
    error,
    refetch,
  } = useAsyncQuery<Appointment[]>({
    queryFn,
    initialData: [],
    enabled,
    queryKey,
    resetOnDisable: true,
  });

  return {
    appointments: enabled ? appointments : [],
    isLoading: enabled ? isLoading : false,
    isError: enabled ? isError : false,
    error: enabled ? error : null,
    refetch,
  };
}
