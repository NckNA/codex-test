import { useCallback, useState, useMemo } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import type { Appointment } from '../../types';
import { createAppointmentRepository } from '../repositories/AppointmentRepository';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export function useScheduleAppointments() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);
  
  const { authMode } = useAuth();
  const { activeTenant } = useTenant();

  const repository = useMemo(() => {
    return createAppointmentRepository({
      backend: (authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured) ? 'supabase' : 'local',
      tenantId: activeTenant?.tenantId,
    });
  }, [authMode, activeTenant?.tenantId]);

  const queryFn = useCallback(
    () => repository.listAppointments(),
    [repository]
  );

  const {
    data: appointments,
    isLoading,
    isError: isQueryError,
    error: queryError,
    refetch,
  } = useAsyncQuery<Appointment[]>({
    queryFn,
    initialData: [],
    enabled: true,
  });

  const createAppointment = async (appointment: Appointment): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await repository.createAppointment(appointment);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  };

  const updateAppointment = async (appointment: Appointment): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await repository.updateAppointment(appointment);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAppointment = async (appointmentId: string): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await repository.deleteAppointment(appointmentId);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  };

  const isError = isQueryError || saveError !== null;
  const error = saveError || queryError;

  return {
    appointments: appointments || [],
    isLoading,
    isError,
    error,
    isSaving,
    saveError,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    refetch,
  };
}
