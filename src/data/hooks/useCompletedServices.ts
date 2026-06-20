import { useCallback, useMemo } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import {
  createEncounterVisitRepository,
  type CompletedService,
  type EncounterVisitRepository,
} from '../repositories/EncounterVisitRepository';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export interface UseCompletedServicesOptions {
  tenantId?: string | null;
  patientId?: string | null;
  includeArchived?: boolean;
  includeVoided?: boolean;
  repository?: EncounterVisitRepository;
  enabled?: boolean;
}

export interface UseCompletedServicesResult {
  services: CompletedService[];
  loading: boolean;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
  refresh: () => Promise<void>;
}

const UNAVAILABLE_ERROR = 'Supabase client is not configured for completed service access.';

export function useCompletedServices({
  tenantId,
  patientId,
  includeArchived = false,
  includeVoided = true,
  repository,
  enabled = true,
}: UseCompletedServicesOptions): UseCompletedServicesResult {
  const canFetch = Boolean(tenantId && patientId) && enabled;

  const serviceRepository = useMemo(() => {
    if (repository) return repository;
    if (!isSupabaseConfigured) return null;
    return createEncounterVisitRepository({ backend: 'supabase' });
  }, [repository]);

  const queryFn = useCallback(async () => {
    if (!tenantId || !patientId) return [];
    if (!serviceRepository) throw new Error(UNAVAILABLE_ERROR);

    return serviceRepository.listCompletedServices({
      tenantId,
      patientId,
      includeArchived,
      includeVoided,
      limit: 50,
    });
  }, [includeArchived, includeVoided, patientId, serviceRepository, tenantId]);

  const { data, isLoading, isError, error, refetch } = useAsyncQuery<CompletedService[]>({
    queryFn,
    initialData: [],
    enabled: canFetch,
  });

  return {
    services: data,
    loading: isLoading,
    isLoading,
    error,
    isError,
    refresh: refetch,
  };
}
