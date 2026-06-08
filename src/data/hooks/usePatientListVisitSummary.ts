import { useCallback } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import { PatientListVisitSummaryAggregator } from '../aggregators/PatientListVisitSummaryAggregator';
import type { PatientVisitSummaryByPatientId } from '../aggregators/PatientListVisitSummaryAggregator';

export function usePatientListVisitSummary() {
  const queryFn = useCallback(
    () => PatientListVisitSummaryAggregator.getVisitSummaryByPatientId(),
    []
  );

  const { data, isLoading, isError, error, refetch } = useAsyncQuery<PatientVisitSummaryByPatientId>({
    queryFn,
    initialData: {},
    enabled: true,
  });

  return {
    visitSummaryByPatientId: data || {},
    isLoading,
    isError,
    error,
    refetch,
  };
}
