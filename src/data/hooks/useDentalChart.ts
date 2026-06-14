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

  const isNoTenantSupabase = authMode === 'supabase-active' && isSupabaseConfigured && !activeTenant?.tenantId;

  const queryFn = useCallback(async () => {
    if (isNoTenantSupabase) {
      return null;
    }
    return await repository.getDentalChart(patientId);
  }, [repository, patientId, isNoTenantSupabase]);

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
    if (isNoTenantSupabase) {
      const err = new Error("Active clinic is required for Supabase data access.");
      setSaveError(err);
      throw err;
    }
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
  }, [repository, patientId, refetch, isNoTenantSupabase]);

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
