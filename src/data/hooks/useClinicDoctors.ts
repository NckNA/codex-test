import { useCallback, useMemo } from 'react';
import type { Doctor } from '../../types';
import { createDoctorRepository } from '../repositories/DoctorRepository';
import { useAsyncQuery } from './useAsyncQuery';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export function useClinicDoctors() {
  const { authMode } = useAuth();
  const { activeTenant } = useTenant();

  const repository = useMemo(() => {
    const backend = (authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured) 
      ? 'supabase' 
      : 'local';
    
    return createDoctorRepository({
      backend,
      tenantId: activeTenant?.tenantId
    });
  }, [authMode, activeTenant?.tenantId]);

  const queryFn = useCallback(() => repository.listDoctors(), [repository]);

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
