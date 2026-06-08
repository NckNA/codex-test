import { useCallback, useState } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import type { Appointment } from '../../types';
import { LocalStorageAppointmentRepository } from '../repositories/AppointmentRepository';

export function useScheduleAppointments() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  const queryFn = useCallback(
    () => LocalStorageAppointmentRepository.listAppointments(),
    []
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
      await LocalStorageAppointmentRepository.createAppointment(appointment);
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
      await LocalStorageAppointmentRepository.updateAppointment(appointment);
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
      await LocalStorageAppointmentRepository.deleteAppointment(appointmentId);
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
