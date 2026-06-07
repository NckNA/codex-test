import { useState, useEffect, useCallback } from 'react';
import type { Doctor } from '../../types';
import { LocalStorageDoctorRepository } from '../repositories/DoctorRepository';

export function useClinicDoctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDoctors = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setError(null);
    try {
      // Using listDoctors() instead of listActiveDoctors() to ensure
      // history tabs can still resolve names of inactive doctors for past appointments.
      const data = await LocalStorageDoctorRepository.listDoctors();
      setDoctors(data);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initFetch = async () => {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      try {
        const data = await LocalStorageDoctorRepository.listDoctors();
        if (mounted) {
          setDoctors(data);
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
  }, []);

  return {
    doctors,
    isLoading,
    isError,
    error,
    refetch: fetchDoctors,
  };
}
