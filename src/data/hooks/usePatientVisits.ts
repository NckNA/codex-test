import { useCallback, useMemo } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import {
  createEncounterVisitRepository,
  type EncounterVisitRepository,
  type PatientVisit,
} from '../repositories/EncounterVisitRepository';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export interface UsePatientVisitsOptions {
  tenantId?: string | null;
  patientId?: string | null;
  includeArchived?: boolean;
  repository?: EncounterVisitRepository;
}

export interface UsePatientVisitsResult {
  visits: PatientVisit[];
  loading: boolean;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
  refresh: () => Promise<void>;
}

const SUPABASE_VISITS_UNAVAILABLE_ERROR = 'Supabase client is not configured for patient visit access.';

export function usePatientVisits({
  tenantId,
  patientId,
  includeArchived = false,
  repository,
}: UsePatientVisitsOptions): UsePatientVisitsResult {
  const canFetch = Boolean(tenantId && patientId);

  const encounterVisitRepository = useMemo(() => {
    if (repository) return repository;
    if (!isSupabaseConfigured) return null;
    return createEncounterVisitRepository({ backend: 'supabase' });
  }, [repository]);

  const queryFn = useCallback(async () => {
    if (!tenantId || !patientId) return [];
    if (!encounterVisitRepository) {
      throw new Error(SUPABASE_VISITS_UNAVAILABLE_ERROR);
    }

    return encounterVisitRepository.listPatientVisits({
      tenantId,
      patientId,
      includeArchived,
      limit: 50,
    });
  }, [encounterVisitRepository, includeArchived, patientId, tenantId]);

  const { data, isLoading, isError, error, refetch } = useAsyncQuery<PatientVisit[]>({
    queryFn,
    initialData: [],
    enabled: canFetch,
  });

  return {
    visits: data,
    loading: isLoading,
    isLoading,
    error,
    isError,
    refresh: refetch,
  };
}
