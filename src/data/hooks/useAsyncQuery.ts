import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAsyncQueryOptions<T> {
  queryFn: () => Promise<T>;
  initialData: T;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useAsyncQuery<T>({
  queryFn,
  initialData,
  enabled = true,
  onSuccess,
  onError,
}: UseAsyncQueryOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const executeFetch = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setError(null);
    try {
      const result = await queryFn();
      if (isMountedRef.current) {
        setData(result);
        setIsLoading(false);
        onSuccess?.(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const parsedError = err instanceof Error ? err : new Error(String(err));
        setIsError(true);
        setError(parsedError);
        setIsLoading(false);
        onError?.(parsedError);
      }
    }
  }, [queryFn, onSuccess, onError]);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }

    executeFetch();
  }, [enabled, executeFetch]);

  const refetch = useCallback(async () => {
    if (!enabled) {
      return;
    }
    await executeFetch();
  }, [enabled, executeFetch]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
  };
}
