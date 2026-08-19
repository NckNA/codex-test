import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPatientRepository, normalizePatientLookupQuery, type PatientLookupRecord, type PatientLookupRepository } from '../repositories/PatientRepository';
import { useLaboratoryWorkRepository } from './useLaboratoryWorkRepository';

export interface UseLaboratoryPatientLookupOptions {
  repository?: PatientLookupRepository;
  minQueryLength?: number;
  limit?: number;
}

export interface UseLaboratoryPatientLookupResult {
  ready: boolean;
  query: string;
  results: PatientLookupRecord[];
  loading: boolean;
  error: Error | null;
  search: (query: string) => Promise<void>;
  clear: () => void;
}

const DEFAULT_MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 20;
const SAFE_ERROR = 'Не удалось найти пациента.';

export function useLaboratoryPatientLookup(
  options: UseLaboratoryPatientLookupOptions = {},
): UseLaboratoryPatientLookupResult {
  const selection = useLaboratoryWorkRepository();
  const requestedMinQueryLength = options.minQueryLength ?? DEFAULT_MIN_QUERY_LENGTH;
  const requestedLimit = options.limit ?? DEFAULT_LIMIT;
  const minQueryLength = Number.isFinite(requestedMinQueryLength)
    ? Math.max(2, Math.floor(requestedMinQueryLength))
    : DEFAULT_MIN_QUERY_LENGTH;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(20, Math.max(1, Math.floor(requestedLimit)))
    : DEFAULT_LIMIT;
  const contextKey = selection.backend === 'supabase' && selection.ready && selection.tenantId && selection.userId
    ? `${selection.backend}:${selection.tenantId}:${selection.userId}`
    : null;
  const ready = Boolean(contextKey);

  const repository = useMemo((): PatientLookupRepository | null => {
    if (!ready || !selection.tenantId) return null;
    if (options.repository) return options.repository;
    const created = createPatientRepository({ backend: 'supabase', tenantId: selection.tenantId });
    return typeof created.searchPatientLookup === 'function' ? created as PatientLookupRepository : null;
  }, [options.repository, ready, selection.tenantId]);

  const contextRef = useRef<string | null>(contextKey);
  const requestGenerationRef = useRef(0);
  const [stateContextKey, setStateContextKey] = useState<string | null>(contextKey);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PatientLookupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useLayoutEffect(() => {
    if (contextRef.current !== contextKey) requestGenerationRef.current += 1;
    contextRef.current = contextKey;
  }, [contextKey]);

  const search = useCallback(async (nextQuery: string) => {
    const normalized = normalizePatientLookupQuery(nextQuery);
    const requestContextKey = contextKey;
    const requestRepository = repository;
    const generation = ++requestGenerationRef.current;

    setStateContextKey(requestContextKey);
    setQuery(nextQuery);
    setResults([]);
    setError(null);

    if (!requestContextKey || !requestRepository) {
      setLoading(false);
      setError(new Error(SAFE_ERROR));
      return;
    }

    if (normalized.length < minQueryLength) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const nextResults = await requestRepository.searchPatientLookup({ query: normalized, limit });
      if (generation !== requestGenerationRef.current || contextRef.current !== requestContextKey) return;
      setResults(nextResults);
      setLoading(false);
    } catch {
      if (generation !== requestGenerationRef.current || contextRef.current !== requestContextKey) return;
      setResults([]);
      setLoading(false);
      setError(new Error(SAFE_ERROR));
    }
  }, [contextKey, limit, minQueryLength, repository]);

  const clear = useCallback(() => {
    requestGenerationRef.current += 1;
    setStateContextKey(contextKey);
    setQuery('');
    setResults([]);
    setLoading(false);
    setError(null);
  }, [contextKey]);

  const visible = stateContextKey === contextKey;
  return {
    ready,
    query: visible ? query : '',
    results: visible ? results : [],
    loading: visible ? loading : false,
    error: visible ? error : null,
    search,
    clear,
  };
}
