import { useCallback, useState } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import { LocalStorageDentalChartRepository } from '../repositories/DentalChartRepository';
import type { DentalChart } from '../../types';

export function useDentalChart(patientId: string) {
  const queryFn = useCallback(async () => {
    return await LocalStorageDentalChartRepository.getDentalChart(patientId);
  }, [patientId]);

  const {
    data: dentalChart,
    isLoading,
    isError,
    error,
    refetch,
  } = useAsyncQuery<DentalChart | null>({
    queryFn,
    initialData: null,
    enabled: Boolean(patientId),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  const saveDentalChart = useCallback(async (chart: DentalChart): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await LocalStorageDentalChartRepository.saveDentalChart(patientId, chart);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, refetch]);

  return {
    dentalChart,
    isLoading,
    isError: isError || saveError !== null,
    error: error || saveError,
    isSaving,
    saveError,
    saveDentalChart,
    refetch,
  };
}
