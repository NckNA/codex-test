/* eslint-disable react-hooks/set-state-in-effect -- query identity changes intentionally clear stale visible state before a replacement request completes */
import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';

interface UseAsyncQueryOptions<T> {
  queryFn: () => Promise<T>;
  initialData: T;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  queryKey?: string | number | null;
  resetOnDisable?: boolean;
}

export function useAsyncQuery<T>({
  queryFn,
  initialData,
  enabled = true,
  onSuccess,
  onError,
  queryKey = null,
  resetOnDisable = false,
}: UseAsyncQueryOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [dataKey, setDataKey] = useState<string | number | null>(queryKey);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef(true);
  const requestGenerationRef = useRef(0);
  const latestQueryKeyRef = useRef<string | number | null>(queryKey);
  const previousQueryKeyRef = useRef<string | number | null>(queryKey);
  const initialDataRef = useRef(initialData);

  useLayoutEffect(() => {
    initialDataRef.current = initialData;
    if (!Object.is(latestQueryKeyRef.current, queryKey)) {
      latestQueryKeyRef.current = queryKey;
      requestGenerationRef.current += 1;
    }
    if (!enabled) {
      requestGenerationRef.current += 1;
    }
  }, [enabled, initialData, queryKey]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      requestGenerationRef.current += 1;
    };
  }, []);

  const executeFetch = useCallback(async (): Promise<boolean> => {
    if (!enabled) return false;

    const requestGeneration = ++requestGenerationRef.current;
    const requestKey = queryKey;
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const result = await queryFn();
      if (
        !isMountedRef.current ||
        requestGenerationRef.current !== requestGeneration ||
        !Object.is(latestQueryKeyRef.current, requestKey)
      ) return false;

      setData(result);
      setDataKey(requestKey);
      setIsLoading(false);
      onSuccess?.(result);
      return true;
    } catch (err) {
      if (
        !isMountedRef.current ||
        requestGenerationRef.current !== requestGeneration ||
        !Object.is(latestQueryKeyRef.current, requestKey)
      ) return false;

      const parsedError = err instanceof Error ? err : new Error(String(err));
      setIsError(true);
      setError(parsedError);
      setIsLoading(false);
      onError?.(parsedError);
      return false;
    }
  }, [enabled, onError, onSuccess, queryFn, queryKey]);

  useEffect(() => {
    const keyChanged = !Object.is(previousQueryKeyRef.current, queryKey);
    previousQueryKeyRef.current = queryKey;

    if (!enabled) {
      requestGenerationRef.current += 1;
      setIsLoading(false);
      setIsError(false);
      setError(null);
      if (resetOnDisable) {
        setData(initialDataRef.current);
        setDataKey(queryKey);
      }
      return;
    }

    if (keyChanged) {
      setData(initialDataRef.current);
      setDataKey(queryKey);
      setIsError(false);
      setError(null);
    }

    void executeFetch();
  }, [enabled, executeFetch, queryKey, resetOnDisable]);

  const refetchWithResult = useCallback(async (): Promise<boolean> => {
    if (!enabled) return false;
    return executeFetch();
  }, [enabled, executeFetch]);

  const refetch = useCallback(async (): Promise<void> => {
    await refetchWithResult();
  }, [refetchWithResult]);

  const visibleForCurrentKey = Object.is(dataKey, queryKey);

  return {
    data: visibleForCurrentKey ? data : initialData,
    isLoading,
    isError: visibleForCurrentKey ? isError : false,
    error: visibleForCurrentKey ? error : null,
    refetch,
  };
}
