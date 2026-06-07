import { useCallback } from 'react';
import type { Appointment } from '../../types';
import { LocalStorageAppointmentRepository } from '../repositories/AppointmentRepository';
import { useAsyncQuery } from './useAsyncQuery';

export function usePatientAppointments(patientId: string) {
  const queryFn = useCallback(() => {
    return LocalStorageAppointmentRepository.listAppointmentsByPatient(patientId);
  }, [patientId]);

  const {
    data: appointments,
    isLoading,
    isError,
    error,
    refetch,
  } = useAsyncQuery<Appointment[]>({
    queryFn,
    initialData: [],
    enabled: Boolean(patientId),
  });

  return {
    appointments,
    isLoading,
    isError,
    error,
    refetch,
  };
}
