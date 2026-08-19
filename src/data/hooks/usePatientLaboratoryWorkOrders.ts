import { useCallback } from 'react';
import type { LaboratoryWorkOrderRecord } from '../repositories/LaboratoryWorkRepository';
import { useAsyncQuery } from './useAsyncQuery';
import { useLaboratoryWorkRepository } from './useLaboratoryWorkRepository';

const PATIENT_LABORATORY_WORK_ERROR = 'Не удалось загрузить лабораторные работы пациента.';

export interface UsePatientLaboratoryWorkOrdersResult {
  orders: LaboratoryWorkOrderRecord[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePatientLaboratoryWorkOrders(
  patientId: string | null | undefined,
): UsePatientLaboratoryWorkOrdersResult {
  const normalizedPatientId = patientId?.trim() ?? '';
  const {
    repository,
    ready,
    backend,
    tenantId,
    userId,
  } = useLaboratoryWorkRepository();

  const enabled = Boolean(normalizedPatientId && ready && repository);

  const queryFn = useCallback(async (): Promise<LaboratoryWorkOrderRecord[]> => {
    if (!enabled || !repository) return [];

    try {
      return await repository.listOrders({ patientId: normalizedPatientId });
    } catch {
      throw new Error(PATIENT_LABORATORY_WORK_ERROR);
    }
  }, [enabled, normalizedPatientId, repository]);

  const queryKey = `${backend}:${tenantId ?? 'no-tenant'}:${userId ?? 'no-user'}:${normalizedPatientId || 'no-patient'}`;

  const {
    data: orders,
    isLoading,
    isError,
    error,
    refetch,
  } = useAsyncQuery<LaboratoryWorkOrderRecord[]>({
    queryFn,
    initialData: [],
    enabled,
    queryKey,
    resetOnDisable: true,
  });

  return {
    orders: enabled ? orders : [],
    isLoading: enabled ? isLoading : false,
    isError: enabled ? isError : false,
    error: enabled ? error : null,
    refetch,
  };
}
