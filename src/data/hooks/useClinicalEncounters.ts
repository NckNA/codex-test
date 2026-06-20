import { useCallback, useMemo } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import {
  createEncounterVisitRepository,
  type ClinicalEncounter,
  type EncounterVisitRepository,
} from '../repositories/EncounterVisitRepository';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export interface UseClinicalEncountersOptions {
  tenantId?: string | null;
  patientId?: string | null;
  includeArchived?: boolean;
  repository?: EncounterVisitRepository;
}

export interface UseClinicalEncountersResult {
  encounters: ClinicalEncounter[];
  loading: boolean;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
  refresh: () => Promise<void>;
}

const SUPABASE_ENCOUNTERS_UNAVAILABLE_ERROR = 'Supabase client is not configured for clinical encounter access.';

export function useClinicalEncounters({
  tenantId,
  patientId,
  includeArchived = false,
  repository,
}: UseClinicalEncountersOptions): UseClinicalEncountersResult {
  const canFetch = Boolean(tenantId && patientId);

  const encounterRepository = useMemo(() => {
    if (repository) return repository;
    if (!isSupabaseConfigured) return null;
    return createEncounterVisitRepository({ backend: 'supabase' });
  }, [repository]);

  const queryFn = useCallback(async () => {
    if (!tenantId || !patientId) return [];
    if (!encounterRepository) {
      throw new Error(SUPABASE_ENCOUNTERS_UNAVAILABLE_ERROR);
    }

    return encounterRepository.listClinicalEncounters({
      tenantId,
      patientId,
      includeArchived,
      limit: 50,
    });
  }, [encounterRepository, includeArchived, patientId, tenantId]);

  const { data, isLoading, isError, error, refetch } = useAsyncQuery<ClinicalEncounter[]>({
    queryFn,
    initialData: [],
    enabled: canFetch,
  });

  return {
    encounters: data,
    loading: isLoading,
    isLoading,
    error,
    isError,
    refresh: refetch,
  };
}
