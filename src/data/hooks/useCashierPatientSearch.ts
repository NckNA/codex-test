/* eslint-disable react-hooks/set-state-in-effect -- tenant changes must clear stale cashier search results immediately */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPatientRepository, type PatientRepository } from '../repositories/PatientRepository';
import type { Patient } from '../../types';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export interface UseCashierPatientSearchOptions {
  tenantId?: string | null;
  repository?: PatientRepository;
  minQueryLength?: number;
}

export interface UseCashierPatientSearchResult {
  patients: Patient[];
  loading: boolean;
  error: Error | null;
  query: string;
  search: (query: string) => Promise<void>;
  clear: () => void;
}

function normalizePatientQuery(query: string) {
  return query.trim().toLowerCase();
}

function safePatientSearchError() {
  return new Error('Не удалось найти пациента.');
}

export function useCashierPatientSearch({ tenantId, repository, minQueryLength = 2 }: UseCashierPatientSearchOptions): UseCashierPatientSearchResult {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const tenantRef = useRef(tenantId);

  const patientRepository = useMemo(() => {
    if (repository) return repository;
    if (!tenantId || !isSupabaseConfigured) return null;
    return createPatientRepository({ backend: 'supabase', tenantId });
  }, [repository, tenantId]);

  useLayoutEffect(() => {
    if (tenantRef.current !== tenantId) {
      tenantRef.current = tenantId;
      requestGenerationRef.current += 1;
    }
  }, [tenantId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    requestGenerationRef.current += 1;
    setPatients([]);
    setQuery('');
    setLoading(false);
    setError(null);
  }, [tenantId]);

  const search = useCallback(async (nextQuery: string) => {
    const requestGeneration = ++requestGenerationRef.current;
    const requestTenantId = tenantId;
    const requestRepository = patientRepository;
    const normalized = normalizePatientQuery(nextQuery);

    setQuery(nextQuery);
    setPatients([]);
    setError(null);

    if (!requestTenantId || normalized.length < minQueryLength) {
      setLoading(false);
      return;
    }

    if (!requestRepository) {
      setLoading(false);
      setError(safePatientSearchError());
      return;
    }

    setLoading(true);
    try {
      const allPatients = await requestRepository.listPatients();
      if (
        !mountedRef.current ||
        requestGenerationRef.current !== requestGeneration ||
        tenantRef.current !== requestTenantId
      ) return;

      setPatients(allPatients.filter((patient) => {
        const haystack = `${patient.fullName ?? ''} ${patient.phone ?? ''}`.toLowerCase();
        return haystack.includes(normalized) && patient.status !== 'archived';
      }));
      setLoading(false);
    } catch {
      if (
        !mountedRef.current ||
        requestGenerationRef.current !== requestGeneration ||
        tenantRef.current !== requestTenantId
      ) return;

      setPatients([]);
      setError(safePatientSearchError());
      setLoading(false);
    }
  }, [minQueryLength, patientRepository, tenantId]);

  const clear = useCallback(() => {
    requestGenerationRef.current += 1;
    setPatients([]);
    setQuery('');
    setLoading(false);
    setError(null);
  }, []);

  return { patients, loading, error, query, search, clear };
}
