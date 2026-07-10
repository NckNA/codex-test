import { useCallback, useMemo, useState } from 'react';
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

function safePatientSearchError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message || 'Не удалось найти пациента.';
    if (message.length <= 160 && !message.includes('\n') && !message.includes('{')) return new Error(message);
  }
  return new Error('Не удалось найти пациента.');
}

export function useCashierPatientSearch({ tenantId, repository, minQueryLength = 2 }: UseCashierPatientSearchOptions): UseCashierPatientSearchResult {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const patientRepository = useMemo(() => {
    if (repository) return repository;
    if (!tenantId || !isSupabaseConfigured) return null;
    return createPatientRepository({ backend: 'supabase', tenantId });
  }, [repository, tenantId]);

  const search = useCallback(async (nextQuery: string) => {
    setQuery(nextQuery);
    setError(null);
    const normalized = normalizePatientQuery(nextQuery);

    if (!tenantId) {
      setPatients([]);
      return;
    }

    if (normalized.length < minQueryLength) {
      setPatients([]);
      return;
    }

    if (!patientRepository) {
      setPatients([]);
      setError(new Error('Не удалось найти пациента.'));
      return;
    }

    setLoading(true);
    try {
      const allPatients = await patientRepository.listPatients();
      setPatients(allPatients.filter((patient) => {
        const haystack = `${patient.fullName ?? ''} ${patient.phone ?? ''}`.toLowerCase();
        return haystack.includes(normalized) && patient.status !== 'archived';
      }));
    } catch (err) {
      setPatients([]);
      setError(safePatientSearchError(err));
    } finally {
      setLoading(false);
    }
  }, [minQueryLength, patientRepository, tenantId]);

  const clear = useCallback(() => {
    setPatients([]);
    setQuery('');
    setError(null);
  }, []);

  return { patients, loading, error, query, search, clear };
}
