import { useState, useEffect, useCallback } from 'react';

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

  const executeFetch = useCallback(async (isMounted: () => boolean) => {
    setIsLoading(true);
    setIsError(false);
    setError(null);
    try {
      const result = await queryFn();
      if (isMounted()) {
        setData(result);
        setIsLoading(false);
        onSuccess?.(result);
      }
    } catch (err) {
      if (isMounted()) {
        const parsedError = err instanceof Error ? err : new Error(String(err));
        setIsError(true);
        setError(parsedError);
        setIsLoading(false);
        onError?.(parsedError);
      }
    }
  }, [queryFn, onSuccess, onError]);

  useEffect(() => {
    let mounted = true;
    const isMounted = () => mounted;

    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return () => {
        mounted = false;
      };
    }

    executeFetch(isMounted);

    return () => {
      mounted = false;
    };
  }, [enabled, executeFetch]);

  const refetch = useCallback(async () => {
    // If we trigger a manual refetch, we usually want to fetch regardless of the `enabled` prop on initial mount,
    // but to be perfectly safe, if `enabled` is false, it means dependencies might not be ready (e.g., missing patientId).
    // The design asks to be safe: "respect enabled".
    if (!enabled) {
      return;
    }
    await executeFetch(() => true);
  }, [enabled, executeFetch]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
  };
}
