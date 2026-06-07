import { useState, useCallback } from 'react';

interface UseAsyncMutationOptions<TInput, TResult> {
  mutationFn: (input: TInput) => Promise<TResult>;
  onSuccess?: (result: TResult, input: TInput) => void;
  onError?: (error: Error, input: TInput) => void;
}

export function useAsyncMutation<TInput, TResult>({
  mutationFn,
  onSuccess,
  onError,
}: UseAsyncMutationOptions<TInput, TResult>) {
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: TInput): Promise<TResult | undefined> => {
    setIsMutating(true);
    setIsError(false);
    setError(null);
    try {
      const result = await mutationFn(input);
      setIsMutating(false);
      onSuccess?.(result, input);
      return result;
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error(String(err));
      setIsError(true);
      setError(parsedError);
      setIsMutating(false);
      onError?.(parsedError, input);
      return undefined;
    }
  }, [mutationFn, onSuccess, onError]);

  const reset = useCallback(() => {
    setIsMutating(false);
    setIsError(false);
    setError(null);
  }, []);

  return {
    isMutating,
    isError,
    error,
    mutate,
    reset,
  };
}
