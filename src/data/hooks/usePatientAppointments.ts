import { useState, useEffect, useCallback } from 'react';
import type { Appointment } from '../../types';
import { LocalStorageAppointmentRepository } from '../repositories/AppointmentRepository';

export function usePatientAppointments(patientId: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!!patientId);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (!patientId) return;
    setIsLoading(true);
    setIsError(false);
    setError(null);
    try {
      const data = await LocalStorageAppointmentRepository.listAppointmentsByPatient(patientId);
      setAppointments(data);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    let mounted = true;

    if (!patientId) {
      return;
    }

    const initFetch = async () => {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      try {
        const data = await LocalStorageAppointmentRepository.listAppointmentsByPatient(patientId);
        if (mounted) {
          setAppointments(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setIsError(true);
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    };

    initFetch();

    return () => {
      mounted = false;
    };
  }, [patientId]);

  return {
    appointments,
    isLoading,
    isError,
    error,
    refetch: fetchAppointments,
  };
}
