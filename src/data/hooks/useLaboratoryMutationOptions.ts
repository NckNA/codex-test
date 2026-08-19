import { useCallback, useMemo } from 'react';
import { createDoctorRepository, type IDoctorRepository } from '../repositories/DoctorRepository';
import type { LaboratoryRecord, LaboratoryWorkTypeRecord } from '../repositories/LaboratoryWorkRepository';
import { useAsyncQuery } from './useAsyncQuery';
import { useLaboratoryWorkRepository } from './useLaboratoryWorkRepository';

export interface LaboratoryMutationDoctorOption {
  id: string;
  name: string;
  active: boolean;
}

export interface UseLaboratoryMutationOptionsResult {
  doctors: LaboratoryMutationDoctorOption[];
  laboratories: LaboratoryRecord[];
  workTypes: LaboratoryWorkTypeRecord[];
  selectedWorkTypeIds: string[];
  ready: boolean;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

type DoctorRepositoryFactory = (input: { backend: 'supabase'; tenantId: string }) => IDoctorRepository;

interface Options {
  doctorRepositoryFactory?: DoctorRepositoryFactory;
}

const EMPTY: Omit<UseLaboratoryMutationOptionsResult, 'refetch'> = {
  doctors: [],
  laboratories: [],
  workTypes: [],
  selectedWorkTypeIds: [],
  ready: false,
  loading: false,
  error: null,
};

const defaultDoctorRepositoryFactory: DoctorRepositoryFactory = ({ tenantId }) => createDoctorRepository({ backend: 'supabase', tenantId });

export function useLaboratoryMutationOptions(orderId?: string | null, options: Options = {}): UseLaboratoryMutationOptionsResult {
  const selection = useLaboratoryWorkRepository();
  const enabled = Boolean(
    selection.ready
    && selection.backend === 'supabase'
    && selection.tenantId
    && selection.userId
    && selection.repository,
  );
  const doctorRepositoryFactory = options.doctorRepositoryFactory ?? defaultDoctorRepositoryFactory;
  const doctorRepository = useMemo(() => {
    if (!enabled || !selection.tenantId) return null;
    return doctorRepositoryFactory({ backend: 'supabase', tenantId: selection.tenantId });
  }, [doctorRepositoryFactory, enabled, selection.tenantId]);

  const queryFn = useCallback(async () => {
    if (!enabled || !selection.repository || !doctorRepository) {
      return { doctors: [], laboratories: [], workTypes: [], selectedWorkTypeIds: [] };
    }
    try {
      const [doctors, laboratories, workTypes, selectedWorkTypeIds] = await Promise.all([
        doctorRepository.listDoctors(),
        selection.repository.listLaboratories(true),
        selection.repository.listWorkTypes(true),
        orderId ? selection.repository.listOrderWorkTypeIds(orderId) : Promise.resolve([]),
      ]);
      return {
        doctors: doctors.map((doctor) => ({ id: doctor.id, name: doctor.fullName, active: doctor.active })),
        laboratories,
        workTypes,
        selectedWorkTypeIds: [...new Set(selectedWorkTypeIds)].sort(),
      };
    } catch {
      throw new Error('Не удалось загрузить варианты для лабораторной работы.');
    }
  }, [doctorRepository, enabled, orderId, selection.repository]);

  const queryKey = `${selection.backend}:${selection.tenantId ?? 'no-tenant'}:${selection.userId ?? 'no-user'}:${orderId ?? 'create'}`;
  const query = useAsyncQuery({
    queryFn,
    initialData: { doctors: [], laboratories: [], workTypes: [], selectedWorkTypeIds: [] },
    enabled,
    queryKey,
    resetOnDisable: true,
  });

  if (!enabled) return { ...EMPTY, refetch: query.refetch };
  return {
    doctors: query.data.doctors,
    laboratories: query.data.laboratories,
    workTypes: query.data.workTypes,
    selectedWorkTypeIds: query.data.selectedWorkTypeIds,
    ready: !query.isLoading && !query.isError,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
