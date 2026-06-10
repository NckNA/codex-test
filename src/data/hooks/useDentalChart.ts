import { useCallback, useState, useMemo } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import { createDentalChartRepository } from '../repositories/DentalChartRepository';
import type { DentalChart } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export function useDentalChart(patientId: string) {
  const { authMode } = useAuth();
  const { activeTenant } = useTenant();

  const repository = useMemo(() => {
    const backend =
      authMode === 'supabase-active' && activeTenant?.tenantId && isSupabaseConfigured
        ? 'supabase'
        : 'local';

    return createDentalChartRepository({
      tenantId: activeTenant?.tenantId,
      backend,
    });
  }, [authMode, activeTenant?.tenantId]);

  const queryFn = useCallback(async () => {
    return await repository.getDentalChart(patientId);
  }, [repository, patientId]);

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
      await repository.saveDentalChart(patientId, chart);
      await refetch();
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      setSaveError(parsedError);
      throw parsedError;
    } finally {
      setIsSaving(false);
    }
  }, [repository, patientId, refetch]);

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
