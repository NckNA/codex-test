import { useCallback } from 'react';
import type { Doctor } from '../../types';
import { LocalStorageDoctorRepository } from '../repositories/DoctorRepository';
import { useAsyncQuery } from './useAsyncQuery';

export function useClinicDoctors() {
  const queryFn = useCallback(() => LocalStorageDoctorRepository.listDoctors(), []);

  const {
    data: doctors,
    isLoading,
    isError,
    error,
    refetch,
  } = useAsyncQuery<Doctor[]>({
    queryFn,
    initialData: [],
    enabled: true,
  });

  return {
    doctors,
    isLoading,
    isError,
    error,
    refetch,
  };
}
